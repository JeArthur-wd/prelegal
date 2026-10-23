"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";

import type { ChatMessage } from "@/lib/api";

interface ChatPanelProps {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onRetry: () => void;
}

export default function ChatPanel({ messages, pending, error, onSend, onRetry }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, error]);

  // Hand focus back to the input whenever the assistant has finished replying.
  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    onSend(text);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <section
      aria-label="Chat with the Prelegal assistant"
      className="flex min-h-0 flex-1 flex-col rounded-lg border border-stone-200 bg-white shadow-sm"
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
        {pending && (
          <p className="text-sm text-stone-500" role="status">
            Assistant is typing…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 font-medium underline underline-offset-4 hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-stone-200 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Your message
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
          className="block w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-stone-900 px-3 py-2 text-sm text-white"
            : "prose prose-sm prose-stone max-w-[85%] rounded-lg bg-stone-100 px-3 py-2 prose-p:my-1 prose-ul:my-1"
        }
      >
        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
        {isUser ? message.content : <ReactMarkdown>{message.content}</ReactMarkdown>}
      </div>
    </div>
  );
}
