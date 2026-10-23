"""AI chat that fills in a document's fields through conversation."""

import json
import logging
from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import llm
from templates import Template, TemplateField, load_catalog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    template_id: str
    messages: list[ChatMessage] = Field(min_length=1)
    values: dict[str, str] = {}


class ChatResponse(BaseModel):
    reply: str
    updates: dict[str, str]


class FieldUpdate(BaseModel):
    name: str
    value: str


class ChatTurn(BaseModel):
    """What the model must return each turn."""

    reply: str
    field_updates: list[FieldUpdate]


def describe_field(field: TemplateField) -> str:
    details = [field.type, "required" if field.required else "optional"]
    if field.options:
        details.append("one of: " + " | ".join(f'"{option}"' for option in field.options))
    if field.default is not None:
        details.append(f"default: {field.default}")
    line = f"- {field.name} ({', '.join(details)}): {field.label}"
    return f"{line}. {field.description}" if field.description else line


def build_system_prompt(template: Template, values: dict[str, str], today: date) -> str:
    fields = "\n".join(describe_field(field) for field in template.fields)
    current = {name: value for name, value in values.items() if value.strip()}
    return f"""You are Prelegal's assistant, helping the user draft a {template.title}.
About this document: {template.description}
Today's date is {today.isoformat()}.

Fields to fill in:
{fields}

Current values (JSON):
{json.dumps(current, indent=2)}

How to work:
- Have a friendly, natural conversation. Ask about one or two missing fields at a time, starting with the most important.
- Whenever the user gives information, record it in field_updates using the exact field names above. Only record what the user said or clearly confirmed; never invent names, addresses or amounts.
- Formats: dates as YYYY-MM-DD (resolve relative dates such as "tomorrow" using today's date); numbers as plain digits without units; currency amounts with their symbol or code, e.g. "$5,000"; select fields must use one of the listed options exactly.
- Fields with a default already have a value. Mention the default once and let the user change it.
- The user may correct earlier answers; update the field when they do.
- When every required field has a value, briefly summarise the key terms, tell the user the document is ready to download from the preview, and offer to change anything.
- Keep replies short. You are not a lawyer: if asked for legal advice, say the document is a draft that should be reviewed by a qualified lawyer.
- Stay on the topic of this document."""


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


@router.post("", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    template = load_catalog().get(body.template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Unknown document type")

    messages = [
        {"role": "system", "content": build_system_prompt(template, body.values, date.today())},
        *(message.model_dump() for message in body.messages),
    ]
    try:
        turn = llm.complete_structured(messages, ChatTurn)
    except Exception:
        logger.exception("LLM call failed")
        raise HTTPException(
            status_code=502,
            detail="The AI assistant is unavailable right now. Please try again.",
        )

    return ChatResponse(reply=turn.reply, updates=apply_updates(template, turn.field_updates))
