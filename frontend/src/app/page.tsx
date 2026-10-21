import DocumentCreator from "@/components/DocumentCreator";
import { loadTemplate } from "@/lib/templates-server";

export default async function Home() {
  const template = await loadTemplate("mutual-nda");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 print:p-0">
      <header className="mb-8 max-w-2xl print:hidden">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Prelegal
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-stone-900">
          {template.title} creator
        </h1>
        <p className="mt-2 text-stone-600">
          Fill in the details below. The agreement updates as you type, and you
          can download it once every required field is complete.
        </p>
      </header>

      <DocumentCreator template={template} />

      <p className="mt-8 text-xs text-stone-500 print:hidden">
        This template is a general starting point, not legal advice. Have a
        qualified lawyer review any agreement before you sign it.
      </p>
    </main>
  );
}
