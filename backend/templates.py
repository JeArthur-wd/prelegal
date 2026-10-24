"""Read-only access to the template catalog in data/templates (see its README)."""

import json
import os
from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

TEMPLATES_DIR = Path(
    os.getenv("PRELEGAL_TEMPLATES_DIR", Path(__file__).parent.parent / "data" / "templates")
)

FieldType = Literal["text", "textarea", "date", "number", "currency", "email", "url", "select"]


class TemplateField(BaseModel):
    name: str
    label: str
    type: FieldType
    required: bool
    default: str | int | float | None = None
    options: list[str] | None = None
    description: str | None = None


class Template(BaseModel):
    id: str
    title: str
    category: str
    description: str
    file: str
    fields: list[TemplateField]


@cache
def load_catalog() -> dict[str, Template]:
    catalog = json.loads((TEMPLATES_DIR / "catalog.json").read_text(encoding="utf-8"))
    templates = (Template.model_validate(entry) for entry in catalog["templates"])
    return {template.id: template for template in templates}
