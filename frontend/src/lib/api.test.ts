import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { postChat, type ChatRequest } from "./api.ts";

const request: ChatRequest = {
  template_id: "mutual-nda",
  messages: [{ role: "user", content: "Hello" }],
  values: {},
};

const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
  globalThis.fetch = ((url: string, init: RequestInit) => handler(url, init)) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("postChat", () => {
  it("posts the request as JSON and returns the reply", async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    mockFetch(async (url, init) => {
      sent = { url, init };
      return Response.json({ reply: "Hi", updates: { party_a_name: "Acme" } });
    });

    const reply = await postChat(request);

    assert.deepEqual(reply, { reply: "Hi", updates: { party_a_name: "Acme" } });
    assert.equal(sent?.url, "/api/chat");
    assert.equal(sent?.init.method, "POST");
    assert.deepEqual(JSON.parse(sent?.init.body as string), request);
  });

  it("surfaces the backend's error detail", async () => {
    mockFetch(async () => Response.json({ detail: "AI unavailable" }, { status: 502 }));
    await assert.rejects(postChat(request), { message: "AI unavailable" });
  });

  it("falls back to a generic message for unreadable errors", async () => {
    mockFetch(async () => new Response("<html>Bad gateway</html>", { status: 502 }));
    await assert.rejects(postChat(request), /Something went wrong/);
  });

  it("explains network failures", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(postChat(request), /Couldn't reach the server/);
  });
});
