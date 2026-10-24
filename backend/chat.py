"""AI chat that works out which document the user needs and fills in its fields."""

import json
import logging
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import llm
from auth import current_user
from templates import Template, TemplateField, load_catalog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"], dependencies=[Depends(current_user)])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    template_id: str | None = None
    messages: list[ChatMessage] = Field(min_length=1)
    values: dict[str, str] = {}


class ChatResponse(BaseModel):
    reply: str
    template_id: str | None
    updates: dict[str, str]


class FieldUpdate(BaseModel):
    name: str
    value: str


class ChatTurn(BaseModel):
    """What the model must return each turn."""

    reply: str
    document_id: str | None
    field_updates: list[FieldUpdate]


def describe_field(field: TemplateField) -> str:
    details = [field.type, "required" if field.required else "optional"]
    if field.options:
        details.append("one of: " + " | ".join(f'"{option}"' for option in field.options))
    if field.default is not None:
        details.append(f"default: {field.default}")
    line = f"- {field.name} ({', '.join(details)}): {field.label}"
    return f"{line}. {field.description}" if field.description else line


def describe_catalog() -> str:
    return "\n".join(
        f"- {template.id}: {template.title}. {template.description}"
        for template in load_catalog().values()
    )


def build_system_prompt(template: Template | None, values: dict[str, str], today: date) -> str:
    intro = f"""You are Prelegal's assistant. You help users draft legal documents from Prelegal's templates.
Today's date is {today.isoformat()}.

These are the only documents Prelegal can generate (id: title. description):
{describe_catalog()}

Rules for choosing the document:
- document_id must always be one of the ids above or null. Never invent an id.
- If the user wants a document that is not in the list, say plainly that Prelegal can't generate it, suggest the closest document from the list (explaining briefly how it differs), and ask whether they want that instead.
- Only set document_id to a new document once the user has asked for it or agreed to your suggestion.
- You are not a lawyer: if asked for legal advice, say documents are drafts that should be reviewed by a qualified lawyer.
- Keep replies short and friendly."""

    if template is None:
        return f"""{intro}

No document has been chosen yet. Find out what the user needs, recommend the right document, and set document_id when they confirm. Leave field_updates empty."""

    fields = "\n".join(describe_field(field) for field in template.fields)
    current = {name: value for name, value in values.items() if value.strip()}
    return f"""{intro}

The user is drafting: {template.title} (id: {template.id}). Keep document_id set to "{template.id}" unless the user asks to switch to a different document.

Fields to fill in:
{fields}

Current values (JSON):
{json.dumps(current, indent=2)}

How to fill in the document:
- Ask about one or two missing fields at a time, starting with the most important.
- Whenever the user gives information (including earlier in the conversation), record it in field_updates using the exact field names above. Only record what the user said or clearly confirmed; never invent names, addresses or amounts.
- Formats: dates as YYYY-MM-DD (resolve relative dates such as "tomorrow" using today's date); numbers as plain digits without units; currency amounts with their symbol or code, e.g. "$5,000"; select fields must use one of the listed options exactly.
- Fields with a default already have a value. Mention the default once and let the user change it.
- The user may correct earlier answers; update the field when they do.
- When every required field has a value, briefly summarise the key terms, tell the user the document is ready to download from the preview, and offer to change anything."""


def clean_update(field: TemplateField, value: str) -> str | None:
    """Normalise a value proposed by the model, or return None if it is not valid for the field."""
    value = value.strip()
    if not value:
        return None
    if field.type == "select":
        options = {option.lower(): option for option in field.options or []}
        return options.get(value.lower())
    if field.type == "date":
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            return None
    if field.type == "number":
        try:
            float(value.replace(",", ""))
        except ValueError:
            return None
        return value.replace(",", "")
    return value


def apply_updates(template: Template, updates: list[FieldUpdate]) -> dict[str, str]:
    fields = {field.name: field for field in template.fields}
    cleaned: dict[str, str] = {}
    for update in updates:
        field = fields.get(update.name)
        value = clean_update(field, update.value) if field else None
        if value is None:
            logger.info("Dropped invalid field update %r=%r", update.name, update.value)
        else:
            cleaned[update.name] = value
    return cleaned


def ask(template: Template | None, values: dict[str, str], messages: list[ChatMessage]) -> ChatTurn:
    prompt = build_system_prompt(template, values, date.today())
    return llm.complete_structured(
        [{"role": "system", "content": prompt}, *(message.model_dump() for message in messages)],
        ChatTurn,
    )


@router.post("", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    catalog = load_catalog()
    if body.template_id is not None and body.template_id not in catalog:
        raise HTTPException(status_code=404, detail="Unknown document type")
    template = catalog.get(body.template_id) if body.template_id else None

    try:
        turn = ask(template, body.values, body.messages)
        chosen = catalog.get(turn.document_id) if turn.document_id else None
        if chosen is not None and chosen is not template:
            # The model has just picked a document, so it hasn't seen that document's fields.
            # Ask again with them, so the reply and updates fit the chosen document.
            template = chosen
            turn = ask(template, {}, body.messages)
    except Exception:
        logger.exception("LLM call failed")
        raise HTTPException(
            status_code=502,
            detail="The AI assistant is unavailable right now. Please try again.",
        )

    return ChatResponse(
        reply=turn.reply,
        template_id=template.id if template else None,
        updates=apply_updates(template, turn.field_updates) if template else {},
    )
