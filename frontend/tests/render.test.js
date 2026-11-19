import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("dashboard shows missing data as unknown and displays values received from the backend", async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  try {
    const { default: Dashboard } = await vite.ssrLoadModule("/src/pages/Dashboard.jsx");
    const { default: Alerts } = await vite.ssrLoadModule("/src/pages/Alerts.jsx");
    const empty = {
      connection: "disconnected",
      snapshot: null,
      readings: [],
      alerts: [],
      historyLoading: false,
      historyError: null,
    };

    let html = renderToStaticMarkup(
      createElement(Dashboard, { monitor: empty, now: Date.now() }),
    );
    assert.match(html, /No readings yet/);
    assert.match(html, /Alert status unavailable/);
    assert.doesNotMatch(html, /No open alerts/);

    const reading = {
      id: 1,
      receivedAt: new Date().toISOString(),
      humidityPercent: 68.2,
      temperatureC: 28.5,
      waterDetected: true,
    };
    const alert = {
      id: 1,
      type: "WATER",
      severity: "CRITICAL",
      status: "OPEN",
      message: "Water detected at the probe.",
      startedAt: reading.receivedAt,
    };
    const monitor = {
      ...empty,
      connection: "connected",
      snapshot: {
        device: { deviceCode: "DOC-ROOM-01" },
        latest: reading,
        activeAlerts: [alert],
        connectivity: "ONLINE",
        environmentalRisk: "CRITICAL",
      },
      alerts: [alert],
    };

    html = renderToStaticMarkup(createElement(Dashboard, { monitor, now: Date.now() }));
    assert.match(html, /68.2/);
    assert.match(html, /28.5/);
    assert.match(html, /Water detected/);
    assert.match(html, /Critical/);

    const changed = {
      ...monitor,
      snapshot: {
        ...monitor.snapshot,
        latest: { ...reading, temperatureC: 32.7, humidityPercent: 51.4 },
      },
    };
    html = renderToStaticMarkup(
      createElement(Dashboard, { monitor: changed, now: Date.now() }),
    );
    assert.match(html, /32.7/);
    assert.match(html, /51.4/);
    assert.doesNotMatch(html, /68.2|28.5/);

    html = renderToStaticMarkup(createElement(Alerts, { monitor }));
    assert.match(html, /Not cleared/);
    assert.match(html, /Critical/);
  } finally {
    await vite.close();
  }
});
