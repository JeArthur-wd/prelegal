"use client";

import { useState } from "react";

import type { DocumentSummary } from "@/lib/api";
import type { Template } from "@/lib/template";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function DocumentList({
  documents,
  templates,
  activeId,
  error,
  onOpen,
  onDelete,
}: {
  documents: DocumentSummary[] | null;
  templates: Template[];
  activeId: number | null;
  error: string | null;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const templateTitle = (id: string) => templates.find((t) => t.id === id)?.title ?? id;

  return (
    <section aria-labelledby="documents-heading" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <h2 id="documents-heading" className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-brand-navy">
        My documents
        {documents && documents.length > 0 && (
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {documents.length}
          </span>
        )}
      </h2>

      {error && (
        <p role="alert" className="mx-3 mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {documents === null ? (
        <p className="px-4 py-6 text-sm text-brand-gray" role="status">
          Loading…
        </p>
      ) : documents.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-600">
          No documents yet. Start chatting and your drafts are saved here automatically.
        </p>
      ) : (
        <ul className="max-h-[calc(100vh-14rem)] divide-y divide-slate-100 overflow-y-auto py-1">
          {documents.map((document) => {
            const active = document.id === activeId;
            const type = templateTitle(document.template_id);
            // Titles are "<type>: <parties>"; the type is shown on the second line instead.
            const name = document.title.startsWith(`${type}: `)
              ? document.title.slice(type.length + 2)
              : document.title;
            return (
              <li key={document.id} className={`group relative ${active ? "bg-brand-blue/5" : ""}`}>
                {active && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand-blue" />}
                <button
                  type="button"
                  onClick={() => onOpen(document.id)}
                  aria-current={active ? "true" : undefined}
                  className="block w-full px-4 py-3 pr-10 text-left hover:bg-slate-50"
                >
                  <span className="line-clamp-2 text-sm font-medium text-slate-900">{name}</span>
                  <span className="mt-0.5 block truncate text-xs text-brand-gray">
                    {type} · {dateFormat.format(new Date(document.updated_at))}
                  </span>
                </button>

                {confirmingId === document.id ? (
                  <div className="flex items-center gap-2 px-4 pb-3 text-xs">
                    <span className="text-slate-700">Delete this document?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(null);
                        onDelete(document.id);
                      }}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(document.id)}
                    aria-label={`Delete ${document.title}`}
                    className="absolute right-2 top-3 rounded p-1 text-slate-400 opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="size-4">
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
