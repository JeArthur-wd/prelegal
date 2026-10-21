# Legal Document Templates

A dataset of general-purpose legal document templates that Prelegal fills in and adapts for users.

> **Disclaimer:** These templates are general starting points, not legal advice. Laws vary by jurisdiction, and generated documents should be reviewed by a qualified lawyer before use.

## Layout

```
data/templates/
├── catalog.json        # Manifest: metadata + field definitions for every template
└── documents/          # One Markdown file per template
```

## Templates

| ID | Title | Category |
| --- | --- | --- |
| `mutual-nda` | Mutual Non-Disclosure Agreement | confidentiality |
| `unilateral-nda` | Non-Disclosure Agreement (One-Way) | confidentiality |
| `independent-contractor-agreement` | Independent Contractor Agreement | business |
| `employment-offer-letter` | Employment Offer Letter | employment |
| `residential-lease-agreement` | Residential Lease Agreement | real-estate |
| `bill-of-sale` | Bill of Sale | personal |
| `promissory-note` | Promissory Note | finance |
| `general-power-of-attorney` | General Power of Attorney | personal |
| `cease-and-desist-letter` | Cease and Desist Letter | disputes |
| `privacy-policy` | Privacy Policy | online |

## Template format

Templates are Markdown. Variable values are written as `{{field_name}}` placeholders (snake_case). The same placeholder may appear several times and is filled with the same value everywhere. Blank signature/date lines (`______`) are left for wet or electronic signing.

Markdown joins consecutive lines into one paragraph, so lines that must stay separate (signature blocks, letter address headers) are separated by a blank line.

## Catalog format

Each entry in `catalog.json` → `templates` has:

| Key | Description |
| --- | --- |
| `id` | Unique kebab-case identifier |
| `title` | Human-readable name |
| `category` | Grouping for browsing |
| `description` | When to use the document |
| `file` | Path to the template, relative to this directory |
| `fields` | The placeholders the template uses |

Each field has:

| Key | Description |
| --- | --- |
| `name` | Placeholder name, matching `{{name}}` in the template |
| `label` | Prompt to show the user |
| `type` | One of `text`, `textarea`, `date`, `number`, `currency`, `email`, `url`, `select` |
| `required` | Whether the user must supply a value |
| `default` | Value to use if none is given (mandatory for optional fields) |
| `options` | Allowed values (`select` fields only) |
| `description` | Optional help text / example |

## Adding or editing a template

1. Add or edit the Markdown file in `documents/`.
2. Add or update its entry in `catalog.json`, declaring every placeholder it uses.
3. Run the validator from the repository root:

   ```
   python scripts/validate_templates.py
   ```

   It checks that the catalog is well formed, that every placeholder is declared, that every declared field is used, that every template file is catalogued, and that no lines would be unintentionally joined when rendered.
