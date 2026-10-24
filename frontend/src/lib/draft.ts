// The document being drafted, and how each chat reply changes it.
// Kept free of Next.js/React imports so it can be unit tested with `node --test`.

import type { ChatReply } from "./api";
import { initialValues, type FieldValues, type Template } from "./template.ts";

export interface Draft {
  /** The chosen template, or null until the assistant has worked out which document is needed. */
  templateId: string | null;
  values: FieldValues;
}

export const EMPTY_DRAFT: Draft = { templateId: null, values: {} };

/**
 * Applies the assistant's reply. Switching to another document starts from that
 * document's defaults, since field names differ between templates.
 */
export function applyReply(draft: Draft, reply: ChatReply, templates: Template[]): Draft {
  if (reply.template_id === draft.templateId) {
    return { ...draft, values: { ...draft.values, ...reply.updates } };
  }
  const template = templates.find((t) => t.id === reply.template_id);
  if (!template) return draft;
  return {
    templateId: template.id,
    values: { ...initialValues(template.fields), ...reply.updates },
  };
}

/** A title for the saved document, e.g. "Mutual Non-Disclosure Agreement: Acme Corp & Globex LLC". */
export function documentTitle(template: Template, values: FieldValues): string {
  const parties = template.fields
    // Party names, e.g. party_a_name or tenant_names, but not the people signing for them.
    .filter((field) => /_names?$/.test(field.name) && !field.name.includes("signatory"))
    .map((field) => values[field.name]?.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parties.length ? `${template.title}: ${parties.join(" & ")}` : template.title;
}
