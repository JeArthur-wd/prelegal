"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import ChatPanel from "@/components/ChatPanel";
import { postChat, type ChatMessage } from "@/lib/api";
import { applyReply, EMPTY_DRAFT, type Draft } from "@/lib/draft";
import {
  fillTemplate,
  missingRequiredFields,
  type Template,
  type TemplateField,
} from "@/lib/template";

// In the preview, missing fields render as inline code, which is styled as a highlight.
const renderMissingForPreview = (field: TemplateField) => `\`${field.label}\``;

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm the Prelegal assistant. Tell me what you need, for example *an NDA with a supplier* or *a lease for my apartment*, and I'll pick the right document and help you fill it in.",
};

export default function DocumentCreator({ templates }: { templates: Template[] }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === draft.templateId) ?? null;
  const preview = useMemo(
    () => (template ? fillTemplate(template, draft.values, renderMissingForPreview) : ""),
    [template, draft.values],
  );
  const missing = template ? missingRequiredFields(template.fields, draft.values) : [];
  const isComplete = template !== null && missing.length === 0;

  /** Sends the conversation (ending with the user's latest message) to the assistant. */
  async function converse(history: ChatMessage[]) {
    setMessages(history);
    setPending(true);
    setError(null);
    try {
      const reply = await postChat({
        template_id: draft.templateId,
        messages: history,
        values: draft.values,
      });
      setDraft((current) => applyReply(current, reply, templates));
      setMessages([...history, { role: "assistant", content: reply.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    setDraft(EMPTY_DRAFT);
    setMessages([GREETING]);
    setError(null);
  }

  function download() {
    if (!template) return;
    const blob = new Blob([fillTemplate(template, draft.values)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.id}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] print:block">
      <div className="flex h-[70vh] flex-col gap-3 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] print:hidden">
        <ChatPanel
          messages={messages}
          pending={pending}
          error={error}
          onSend={(text) => converse([...messages, { role: "user", content: text }])}
          onRetry={() => converse(messages)}
        />

        <div className="space-y-3">
          <p className="text-sm text-stone-600" aria-live="polite">
            {!template
              ? "No document chosen yet."
              : isComplete
                ? "All required fields are complete."
                : `${missing.length} required field${missing.length === 1 ? "" : "s"} left to fill in.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={download}
              disabled={!isComplete}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              Download (.md)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!isComplete}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-400"
            >
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={startOver}
              disabled={pending}
              className="px-2 py-2 text-sm text-stone-600 underline-offset-4 hover:underline disabled:cursor-not-allowed"
            >
              Start over
            </button>
          </div>
        </div>
      </div>

      {template ? (
        <article
          aria-label={`${template.title} preview`}
          className="prose prose-stone max-w-none rounded-lg border border-stone-200 bg-white p-8 font-serif shadow-sm prose-headings:font-sans prose-code:rounded prose-code:bg-amber-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-sans prose-code:font-normal prose-code:text-amber-900 prose-code:before:content-none prose-code:after:content-none sm:p-12 print:border-0 print:p-0 print:shadow-none"
        >
          <ReactMarkdown>{preview}</ReactMarkdown>
        </article>
      ) : (
        <SupportedDocuments templates={templates} />
      )}
    </div>
  );
}

function SupportedDocuments({ templates }: { templates: Template[] }) {
  return (
    <section
      aria-label="Documents Prelegal can draft"
      className="rounded-lg border border-dashed border-stone-300 bg-white p-8 print:hidden"
    >
      <h2 className="text-lg font-semibold text-stone-900">Your document will appear here</h2>
      <p className="mt-1 text-sm text-stone-600">
        Tell the assistant what you need. Prelegal can currently draft:
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <li key={t.id} className="rounded-md border border-stone-200 p-3">
            <p className="text-sm font-medium text-stone-900">{t.title}</p>
            <p className="mt-1 text-xs text-stone-600">{t.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
