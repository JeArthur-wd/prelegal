"use client";

import { useEffect, useState } from "react";

import { Disclaimer, Logo } from "@/components/Brand";
import DocumentCreator from "@/components/DocumentCreator";
import DocumentList from "@/components/DocumentList";
import {
  ApiError,
  deleteDocument,
  getDocument,
  listDocuments,
  signOut,
  type DocumentSummary,
  type SavedDocument,
  type User,
} from "@/lib/api";
import type { Template } from "@/lib/template";

/** The document open in the editor. `key` remounts the editor when switching documents. */
interface OpenDocument {
  key: string;
  document: SavedDocument | null;
}

let newDocumentCount = 0;
const blankDocument = (): OpenDocument => ({ key: `new-${++newDocumentCount}`, document: null });

export default function Workspace({
  user,
  templates,
  onSignedOut,
}: {
  user: User;
  templates: Template[];
  onSignedOut: () => void;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [open, setOpen] = useState<OpenDocument>(blankDocument);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  /** Sends the user back to the sign-in screen if their session has ended. */
  function handleError(err: unknown): string {
    if (err instanceof ApiError && err.status === 401) onSignedOut();
    return err instanceof Error ? err.message : String(err);
  }

  useEffect(() => {
    listDocuments().then(setDocuments, (err) => {
      setDocuments([]);
      setListError(handleError(err));
    });
    // Load once on sign-in; later changes are applied locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function newDocument() {
    setOpen(blankDocument());
    setActiveId(null);
    setListOpen(false);
  }

  async function openDocument(id: number) {
    setListError(null);
    try {
      const document = await getDocument(id);
      setOpen({ key: `doc-${id}-${Date.now()}`, document });
      setActiveId(id);
      setListOpen(false);
    } catch (err) {
      setListError(handleError(err));
    }
  }

  async function removeDocument(id: number) {
    setListError(null);
    try {
      await deleteDocument(id);
      setDocuments((current) => current?.filter((d) => d.id !== id) ?? null);
      if (id === activeId) newDocument();
    } catch (err) {
      setListError(handleError(err));
    }
  }

  function documentSaved(saved: SavedDocument) {
    const { id, template_id, title, created_at, updated_at } = saved;
    const summary: DocumentSummary = { id, template_id, title, created_at, updated_at };
    setDocuments((current) => [summary, ...(current ?? []).filter((d) => d.id !== saved.id)]);
    setActiveId(saved.id);
  }

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      onSignedOut();
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-[96rem] items-center gap-3 px-4 py-3">
          <Logo />
          <nav className="ml-auto flex items-center gap-2" aria-label="Account">
            <button
              type="button"
              onClick={newDocument}
              className="whitespace-nowrap rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-blue-dark"
            >
              <span aria-hidden>+ </span>New<span className="hidden sm:inline"> document</span>
            </button>
            <button
              type="button"
              onClick={() => setListOpen((value) => !value)}
              aria-expanded={listOpen}
              aria-controls="document-list"
              className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <span className="sm:hidden">Documents</span>
              <span className="hidden sm:inline">My documents</span>
            </button>
            <span className="hidden max-w-[16rem] truncate text-sm text-brand-gray md:block" title={user.email}>
              {user.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-navy sm:px-3"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[96rem] flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[16rem_minmax(0,1fr)] print:block print:p-0">
        <aside
          id="document-list"
          className={`${listOpen ? "block" : "hidden"} lg:block print:hidden`}
        >
          <DocumentList
            documents={documents}
            templates={templates}
            activeId={activeId}
            error={listError}
            onOpen={openDocument}
            onDelete={removeDocument}
          />
        </aside>

        <main className="min-w-0 space-y-4">
          <Disclaimer />
          <DocumentCreator
            key={open.key}
            templates={templates}
            document={open.document}
            onSaved={documentSaved}
            onError={handleError}
          />
        </main>
      </div>
    </div>
  );
}
