export function mergeRecords(existing, incoming, dateField, limit = 500) {
  const records = new Map(existing.map((record) => [record.id, record]));

  for (const record of incoming) {
    records.set(record.id, record);
  }

  return [...records.values()]
    .sort((first, second) => {
      const dateDifference = Date.parse(second[dateField]) - Date.parse(first[dateField]);
      return dateDifference || second.id - first.id;
    })
    .slice(0, limit);
}

export function createMonitorClient({
  url,
  deviceCode,
  WebSocketImpl = globalThis.WebSocket,
  timeoutMs = 15000,
  retryBaseMs = 1000,
  heartbeatMs = 30000,
}) {
  let state = {
    connection: "idle",
    snapshot: null,
    readings: [],
    alerts: [],
    rangeHours: 24,
    loading: false,
    historyLoading: false,
    error: null,
    historyError: null,
  };

  const listeners = new Set();
  const pendingRequests = new Map();
  let socket;
  let reconnectTimer;
  let connectionTimer;
  let heartbeatTimer;
  let stopped = true;
  let reconnectAttempt = 0;
  let requestNumber = 0;

  function updateState(changes) {
    state = { ...state, ...changes };
    for (const listener of listeners) listener();
  }

  function updateLoading() {
    const requests = [...pendingRequests.values()];

    updateState({
      loading: requests.some((request) => request.type === "dashboard.get"),
      historyLoading: requests.some((request) => request.type !== "dashboard.get"),
    });
  }

  function removeRequest(requestId) {
    const request = pendingRequests.get(requestId);
    if (!request) return;

    clearTimeout(request.timer);
    pendingRequests.delete(requestId);
    return request;
  }

  function sendRequest(type, payload, loadHistoryAfter = false) {
    if (socket?.readyState !== 1) return;

    const requestId = `request-${++requestNumber}`;
    const request = { type, payload, loadHistoryAfter, liveRecords: [] };

    request.timer = setTimeout(() => {
      if (!removeRequest(requestId)) return;

      if (type === "dashboard.get") {
        updateState({ error: "The server is not responding. Reconnecting..." });
        socket?.close();
      } else {
        updateState({ historyError: "History request timed out. Try again." });
      }

      updateLoading();
    }, timeoutMs);

    pendingRequests.set(requestId, request);

    try {
      socket.send(JSON.stringify({ type, requestId, payload }));
    } catch {
      removeRequest(requestId);
      socket?.close();
    }

    updateLoading();
  }

  function loadHistory() {
    for (const [requestId, request] of pendingRequests) {
      if (request.type !== "dashboard.get") removeRequest(requestId);
    }

    updateState({ historyError: null });
    const from = new Date(Date.now() - state.rangeHours * 3600000).toISOString();
    const filter = { deviceCode, from, limit: 500 };

    sendRequest("readings.get", filter);
    sendRequest("alerts.get", filter);
  }

  function addLiveRecord(kind, record, dateField) {
    for (const request of pendingRequests.values()) {
      const matchesRequest = request.type === `${kind}.get`;
      const matchesPeriod =
        Date.parse(record[dateField]) >= Date.parse(request.payload.from);

      if (matchesRequest && matchesPeriod) request.liveRecords.push(record);
    }

    const cutoff = Date.now() - state.rangeHours * 3600000;
    const records = mergeRecords(state[kind], [record], dateField);
    updateState({
      [kind]: records.filter((item) => Date.parse(item[dateField]) >= cutoff),
    });
  }

  function handleMessage(event) {
    let message;

    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!message || typeof message !== "object") return;

    const { type, payload, requestId } = message;
    const request = requestId ? removeRequest(requestId) : null;

    // Ignore a response if its time filter changed or its request timed out.
    if (requestId && !request) return;

    if (type === "error") {
      const error = message.error?.message || "Request failed. Try again.";
      const field = request?.type === "dashboard.get" ? "error" : "historyError";
      updateState({ [field]: error });
      updateLoading();
      return;
    }

    const responseDevice = payload?.deviceCode || payload?.device?.deviceCode;
    if (responseDevice !== deviceCode) {
      updateLoading();
      return;
    }

    switch (type) {
      case "dashboard.snapshot":
        updateState({ snapshot: payload, error: null });
        if (request?.loadHistoryAfter) loadHistory();
        break;

      case "readings.result":
      case "alerts.result": {
        const kind = type === "readings.result" ? "readings" : "alerts";
        if (request?.type !== `${kind}.get` || !Array.isArray(payload.items)) break;
        const dateField = kind === "readings" ? "receivedAt" : "startedAt";

        // Live updates received during the query take precedence over its results.
        updateState({
          [kind]: mergeRecords(payload.items, request.liveRecords, dateField),
        });
        break;
      }

      case "reading.created":
        addLiveRecord("readings", payload.reading, "receivedAt");
        if (state.snapshot) {
          updateState({ snapshot: { ...state.snapshot, latest: payload.reading } });
        }
        break;

      case "alert.changed":
        addLiveRecord("alerts", payload.alert, "startedAt");
        break;

      case "device.status":
        if (state.snapshot) {
          updateState({
            snapshot: { ...state.snapshot, connectivity: payload.connectivity },
          });
        }
        break;
    }

    updateLoading();
  }

  function connect() {
    if (stopped) return;

    clearTimeout(reconnectTimer);
    updateState({ connection: reconnectAttempt ? "reconnecting" : "connecting" });

    let connection;

    try {
      connection = new WebSocketImpl(url);
    } catch {
      updateState({
        connection: "disconnected",
        error: "Check the WebSocket URL in the frontend configuration.",
      });
      return;
    }

    socket = connection;
    connectionTimer = setTimeout(() => connection.close(), timeoutMs);

    connection.onopen = () => {
      if (socket !== connection || stopped) return;

      clearTimeout(connectionTimer);
      reconnectAttempt = 0;
      updateState({ connection: "connected", error: null });
      sendRequest("dashboard.get", { deviceCode }, true);

      heartbeatTimer = setInterval(() => {
        if (!state.loading) sendRequest("dashboard.get", { deviceCode });
      }, heartbeatMs);
    };

    connection.onmessage = (event) => {
      if (socket === connection && !stopped) handleMessage(event);
    };

    connection.onerror = () => {};
    connection.onclose = () => {
      if (socket !== connection || stopped) return;

      clearTimeout(connectionTimer);
      clearInterval(heartbeatTimer);

      for (const requestId of pendingRequests.keys()) removeRequest(requestId);

      updateState({ connection: "disconnected", loading: false, historyLoading: false });
      const delay = Math.min(retryBaseMs * 2 ** reconnectAttempt, 30000);
      reconnectAttempt++;
      reconnectTimer = setTimeout(connect, delay);
    };
  }

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    clearTimeout(connectionTimer);
    clearInterval(heartbeatTimer);

    for (const requestId of pendingRequests.keys()) removeRequest(requestId);

    const previousSocket = socket;
    socket = null;
    previousSocket?.close();
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    connect();
  }

  function reconnect() {
    stop();
    reconnectAttempt = 0;
    start();
  }

  function refresh() {
    if (state.connection !== "connected") {
      reconnect();
      return;
    }

    if (!state.loading && !state.historyLoading) {
      sendRequest("dashboard.get", { deviceCode }, true);
    }
  }

  function setRange(hours) {
    if (![1, 24, 168].includes(hours) || hours === state.rangeHours) return;

    updateState({ rangeHours: hours, readings: [], alerts: [] });
    if (state.connection === "connected") loadHistory();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    start,
    stop,
    reconnect,
    refresh,
    setRange,
  };
}
