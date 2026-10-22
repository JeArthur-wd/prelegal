import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  fillTemplate,
  formatValue,
  initialValues,
  missingRequiredFields,
  slugify,
  type Template,
  type TemplateField,
} from "./template.ts";

const nameField: TemplateField = {
  name: "party_name",
  label: "Party name",
  type: "text",
  required: true,
};
const dateField: TemplateField = {
  name: "effective_date",
  label: "Effective date",
  type: "date",
  required: true,
};
const termField: TemplateField = {
  name: "term_years",
  label: "Term",
  type: "number",
  required: true,
  default: 2,
};

const template: Template = {
  id: "test",
  title: "Test",
  description: "",
  fields: [nameField, dateField, termField],
  body: "{{party_name}} agrees on {{effective_date}} for {{term_years}} years. {{party_name}}. {{unknown}}",
};

describe("initialValues", () => {
  it("uses catalog defaults and blanks", () => {
    assert.deepEqual(initialValues(template.fields), {
      party_name: "",
      effective_date: "",
      term_years: "2",
    });
  });
});

describe("missingRequiredFields", () => {
  it("lists required fields that are empty or whitespace", () => {
    const missing = missingRequiredFields(template.fields, {
      party_name: "  ",
      effective_date: "2026-10-21",
      term_years: "2",
    });
    assert.deepEqual(missing, [nameField]);
  });
});

describe("formatValue", () => {
  it("formats ISO dates without timezone drift", () => {
    assert.equal(formatValue(dateField, "2026-01-01"), "January 1, 2026");
  });

  it("joins multi-line textarea input onto one line", () => {
    const field: TemplateField = { ...nameField, type: "textarea" };
    assert.equal(formatValue(field, "1 Main St\r\n\n  Springfield "), "1 Main St, Springfield");
  });
});

describe("fillTemplate", () => {
  it("fills every occurrence and leaves unknown placeholders untouched", () => {
    const filled = fillTemplate(template, {
      party_name: "Acme Ltd",
      effective_date: "2026-10-21",
      term_years: "3",
    });
    assert.equal(
      filled,
      "Acme Ltd agrees on October 21, 2026 for 3 years. Acme Ltd. {{unknown}}",
    );
  });

  it("marks missing fields with their label", () => {
    const filled = fillTemplate(template, { term_years: "2" });
    assert.match(filled, /^\\\[Party name\\\] agrees on \\\[Effective date\\\]/);
  });

  it("supports a custom missing-field renderer", () => {
    const filled = fillTemplate(template, {}, (f) => `<${f.name}>`);
    assert.match(filled, /^<party_name> agrees on <effective_date> for <term_years>/);
  });

  it("escapes markdown in user input", () => {
    const filled = fillTemplate(template, { party_name: "*Bold* [link]" });
    assert.match(filled, /^\\\*Bold\\\* \\\[link\\\] agrees/);
  });

  it("fills the real mutual NDA template with no placeholders left", () => {
    const templatesDir = path.join(process.cwd(), "..", "data", "templates");
    const catalog = JSON.parse(readFileSync(path.join(templatesDir, "catalog.json"), "utf-8"));
    const entry = catalog.templates.find((t: { id: string }) => t.id === "mutual-nda");
    const nda: Template = {
      ...entry,
      body: readFileSync(path.join(templatesDir, entry.file), "utf-8"),
    };
    const values = Object.fromEntries(
      nda.fields.map((f) => [f.name, f.type === "date" ? "2026-10-21" : "x"]),
    );
    assert.doesNotMatch(fillTemplate(nda, values), /\{\{/);
  });
});

describe("slugify", () => {
  it("produces a filename-safe slug", () => {
    assert.equal(slugify("  Acme, Inc. & Co! "), "acme-inc-co");
  });
});
