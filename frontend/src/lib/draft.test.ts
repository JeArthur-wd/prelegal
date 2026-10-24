import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyReply, documentTitle, EMPTY_DRAFT, type Draft } from "./draft.ts";
import type { Template } from "./template.ts";

const nda: Template = {
  id: "mutual-nda",
  title: "Mutual NDA",
  description: "",
  body: "",
  fields: [
    { name: "party_a_name", label: "Party A", type: "text", required: true },
    { name: "party_a_signatory_name", label: "Signatory", type: "text", required: false, default: "" },
    { name: "party_b_name", label: "Party B", type: "text", required: true },
    { name: "party_c_name", label: "Party C", type: "text", required: false, default: "" },
    { name: "term_years", label: "Term", type: "number", required: true, default: 2 },
  ],
};

const sale: Template = {
  id: "bill-of-sale",
  title: "Bill of Sale",
  description: "",
  body: "",
  fields: [
    { name: "purchase_price", label: "Price", type: "currency", required: true },
    { name: "payment_method", label: "Paid by", type: "text", required: true, default: "cash" },
  ],
};

const templates = [nda, sale];

describe("applyReply", () => {
  it("keeps no document while the assistant is still asking", () => {
    const draft = applyReply(EMPTY_DRAFT, { reply: "What do you need?", template_id: null, updates: {} }, templates);
    assert.deepEqual(draft, EMPTY_DRAFT);
  });

  it("starts a chosen document from its defaults plus the updates", () => {
    const draft = applyReply(
      EMPTY_DRAFT,
      { reply: "", template_id: "mutual-nda", updates: { party_a_name: "Acme" } },
      templates,
    );
    assert.deepEqual(draft, {
      templateId: "mutual-nda",
      values: {
        party_a_name: "Acme",
        party_a_signatory_name: "",
        party_b_name: "",
        party_c_name: "",
        term_years: "2",
      },
    });
  });

  it("merges updates into the current document", () => {
    const current: Draft = { templateId: "mutual-nda", values: { party_a_name: "Acme", term_years: "2" } };
    const draft = applyReply(current, { reply: "", template_id: "mutual-nda", updates: { term_years: "5" } }, templates);
    assert.deepEqual(draft.values, { party_a_name: "Acme", term_years: "5" });
  });

  it("drops the old document's values when switching", () => {
    const current: Draft = { templateId: "mutual-nda", values: { party_a_name: "Acme", term_years: "2" } };
    const draft = applyReply(
      current,
      { reply: "", template_id: "bill-of-sale", updates: { purchase_price: "$900" } },
      templates,
    );
    assert.deepEqual(draft, {
      templateId: "bill-of-sale",
      values: { purchase_price: "$900", payment_method: "cash" },
    });
  });

  it("ignores a document it doesn't know", () => {
    const current: Draft = { templateId: "mutual-nda", values: { party_a_name: "Acme" } };
    assert.equal(applyReply(current, { reply: "", template_id: "unknown", updates: {} }, templates), current);
  });
});

describe("documentTitle", () => {
  it("names the document after its first two parties, not their signatories", () => {
    assert.equal(
      documentTitle(nda, {
        party_a_name: "Acme",
        party_a_signatory_name: "Jane Doe",
        party_b_name: " Globex ",
        party_c_name: "Initech",
      }),
      "Mutual NDA: Acme & Globex",
    );
  });

  it("skips parties that haven't been given yet", () => {
    assert.equal(documentTitle(nda, { party_a_name: "", party_b_name: "Globex" }), "Mutual NDA: Globex");
  });

  it("falls back to the document title", () => {
    assert.equal(documentTitle(nda, {}), "Mutual NDA");
  });
});
