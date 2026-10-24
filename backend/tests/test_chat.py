import os
from datetime import date

import pytest

import llm
from chat import ChatTurn, FieldUpdate, apply_updates, build_system_prompt
from templates import load_catalog
from tests.conftest import signup

NDA = load_catalog()["mutual-nda"]
USER_MESSAGE = {"role": "user", "content": "Acme Corp and Globex LLC, starting tomorrow."}


def turn(reply="Thanks!", document_id=None, **updates):
    return ChatTurn(
        reply=reply,
        document_id=document_id,
        field_updates=[FieldUpdate(name=name, value=value) for name, value in updates.items()],
    )


@pytest.fixture
def client(client):
    """Chat requires a signed-in user."""
    signup(client)
    return client


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace the LLM with a stub that returns queued turns and records the prompts it receives."""

    class FakeLLM:
        def __init__(self):
            self.turns: list[ChatTurn] = []
            self.calls: list[list[dict[str, str]]] = []

        def __call__(self, messages, response_model):
            assert response_model is ChatTurn
            self.calls.append(messages)
            return self.turns.pop(0) if self.turns else turn(document_id="mutual-nda")

        @property
        def system_prompts(self):
            return [messages[0]["content"] for messages in self.calls]

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
    fake_llm.turns = [
        turn("Got it.", "mutual-nda", party_a_name="Acme Corp", party_b_name="Globex LLC")
    ]

    response = chat(client)

    assert response.status_code == 200
    assert response.json() == {
        "reply": "Got it.",
        "template_id": "mutual-nda",
        "updates": {"party_a_name": "Acme Corp", "party_b_name": "Globex LLC"},
    }
    assert len(fake_llm.calls) == 1


def test_chat_sends_system_prompt_then_conversation(client, fake_llm):
    chat(client, values={"party_a_name": "Acme Corp"})

    (messages,) = fake_llm.calls
    assert messages[0]["role"] == "system"
    assert "The user is drafting: Mutual Non-Disclosure Agreement" in messages[0]["content"]
    assert '"party_a_name": "Acme Corp"' in messages[0]["content"]
    assert messages[1:] == [USER_MESSAGE]


def test_chat_without_a_document_lets_the_model_choose(client, fake_llm):
    fake_llm.turns = [turn("Which kind of NDA?", None)]

    response = chat(client, template_id=None)

    assert response.json() == {"reply": "Which kind of NDA?", "template_id": None, "updates": {}}
    assert "No document has been chosen yet" in fake_llm.system_prompts[0]


def test_choosing_a_document_asks_again_with_its_fields(client, fake_llm):
    fake_llm.turns = [
        turn("Sure, a bill of sale.", "bill-of-sale", party_a_name="ignored"),
        turn("Great, who is the seller?", "bill-of-sale", purchase_price="$900"),
    ]

    response = chat(client, template_id=None, values={"party_a_name": "Acme Corp"})

    assert response.json() == {
        "reply": "Great, who is the seller?",
        "template_id": "bill-of-sale",
        "updates": {"purchase_price": "$900"},
    }
    first, second = fake_llm.system_prompts
    assert "No document has been chosen yet" in first
    assert "The user is drafting: Bill of Sale" in second
    # Values belonged to the previous document, so the new prompt starts empty.
    assert "Acme Corp" not in second


def test_switching_documents_mid_conversation(client, fake_llm):
    fake_llm.turns = [turn("Switching.", "unilateral-nda"), turn("Who is disclosing?", "unilateral-nda")]

    response = chat(client, values={"party_a_name": "Acme Corp"})

    assert response.json()["template_id"] == "unilateral-nda"
    assert len(fake_llm.calls) == 2


def test_unknown_document_from_model_is_ignored(client, fake_llm):
    fake_llm.turns = [turn("Here's your lease for Mars.", "lease-on-mars")]

    response = chat(client, template_id=None)

    assert response.json()["template_id"] is None
    assert len(fake_llm.calls) == 1


def test_model_cannot_unset_the_current_document(client, fake_llm):
    fake_llm.turns = [turn("Okay.", None, party_a_name="Acme Corp")]

    response = chat(client)

    assert response.json()["template_id"] == "mutual-nda"
    assert response.json()["updates"] == {"party_a_name": "Acme Corp"}


def test_chat_requires_sign_in(client, fake_llm):
    client.cookies.clear()
    assert chat(client).status_code == 401
    assert fake_llm.calls == []


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


def test_system_prompt_lists_catalog_and_unsupported_document_rule():
    prompt = build_system_prompt(None, {}, date(2026, 10, 23))

    assert "Today's date is 2026-10-23" in prompt
    for template in load_catalog().values():
        assert f"- {template.id}: {template.title}." in prompt
    assert "can't generate it, suggest the closest document" in prompt


def test_system_prompt_lists_fields_with_types_options_and_defaults():
    contractor = load_catalog()["independent-contractor-agreement"]

    prompt = build_system_prompt(contractor, {}, date(2026, 10, 23))

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


live = pytest.mark.skipif(
    not os.getenv("PRELEGAL_LIVE_LLM_TESTS"), reason="set PRELEGAL_LIVE_LLM_TESTS=1 to call the real LLM"
)


@live
def test_live_llm_chooses_document_and_extracts_fields(client):
    response = chat(
        client,
        template_id=None,
        messages=[
            {
                "role": "user",
                "content": "I need a mutual NDA between Acme Corp and Globex LLC under California law.",
            }
        ],
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["template_id"] == "mutual-nda"
    assert body["updates"].get("party_a_name") == "Acme Corp"


@live
def test_live_llm_offers_closest_document_for_unsupported_request(client):
    response = chat(
        client,
        template_id=None,
        messages=[{"role": "user", "content": "I need a commercial office lease for my company."}],
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["template_id"] is None
    assert "lease" in body["reply"].lower()
