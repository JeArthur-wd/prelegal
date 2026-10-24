"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import ChatPanel from "@/components/ChatPanel";
import {
  createDocument,
  postChat,
  updateDocument,
  type ChatMessage,
  type SavedDocument,
} from "@/lib/api";
import { applyReply, documentTitle, EMPTY_DRAFT, type Draft } from "@/lib/draft";
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

type SaveState = "idle" | "saving" | "saved" | "error";

export default function DocumentCreator({
  templates,
  document,
  onSaved,
  onError,
}: {
  templates: Template[];
  /** A previously saved document to continue, or null for a new one. */
  document: SavedDocument | null;
  onSaved: (document: SavedDocument) => void;
  /** Reports an API error (e.g. an expired session) and returns a message to show. */
  onError: (error: unknown) => string;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    document ? { templateId: document.template_id, values: document.values } : EMPTY_DRAFT,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    document?.messages.length ? document.messages : [GREETING],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(document ? "saved" : "idle");
  const documentId = useRef<number | null>(document?.id ?? null);

  const template = templates.find((t) => t.id === draft.templateId) ?? null;
  const preview = useMemo(
    () => (template ? fillTemplate(template, draft.values, renderMissingForPreview) : ""),
    [template, draft.values],
  );
  const missing = template ? missingRequiredFields(template.fields, draft.values) : [];
  const required = template ? template.fields.filter((field) => field.required).length : 0;
  const isComplete = template !== null && missing.length === 0;

  /** Saves the document once the assistant has chosen which one it is. */
  async function save(next: Draft, history: ChatMessage[]) {
    const nextTemplate = templates.find((t) => t.id === next.templateId);
    if (!nextTemplate) return;
    const input = {
      template_id: nextTemplate.id,
      title: documentTitle(nextTemplate, next.values),
      values: next.values,
      messages: history,
    };
    setSaveState("saving");
    try {
      const saved = documentId.current
        ? await updateDocument(documentId.current, input)
        : await createDocument(input);
      documentId.current = saved.id;
      setSaveState("saved");
      onSaved(saved);
    } catch (err) {
      onError(err);
      setSaveState("error");
    }
  }

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
      const next = applyReply(draft, reply, templates);
      const withReply: ChatMessage[] = [...history, { role: "assistant", content: reply.reply }];
      setDraft(next);
      setMessages(withReply);
      await save(next, withReply);
    } catch (err) {
      setError(onError(err));
    } finally {
      setPending(false);
    }
  }

  function download() {
    if (!template) return;
    const blob = new Blob([fillTemplate(template, draft.values)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${template.id}.md`;
    window.document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block">
      <div className="flex h-[75vh] flex-col gap-3 xl:sticky xl:top-20 xl:h-[calc(100vh-10rem)] print:hidden">
        <ChatPanel
          messages={messages}
          pending={pending}
          error={error}
          onSend={(text) => converse([...messages, { role: "user", content: text }])}
          onRetry={() => converse(messages)}
        />
        <SaveStatus state={saveState} />
      </div>

      {template ? (
        <section aria-label={`${template.title} preview`} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-navy">
                <span className="truncate">{template.title}</span>
                <span className="rounded bg-brand-yellow/20 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-navy">
                  Draft
                </span>
              </h2>
              <Progress done={required - missing.length} total={required} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={download}
                disabled={!isComplete}
                title={isComplete ? undefined : "Available once every required field is filled in"}
                className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Download (.md)
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!isComplete}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Print / PDF
              </button>
            </div>
          </div>
          <article className="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-8 font-serif shadow-sm prose-headings:font-sans prose-headings:text-brand-navy prose-code:rounded prose-code:bg-brand-yellow/25 prose-code:px-1 prose-code:py-0.5 prose-code:font-sans prose-code:font-normal prose-code:text-brand-navy prose-code:before:content-none prose-code:after:content-none sm:p-12 print:border-0 print:p-0 print:shadow-none">
            <ReactMarkdown>{preview}</ReactMarkdown>
          </article>
        </section>
      ) : (
        <SupportedDocuments templates={templates} />
      )}
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="Required fields completed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-brand-blue transition-all"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
      <span className="text-xs text-slate-600" aria-live="polite">
        {done === total
          ? "All required fields complete"
          : `${done} of ${total} required fields complete`}
      </span>
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  const text = {
    idle: "Your document is saved automatically once the assistant knows which one you need.",
    saving: "Saving…",
    saved: "All changes saved",
    error: "Couldn't save. We'll try again after your next message.",
  }[state];
  return (
    <p
      aria-live="polite"
      className={`text-xs ${state === "error" ? "text-red-700" : "text-brand-gray"}`}
    >
      {state === "saved" && <span aria-hidden>✓ </span>}
      {text}
    </p>
  );
}

function SupportedDocuments({ templates }: { templates: Template[] }) {
  return (
    <section
      aria-label="Documents Prelegal can draft"
      className="rounded-lg border border-dashed border-slate-300 bg-white p-8 print:hidden"
    >
      <h2 className="text-lg font-semibold text-brand-navy">Your document will appear here</h2>
      <p className="mt-1 text-sm text-slate-600">
        Tell the assistant what you need. Prelegal can currently draft:
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <li key={t.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-medium text-brand-navy">{t.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{t.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
