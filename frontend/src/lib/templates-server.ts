import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Template, TemplateField } from "./template";

// The template dataset lives at the repository root, next to frontend/.
const TEMPLATES_DIR = path.join(process.cwd(), "..", "data", "templates");

interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  file: string;
  fields: TemplateField[];
}

/** Loads a template and its field definitions from the template dataset. */
export async function loadTemplate(id: string): Promise<Template> {
  const catalog: { templates: CatalogEntry[] } = JSON.parse(
    await readFile(path.join(TEMPLATES_DIR, "catalog.json"), "utf-8"),
  );
  const entry = catalog.templates.find((t) => t.id === id);
  if (!entry) {
    throw new Error(`Template "${id}" not found in catalog.json`);
  }
  const body = await readFile(path.join(TEMPLATES_DIR, entry.file), "utf-8");
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    fields: entry.fields,
    body,
  };
}
