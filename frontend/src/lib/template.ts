// Pure helpers for filling a catalog template (see data/templates/README.md).
// Kept free of Next.js/React imports so they can be unit tested with `node --test`.

export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "currency"
  | "email"
  | "url"
  | "select";

export interface TemplateField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  default?: string | number;
  options?: string[];
  description?: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  fields: TemplateField[];
  body: string;
}

export type FieldValues = Record<string, string>;

const PLACEHOLDER_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
const MARKDOWN_SPECIAL_RE = /[\\`*_[\]{}<>#|~]/g;

export function initialValues(fields: TemplateField[]): FieldValues {
  return Object.fromEntries(
    fields.map((field) => [field.name, field.default?.toString() ?? ""]),
  );
}

export function missingRequiredFields(
  fields: TemplateField[],
  values: FieldValues,
): TemplateField[] {
  return fields.filter(
    (field) => field.required && !values[field.name]?.trim(),
  );
}

/** Formats a raw form value for display inside the document text. */
export function formatValue(field: TemplateField, raw: string): string {
  const value = raw.trim();
  if (field.type === "date") {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        timeZone: "UTC",
        dateStyle: "long",
      });
    }
  }
  if (field.type === "textarea") {
    // Placeholders sit inline in sentences, so multi-line input becomes one line.
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", ");
  }
  return value;
}

function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIAL_RE, "\\$&");
}

/**
 * Replaces every {{placeholder}} in the template body with the user's value.
 * Empty fields are rendered with `renderMissing` so callers can mark them.
 */
export function fillTemplate(
  template: Template,
  values: FieldValues,
  renderMissing: (field: TemplateField) => string = (field) =>
    `\\[${escapeMarkdown(field.label)}\\]`,
): string {
  const fieldsByName = new Map(template.fields.map((f) => [f.name, f]));
  return template.body.replace(PLACEHOLDER_RE, (match, name: string) => {
    const field = fieldsByName.get(name);
    if (!field) return match;
    const value = formatValue(field, values[name] ?? "");
    return value ? escapeMarkdown(value) : renderMissing(field);
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
