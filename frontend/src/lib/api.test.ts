import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  ApiError,
  deleteDocument,
  getCurrentUser,
  postChat,
  signUp,
  updateDocument,
  type ChatRequest,
} from "./api.ts";

const chatRequest: ChatRequest = {
  template_id: "mutual-nda",
  messages: [{ role: "user", content: "Hello" }],
  values: {},
};

const realFetch = globalThis.fetch;
let sent: { url: string; init: RequestInit }[] = [];

function mockFetch(respond: () => Response | Promise<Response>) {
  sent = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return respond();
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("api client", () => {
  it("posts JSON and returns the parsed reply", async () => {
    const reply = { reply: "Hi", template_id: "mutual-nda", updates: { party_a_name: "Acme" } };
    mockFetch(() => Response.json(reply));

    assert.deepEqual(await postChat(chatRequest), reply);
    assert.equal(sent[0].url, "/api/chat");
    assert.equal(sent[0].init.method, "POST");
    assert.deepEqual(JSON.parse(sent[0].init.body as string), chatRequest);
  });

  it("sends GET requests without a body", async () => {
    mockFetch(() => Response.json({ id: 1, email: "a@b.co" }));

    await getCurrentUser();

    assert.equal(sent[0].url, "/api/auth/me");
    assert.equal(sent[0].init.method, "GET");
    assert.equal(sent[0].init.body, undefined);
  });

  it("uses the document id in the path", async () => {
    mockFetch(() => Response.json({}));
    await updateDocument(7, { template_id: "bill-of-sale", title: "Sale", values: {}, messages: [] });
    assert.equal(sent[0].url, "/api/documents/7");
    assert.equal(sent[0].init.method, "PUT");
  });

  it("handles 204 No Content", async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    assert.equal(await deleteDocument(7), undefined);
  });

  it("raises ApiError with the backend's detail and status", async () => {
    mockFetch(() => Response.json({ detail: "Please sign in to continue" }, { status: 401 }));

    await assert.rejects(postChat(chatRequest), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Please sign in to continue");
      return true;
    });
  });

  it("reads FastAPI validation messages", async () => {
    mockFetch(() =>
      Response.json(
        { detail: [{ msg: "String should have at least 8 characters" }] },
        { status: 422 },
      ),
    );
    await assert.rejects(signUp("a@b.co", "short"), /at least 8 characters/);
  });

  it("falls back to a generic message for unreadable errors", async () => {
    mockFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    await assert.rejects(postChat(chatRequest), /Something went wrong/);
  });

  it("explains network failures", async () => {
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(postChat(chatRequest), /Couldn't reach the server/);
  });
});
