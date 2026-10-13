import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeSseResponse,
  fetchSseResponse,
  SseConnectionError,
} from "../src/lib/sseClient.js";

test("SSE fetch requests include ngrok warning bypass and no-store headers", async () => {
  let requested;
  const response = new Response(": connected\n\n", {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });

  const result = await fetchSseResponse("https://api.example/events/stream", {
    signal: new AbortController().signal,
    fetchImpl: async (url, options) => {
      requested = { url, options };
      return response;
    },
  });

  assert.equal(result, response);
  assert.equal(requested.url, "https://api.example/events/stream");
  assert.equal(requested.options.method, "GET");
  assert.equal(
    requested.options.headers["ngrok-skip-browser-warning"],
    "true"
  );
  assert.equal(requested.options.headers.Accept, "text/event-stream");
  assert.equal(requested.options.cache, "no-store");
  assert.ok(requested.options.signal);
});

test("SSE parser handles chunk boundaries, CRLF, comments and multiline data", async () => {
  const chunks = [
    ": con",
    "nected\r\nevent: ready\r\ndata: {\"version\":\r",
    "\ndata: 1}\r\n\r\nevent: database-change\n",
    "data: {\"version\":1,\ndata: \"type\":\"activity.updated\"}\n\n",
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
  const received = [];
  await consumeSseResponse(
    new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    }),
    (event) => received.push(event)
  );

  assert.deepEqual(received, [
    { type: "ready", data: '{"version":\n1}' },
    {
      type: "database-change",
      data: '{"version":1,\n"type":"activity.updated"}',
    },
  ]);
});

test("ngrok ERR_NGROK_6024 plain-text warning is reported as an invalid SSE response", async () => {
  const response = new Response("ngrok browser warning", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "ngrok-error-code": "ERR_NGROK_6024",
    },
  });

  await assert.rejects(
    fetchSseResponse("https://api.example/events/stream", {
      fetchImpl: async () => response,
    }),
    (error) => {
      assert.ok(error instanceof SseConnectionError);
      assert.equal(error.status, 200);
      assert.equal(error.code, "INVALID_EVENT_STREAM_RESPONSE");
      assert.equal(error.ngrokErrorCode, "ERR_NGROK_6024");
      assert.match(error.message, /browser warning page/i);
      return true;
    }
  );
});

test("SSE server error status and structured authorization code are preserved", async () => {
  await assert.rejects(
    fetchSseResponse("https://api.example/events/stream", {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            success: false,
            code: "INVALID_EVENT_TICKET",
            message: "Event stream ticket is invalid or expired.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        ),
    }),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.code, "INVALID_EVENT_TICKET");
      return true;
    }
  );
});

test("successful HTTP responses with a non-SSE content type are rejected", async () => {
  await assert.rejects(
    fetchSseResponse("https://api.example/events/stream", {
      fetchImpl: async () =>
        new Response("not an event stream", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
    }),
    (error) =>
      error instanceof SseConnectionError &&
      error.code === "INVALID_EVENT_STREAM_RESPONSE"
  );
});
