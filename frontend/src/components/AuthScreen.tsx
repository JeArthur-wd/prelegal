"use client";

import { useState, type FormEvent } from "react";

import { Disclaimer, Logo } from "@/components/Brand";
import { signIn, signUp, type User } from "@/lib/api";
import type { Template } from "@/lib/template";

type Mode = "signin" | "signup";

export default function AuthScreen({
  templates,
  onSignedIn,
}: {
  templates: Template[];
  onSignedIn: (user: User) => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === "signup";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onSignedIn(await (isSignUp ? signUp : signIn)(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode(isSignUp ? "signin" : "signup");
    setError(null);
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
      <section className="hidden flex-col justify-between bg-brand-navy p-12 text-white lg:flex">
        <Logo inverted />
        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold leading-tight">
            Draft legal documents by having a conversation.
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Tell our assistant what you need. It picks the right template, asks the right
            questions, and fills in the document as you talk.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-300">
            {templates.map((template) => (
              <li key={template.id} className="flex gap-2">
                <span aria-hidden className="text-brand-yellow">
                  ✓
                </span>
                {template.title}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">
          Your documents are saved to your account while the service is running.
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <h2 className="text-2xl font-semibold text-brand-navy">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {isSignUp
            ? "Sign up to draft documents and find them again later."
            : "Sign in to continue drafting your documents."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={isSignUp ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={isSignUp ? "password-hint" : undefined}
              className={inputClass}
            />
            {isSignUp && (
              <p id="password-hint" className="mt-1 text-xs text-slate-500">
                At least 8 characters.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          {isSignUp ? "Already have an account? " : "New to Prelegal? "}
          <button
            type="button"
            onClick={switchMode}
            className="font-medium text-brand-blue-dark underline-offset-4 hover:underline"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>

        <Disclaimer className="mt-10" />
      </section>
    </div>
  );
}
