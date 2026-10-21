"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

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

export default function DocumentCreator({ template }: { template: Template }) {
  const [values, setValues] = useState<FieldValues>(() =>
    initialValues(template.fields),
  );

  const preview = useMemo(
    () => fillTemplate(template, values, renderMissingForPreview),
    [template, values],
  );
  const missing = missingRequiredFields(template.fields, values);
  const isComplete = missing.length === 0;

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block">
      <form
        className="space-y-5 print:hidden"
        onSubmit={(event) => event.preventDefault()}
      >
        {template.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={values[field.name] ?? ""}
            onChange={(value) => setValue(field.name, value)}
          />
        ))}

        <div className="sticky bottom-0 -mx-1 space-y-3 border-t border-stone-200 bg-stone-50 px-1 py-4">
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
              onClick={() => setValues(initialValues(template.fields))}
              className="px-2 py-2 text-sm text-stone-600 underline-offset-4 hover:underline"
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      <article
        aria-label={`${template.title} preview`}
        className="prose prose-stone max-w-none rounded-lg border border-stone-200 bg-white p-8 font-serif shadow-sm prose-headings:font-sans prose-code:rounded prose-code:bg-amber-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-sans prose-code:font-normal prose-code:text-amber-900 prose-code:before:content-none prose-code:after:content-none sm:p-12 print:border-0 print:p-0 print:shadow-none"
      >
        <ReactMarkdown>{preview}</ReactMarkdown>
      </article>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field.name}`;
  const inputClass =
    "mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-stone-800">
        {field.label}
        {field.required && <span className="text-red-600"> *</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={htmlInputType(field.type)}
          min={field.type === "number" ? 0 : undefined}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      {field.description && (
        <p className="mt-1 text-xs text-stone-500">{field.description}</p>
      )}
    </div>
  );
}

function htmlInputType(type: TemplateField["type"]): string {
  switch (type) {
    case "date":
    case "number":
    case "email":
    case "url":
      return type;
    default:
      return "text";
  }
}
