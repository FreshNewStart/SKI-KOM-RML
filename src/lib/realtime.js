export function connectToDatabaseEvents({
  apiBaseUrl,
  getAuthHeaders,
  onChange,
  onUnauthorized,
}) {
  let eventSource;
  let retryTimer;
  let ticketRequest;
  let retryDelay = 1000;
  let stopped = false;

  function scheduleReconnect() {
    if (stopped || retryTimer) return;

    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, retryDelay);

    retryDelay = Math.min(retryDelay * 2, 30_000);
  }

  async function connect() {
    if (stopped) return;

    ticketRequest = new AbortController();

    try {
      const response = await fetch(`${apiBaseUrl}/events/ticket`, {
        method: "POST",
        headers: getAuthHeaders(),
        cache: "no-store",
        signal: ticketRequest.signal,
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(`Event stream ticket request failed: ${response.status}`);
      }

      const result = await response.json();

      if (typeof result?.ticket !== "string" || !result.ticket) {
        throw new Error("Event stream ticket response has an invalid format.");
      }

      if (stopped) return;

      const streamUrl = new URL(`${apiBaseUrl}/events/stream`);
      streamUrl.searchParams.set("ticket", result.ticket);
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener("open", () => {
        retryDelay = 1000;
      });

      eventSource.addEventListener("database-change", (event) => {
        try {
          const data = JSON.parse(event.data);
          onChange(data);
        } catch (error) {
          console.error("Invalid database change event:", error);
        }
      });

      eventSource.addEventListener("error", () => {
        eventSource?.close();
        eventSource = undefined;
        scheduleReconnect();
      });
    } catch (error) {
      if (error.name === "AbortError" || stopped) return;

      console.error("Unable to connect to database updates:", error);
      scheduleReconnect();
    } finally {
      ticketRequest = undefined;
    }
  }

  function stop() {
    stopped = true;
    window.clearTimeout(retryTimer);
    ticketRequest?.abort();
    eventSource?.close();
    eventSource = undefined;
  }

  void connect();
  return stop;
}
