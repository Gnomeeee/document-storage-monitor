# Frontend

React, Vite and Tailwind CSS. The pages show data from the backend over WebSocket.

## Run

From frontend/:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. Start the backend and MQTT broker separately. Without backend data, the page shows a disconnected or empty state.

Vite forwards /ws to http://127.0.0.1:3000 during development. Use localhost:5173, or add your chosen browser origin to the backend's ALLOWED_ORIGINS.

Optional frontend/.env settings:

```dotenv
VITE_DEVICE_CODE=DOC-ROOM-01
# VITE_WS_URL=ws://localhost:3000/ws
# BACKEND_PROXY_TARGET=http://127.0.0.1:3000
```

Never put database or MQTT passwords in VITE_ variables. These values are public.

## Pages

- Dashboard: latest readings, chart and open alerts.
- Readings: saved measurements and CSV export.
- Alerts: alert history with type/status filters.
- Device: device details and backend alert settings.

The display has no sample readings or demo mode. New readings arrive through WebSocket without reloading the page. Connection failures keep the last saved values and show a notice.

History loads at most 500 newest records for the chosen period. CSV exports only loaded records. Display times use Asia/Manila; CSV timestamps stay UTC.

## Checks and formatting

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run format
```

Tests cover incoming updates, duplicates, history requests, reconnects, timeouts and rendered empty/live states. Browser visual review still needs a working browser connection.

Use two spaces, double quotes and semicolons. Prettier uses the shared root configuration. Tailwind handles layout and styling; index.css contains only base styles and three shared classes.

## Deployment

Build with VITE_WS_URL=wss://your-backend.example/ws, or configure your web server to proxy /ws to the backend. Vite's development proxy is not included in the production build.

Add the deployed frontend origin, such as https://your-frontend.example, to backend ALLOWED_ORIGINS. Rebuild after changing VITE_ values.

See [the code walkthrough](../docs/DEVELOPMENT_GUIDE.md) to follow how incoming measurements reach React.
