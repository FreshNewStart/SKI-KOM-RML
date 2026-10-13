const MAX_SSE_BUFFER_LENGTH = 256 * 1024;

export class SseConnectionError extends Error {
  constructor(message, { status = 0, code = null, ngrokErrorCode = null } = {}) {
    super(message);
    this.name = "SseConnectionError";
    this.status = status;
    this.code = code;
    this.ngrokErrorCode = ngrokErrorCode;
  }
}

export async function fetchSseResponse(url, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    let errorBody = null;
    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        errorBody = await response.json();
      } catch {
        errorBody = null;
      }
    }
    throw new SseConnectionError(
      typeof errorBody?.message === "string"
        ? errorBody.message
        : `Event stream request failed with HTTP ${response.status}.`,
      {
        status: response.status,
        code: typeof errorBody?.code === "string" ? errorBody.code : null,
        ngrokErrorCode: response.headers.get("ngrok-error-code"),
      }
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!/^text\/event-stream(?:\s*;|$)/i.test(contentType)) {
    const ngrokErrorCode = response.headers.get("ngrok-error-code");
    throw new SseConnectionError(
      ngrokErrorCode === "ERR_NGROK_6024"
        ? "ngrok returned its browser warning page instead of the event stream. The warning-bypass header was not accepted by the active tunnel."
        : "The server returned an unexpected response instead of an event stream.",
      {
        status: response.status,
        code: "INVALID_EVENT_STREAM_RESPONSE",
        ngrokErrorCode,
      }
    );
  }

  if (!response.body) {
    throw new SseConnectionError("The event stream response has no readable body.", {
      status: response.status,
      code: "EMPTY_EVENT_STREAM",
    });
  }

  return response;
}

function parseField(line, event) {
  if (!line || line.startsWith(":")) return;
  const separator = line.indexOf(":");
  const field = separator < 0 ? line : line.slice(0, separator);
  let value = separator < 0 ? "" : line.slice(separator + 1);
  if (value.startsWith(" ")) value = value.slice(1);

  if (field === "event") {
    event.name = value;
  } else if (field === "data") {
    event.data.push(value);
  }
}

export async function consumeSseResponse(response, onEvent) {
  if (typeof onEvent !== "function") {
    throw new TypeError("An SSE event callback is required.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  let currentEvent = { name: "", data: [] };

  const dispatch = () => {
    if (currentEvent.data.length) {
      onEvent({
        type: currentEvent.name || "message",
        data: currentEvent.data.join("\n"),
      });
    }
    currentEvent = { name: "", data: [] };
  };

  const processLines = (endOfStream = false) => {
    let start = 0;
    for (let index = 0; index < lineBuffer.length; index += 1) {
      const char = lineBuffer[index];
      if (char !== "\n" && char !== "\r") continue;
      if (char === "\r" && index === lineBuffer.length - 1 && !endOfStream) {
        break;
      }

      const line = lineBuffer.slice(start, index);
      if (char === "\r" && lineBuffer[index + 1] === "\n") index += 1;
      start = index + 1;
      if (!line) dispatch();
      else parseField(line, currentEvent);
    }
    lineBuffer = lineBuffer.slice(start);

    if (endOfStream && lineBuffer) {
      parseField(lineBuffer, currentEvent);
      lineBuffer = "";
    }
    if (endOfStream) dispatch();
    if (lineBuffer.length > MAX_SSE_BUFFER_LENGTH) {
      throw new SseConnectionError("The event stream contains an oversized event.", {
        code: "EVENT_STREAM_EVENT_TOO_LARGE",
      });
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        lineBuffer += decoder.decode();
        processLines(true);
        return;
      }
      lineBuffer += decoder.decode(value, { stream: true });
      processLines();
    }
  } finally {
    reader.releaseLock();
  }
}
