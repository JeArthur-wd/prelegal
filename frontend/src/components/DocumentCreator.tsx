"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import ChatPanel from "@/components/ChatPanel";
import { postChat, type ChatMessage } from "@/lib/api";
import {
  fillTemplate,
  initialValues,
  missingRequiredFields,
  type FieldValues,
  type Template,
  type TemplateField,
} from "@/lib/template";

// In the preview, missing fields render as inline code, which is styled as a highlight.
const renderMissingForPreview = (field: TemplateField) => `\`${field.label}\``;

function greeting(template: Template): ChatMessage {
  return {
    role: "assistant",
    content: `Hi! I'll help you draft a **${template.title}**. Tell me a bit about the agreement, or just answer my questions as we go.\n\nTo start: who are the two parties?`,
  };
}

export default function DocumentCreator({ template }: { template: Template }) {
  const [values, setValues] = useState<FieldValues>(() => initialValues(template.fields));
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting(template)]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () => fillTemplate(template, values, renderMissingForPreview),
    [template, values],
  );
  const missing = missingRequiredFields(template.fields, values);
  const isComplete = missing.length === 0;

  /** Sends the conversation (ending with the user's latest message) to the assistant. */
  async function converse(history: ChatMessage[]) {
    setMessages(history);
    setPending(true);
    setError(null);
    try {
      const { reply, updates } = await postChat({
        template_id: template.id,
        messages: history,
        values,
      });
      setValues((current) => ({ ...current, ...updates }));
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    setValues(initialValues(template.fields));
    setMessages([greeting(template)]);
    setError(null);
  }

  function download() {
    const blob = new Blob([fillTemplate(template, values)], {
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
            {isComplete
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

      <article
        aria-label={`${template.title} preview`}
        className="prose prose-stone max-w-none rounded-lg border border-stone-200 bg-white p-8 font-serif shadow-sm prose-headings:font-sans prose-code:rounded prose-code:bg-amber-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-sans prose-code:font-normal prose-code:text-amber-900 prose-code:before:content-none prose-code:after:content-none sm:p-12 print:border-0 print:p-0 print:shadow-none"
      >
        <ReactMarkdown>{preview}</ReactMarkdown>
      </article>
    </div>
  );
}
