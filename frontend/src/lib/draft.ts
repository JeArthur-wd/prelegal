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
