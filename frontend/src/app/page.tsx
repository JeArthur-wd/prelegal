import DocumentCreator from "@/components/DocumentCreator";
import { loadTemplates } from "@/lib/templates-server";

export default async function Home() {
  const templates = await loadTemplates();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 print:p-0">
      <header className="mb-8 max-w-2xl print:hidden">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Prelegal
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-stone-900">
          Draft a legal document
        </h1>
        <p className="mt-2 text-stone-600">
          Tell our assistant what you need. It picks the right document, asks you
          the questions it needs, and fills in the document as you go. Download it
          once every required field is complete.
        </p>
      </header>

      <DocumentCreator templates={templates} />

      <p className="mt-8 text-xs text-stone-500 print:hidden">
        These templates are a general starting point, not legal advice. Have a
        qualified lawyer review any document before you sign it.
      </p>
    </main>
  );
}
