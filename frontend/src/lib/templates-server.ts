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

/** Loads every template in the dataset, with its field definitions, in catalog order. */
export async function loadTemplates(): Promise<Template[]> {
  const catalog: { templates: CatalogEntry[] } = JSON.parse(
    await readFile(path.join(TEMPLATES_DIR, "catalog.json"), "utf-8"),
  );
  return Promise.all(
    catalog.templates.map(async (entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      fields: entry.fields,
      body: await readFile(path.join(TEMPLATES_DIR, entry.file), "utf-8"),
    })),
  );
}
