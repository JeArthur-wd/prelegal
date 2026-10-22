# Prelegal frontend

Next.js app for Prelegal. It currently hosts the **Mutual NDA creator** prototype (PL-3): the user fills in a form, sees the agreement update live, and downloads the completed document as Markdown or prints / saves it as PDF.

## How it works

- The template text and its field definitions come from the shared dataset in [`../data/templates`](../data/templates/README.md). They're read at build time (`src/lib/templates-server.ts`), so commands must run from this `frontend/` directory.
- The form is generated from the catalog's field definitions. To support another template, load it by its catalog `id` and render `DocumentCreator` with it.
- Template filling is plain TypeScript in `src/lib/template.ts`, unit tested with Node's built-in test runner.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests
npm run lint
npm run build
```
