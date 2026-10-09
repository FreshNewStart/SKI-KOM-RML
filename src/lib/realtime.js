const RECONNECT_START_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const EVENT_BATCH_MS = 120;
const MAX_PENDING_EVENTS = 500;

const subscribers = new Set();
const pendingEvents = new Map();

let connectionOptions;
let eventSource;
let ticketRequest;
let retryTimer;
let batchTimer;
let retryDelay = RECONNECT_START_MS;
let stopped = true;
let connecting = false;
let connectionLeases = 0;

function notifySubscribers(events) {
  for (const subscriber of subscribers) {
    const matchingEvents = events.filter((event) => {
      if (
        event.type.startsWith("connection.") ||
        event.type === "server.shutdown"
      ) {
        return true;
      }

      if (
        subscriber.projectId &&
        String(event.projectId || "") !== subscriber.projectId
      ) {
        return false;
      }

      if (
        subscriber.classifications.size &&
        !subscriber.classifications.has(event.classification)
      ) {
        return false;
      }

      return true;
    });

    if (!matchingEvents.length) continue;
    try {
      subscriber.callback(matchingEvents);
    } catch (error) {
      console.error("Real-time update subscriber failed:", error);
    }
  }
}

function flushPendingEvents() {
  batchTimer = undefined;
  const events = [...pendingEvents.values()];
  pendingEvents.clear();
  if (events.length) notifySubscribers(events);
}

function queueEvent(event) {
  const key = event.type.startsWith("connection.")
    ? event.type
    : `${event.type}:${event.projectId || ""}:${event.entityId || ""}`;

  if (pendingEvents.size >= MAX_PENDING_EVENTS && !pendingEvents.has(key)) {
    pendingEvents.clear();
    pendingEvents.set("connection.resumed", {
      version: 1,
      type: "connection.resumed",
      requiresRefetch: true,
    });
  } else {
    pendingEvents.set(key, event);
  }

  if (!batchTimer) {
    batchTimer = window.setTimeout(flushPendingEvents, EVENT_BATCH_MS);
  }
}

function closeEventSource() {
  eventSource?.close();
  eventSource = undefined;
}

function scheduleReconnect() {
  if (stopped || retryTimer) return;
  const jitter = Math.floor(Math.random() * Math.min(retryDelay * 0.2, 1000));
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    void openConnection();
  }, retryDelay + jitter);
  retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_MS);
}

async function openConnection() {
  if (stopped || connecting || eventSource) return;
  connecting = true;
  const controller = new AbortController();
  ticketRequest = controller;

  try {
    const { apiBaseUrl, getAuthHeaders, onUnauthorized } = connectionOptions;
    const response = await fetch(`${apiBaseUrl}/events/ticket`, {
      method: "POST",
      headers: getAuthHeaders(),
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 401) {
      stopped = true;
      onUnauthorized?.();
      return;
    }

    if (response.status === 403) {
      stopped = true;
      console.error("Real-time updates are not authorised for this account.");
      return;
    }

    if (response.status === 503) {
      const body = await response.json().catch(() => null);
      console.warn(
        body?.message || "Real-time updates are unavailable on this backend."
      );
      scheduleReconnect();
      return;
    }

    if (!response.ok) {
      throw new Error(`Event stream ticket request failed: ${response.status}`);
    }

    const result = await response.json();
    if (typeof result?.ticket !== "string" || !result.ticket) {
      throw new Error("Event stream ticket response has an invalid format.");
    }
    if (stopped || controller.signal.aborted) return;

    const streamUrl = new URL(`${apiBaseUrl}/events/stream`);
    streamUrl.searchParams.set("ticket", result.ticket);
    const source = new EventSource(streamUrl);
    eventSource = source;

    source.addEventListener("ready", () => {
      retryDelay = RECONNECT_START_MS;
      queueEvent({
        version: 1,
        type: "connection.ready",
        requiresRefetch: true,
      });
    });

    source.addEventListener("database-change", (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event?.version === 1 && typeof event.type === "string") {
          queueEvent(event);
        } else {
          console.error("Received an unsupported real-time event format.");
        }
      } catch (error) {
        console.error("Unable to parse real-time update:", error);
      }
    });

    source.addEventListener("auth.expired", () => {
      closeEventSource();
      scheduleReconnect();
    });

    source.addEventListener("shutdown", () => {
      closeEventSource();
      scheduleReconnect();
    });

    source.addEventListener("error", () => {
      if (eventSource !== source) return;
      closeEventSource();
      scheduleReconnect();
    });
  } catch (error) {
    if (error.name !== "AbortError" && !stopped) {
      console.error("Unable to connect to database updates:", error);
      scheduleReconnect();
    }
  } finally {
    if (ticketRequest === controller) ticketRequest = undefined;
    connecting = false;
    if (!stopped && !eventSource && !retryTimer) {
      void openConnection();
    }
  }
}

export function connectToDatabaseEvents({
  apiBaseUrl,
  getAuthHeaders,
  onUnauthorized,
}) {
  if (!connectionOptions) {
    connectionOptions = { apiBaseUrl, getAuthHeaders, onUnauthorized };
  }

  if (connectionOptions.apiBaseUrl !== apiBaseUrl) {
    throw new Error("Only one real-time API connection is supported per page.");
  }

  connectionLeases += 1;
  stopped = false;
  void openConnection();

  let disconnected = false;
  return () => {
    if (disconnected) return;
    disconnected = true;
    connectionLeases = Math.max(0, connectionLeases - 1);
    if (connectionLeases > 0) return;
    stopped = true;
    window.clearTimeout(retryTimer);
    window.clearTimeout(batchTimer);
    retryTimer = undefined;
    batchTimer = undefined;
    ticketRequest?.abort();
    ticketRequest = undefined;
    closeEventSource();
    pendingEvents.clear();
    connectionOptions = undefined;
    connectionLeases = 0;
  };
}

export function subscribeToDatabaseChanges(
  callback,
  { projectId, classifications = [] } = {}
) {
  if (typeof callback !== "function") {
    throw new TypeError("A real-time update callback is required.");
  }

  const subscriber = {
    callback,
    projectId: projectId == null ? null : String(projectId),
    classifications: new Set(classifications),
  };
  subscribers.add(subscriber);

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    subscribers.delete(subscriber);
  };
}
