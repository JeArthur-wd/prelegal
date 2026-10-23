import os
from datetime import date

import pytest

import llm
from chat import ChatTurn, FieldUpdate, apply_updates, build_system_prompt
from templates import load_catalog

NDA = load_catalog()["mutual-nda"]
USER_MESSAGE = {"role": "user", "content": "Acme Corp and Globex LLC, starting tomorrow."}


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace the LLM with a stub returning `fake_llm.turn`, recording the prompts it receives."""

    class FakeLLM:
        turn = ChatTurn(reply="Thanks! Where is Acme based?", field_updates=[])
        calls: list[list[dict[str, str]]] = []

        def __call__(self, messages, response_model):
            assert response_model is ChatTurn
            self.calls.append(messages)
            return self.turn

    fake = FakeLLM()
    monkeypatch.setattr(llm, "complete_structured", fake)
    return fake


def chat(client, **overrides):
    body = {"template_id": "mutual-nda", "messages": [USER_MESSAGE], "values": {}, **overrides}
    return client.post("/api/chat", json=body)


def test_catalog_loads_every_template():
    catalog = load_catalog()
    assert len(catalog) == 10
    assert "effective_date" in {field.name for field in catalog["mutual-nda"].fields}


def test_chat_returns_reply_and_updates(client, fake_llm):
    fake_llm.turn = ChatTurn(
        reply="Got it.",
        field_updates=[
            FieldUpdate(name="party_a_name", value="Acme Corp"),
            FieldUpdate(name="party_b_name", value="Globex LLC"),
        ],
    )

    response = chat(client)

    assert response.status_code == 200
    assert response.json() == {
        "reply": "Got it.",
        "updates": {"party_a_name": "Acme Corp", "party_b_name": "Globex LLC"},
    }


def test_chat_sends_system_prompt_then_conversation(client, fake_llm):
    chat(client, values={"party_a_name": "Acme Corp"})

    (messages,) = fake_llm.calls
    assert messages[0]["role"] == "system"
    assert "Mutual Non-Disclosure Agreement" in messages[0]["content"]
    assert '"party_a_name": "Acme Corp"' in messages[0]["content"]
    assert messages[1:] == [USER_MESSAGE]


def test_chat_unknown_template(client, fake_llm):
    assert chat(client, template_id="lease-for-mars").status_code == 404


def test_chat_requires_messages(client, fake_llm):
    assert chat(client, messages=[]).status_code == 422


def test_chat_reports_llm_failure(client, monkeypatch):
    def fail(messages, response_model):
        raise RuntimeError("provider down")

    monkeypatch.setattr(llm, "complete_structured", fail)

    response = chat(client)

    assert response.status_code == 502
    assert "provider down" not in response.text


def test_system_prompt_lists_fields_with_types_options_and_defaults():
    contractor = load_catalog()["independent-contractor-agreement"]

    prompt = build_system_prompt(contractor, {}, date(2026, 10, 23))

    assert "Today's date is 2026-10-23" in prompt
    assert "- compensation_amount (currency, required): Compensation amount" in prompt
    assert '"per hour" | "per day"' in prompt
    assert "default: 30" in prompt


def test_apply_updates_keeps_valid_values():
    updates = apply_updates(
        NDA,
        [
            FieldUpdate(name="effective_date", value="2026-10-24"),
            FieldUpdate(name="term_years", value=" 5 "),
            FieldUpdate(name="governing_law", value="California"),
        ],
    )
    assert updates == {"effective_date": "2026-10-24", "term_years": "5", "governing_law": "California"}


def test_apply_updates_drops_invalid_values():
    updates = apply_updates(
        NDA,
        [
            FieldUpdate(name="not_a_field", value="x"),
            FieldUpdate(name="effective_date", value="next Tuesday"),
            FieldUpdate(name="term_years", value="two"),
            FieldUpdate(name="party_a_name", value="   "),
        ],
    )
    assert updates == {}


def test_apply_updates_matches_select_options_case_insensitively():
    contractor = load_catalog()["independent-contractor-agreement"]

    assert apply_updates(contractor, [FieldUpdate(name="invoice_frequency", value="Monthly")]) == {
        "invoice_frequency": "monthly"
    }
    assert apply_updates(contractor, [FieldUpdate(name="invoice_frequency", value="yearly")]) == {}


@pytest.mark.skipif(
    not os.getenv("PRELEGAL_LIVE_LLM_TESTS"), reason="set PRELEGAL_LIVE_LLM_TESTS=1 to call the real LLM"
)
def test_live_llm_extracts_fields(client):
    response = chat(
        client,
        messages=[
            {"role": "user", "content": "An NDA between Acme Corp and Globex LLC under California law."}
        ],
    )

    assert response.status_code == 200, response.text
    updates = response.json()["updates"]
    assert updates.get("party_a_name") == "Acme Corp"
    assert updates.get("party_b_name") == "Globex LLC"
