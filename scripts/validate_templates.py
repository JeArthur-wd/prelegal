"""Validate the legal template dataset in data/templates.

Checks that catalog.json is well formed and that every template's
{{placeholders}} match the fields declared for it in the catalog.

Usage: python scripts/validate_templates.py
"""

import json
import re
import sys
from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "data" / "templates"
PLACEHOLDER_RE = re.compile(r"\{\{\s*([^{}]*?)\s*\}\}")
FIELD_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")
TEMPLATE_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def validate(templates_dir: Path = TEMPLATES_DIR) -> list[str]:
    errors: list[str] = []
    catalog = json.loads((templates_dir / "catalog.json").read_text(encoding="utf-8"))
    field_types = set(catalog["field_types"])
    seen_ids: set[str] = set()
    catalogued_files: set[Path] = set()

    for template in catalog["templates"]:
        tid = template.get("id", "<missing id>")
        for key in ("id", "title", "category", "description", "file", "fields"):
            if key not in template:
                errors.append(f"{tid}: missing '{key}'")
        if not TEMPLATE_ID_RE.match(tid):
            errors.append(f"{tid}: id must be kebab-case")
        if tid in seen_ids:
            errors.append(f"{tid}: duplicate id")
        seen_ids.add(tid)

        path = (templates_dir / template.get("file", "")).resolve()
        catalogued_files.add(path)
        if not path.is_file():
            errors.append(f"{tid}: file not found: {template.get('file')}")
            continue

        declared: set[str] = set()
        for field in template.get("fields", []):
            name = field.get("name", "<missing name>")
            if not FIELD_NAME_RE.match(name):
                errors.append(f"{tid}.{name}: field name must be snake_case")
            if name in declared:
                errors.append(f"{tid}.{name}: duplicate field")
            declared.add(name)
            if "label" not in field:
                errors.append(f"{tid}.{name}: missing 'label'")
            if field.get("type") not in field_types:
                errors.append(f"{tid}.{name}: unknown type {field.get('type')!r}")
            if not isinstance(field.get("required"), bool):
                errors.append(f"{tid}.{name}: 'required' must be a boolean")
            if field.get("type") == "select":
                options = field.get("options")
                if not options:
                    errors.append(f"{tid}.{name}: select field needs 'options'")
                elif "default" in field and field["default"] not in options:
                    errors.append(f"{tid}.{name}: default is not one of the options")
            if not field.get("required") and "default" not in field:
                errors.append(f"{tid}.{name}: optional field needs a 'default'")

        used = set(PLACEHOLDER_RE.findall(path.read_text(encoding="utf-8")))
        for name in sorted(used - declared):
            errors.append(f"{tid}: placeholder {{{{{name}}}}} is not declared in the catalog")
        for name in sorted(declared - used):
            errors.append(f"{tid}: field '{name}' is never used in the template")

    for path in sorted((templates_dir / "documents").glob("*.md")):
        if path.resolve() not in catalogued_files:
            errors.append(f"{path.name}: template file is not listed in the catalog")

    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("Template dataset is invalid:")
        for error in errors:
            print(f"  - {error}")
        return 1
    print("Template dataset is valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
