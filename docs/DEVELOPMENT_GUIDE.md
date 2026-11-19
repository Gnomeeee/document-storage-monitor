# How the code works

## Explain it to the group

"The ESP32 reads the sensors and publishes through an MQTT broker. Our backend checks each message, saves it in PostgreSQL and updates alerts. It then sends the saved data to React over WebSocket. The dashboard displays that data; it does not create readings."

The ESP32 publishing part is still pending in firmware. Backend and frontend code already use this flow.

## Follow one reading

| Step | File | What happens |
| --- | --- | --- |
| 1 | backend/src/mqtt.js | Receives a message from the broker |
| 2 | backend/src/validators/messages.js | Checks the payload and topic/device match |
| 3 | backend/src/services/readings.service.js | Checks the device, rejects duplicates and saves the measurement |
| 4 | backend/src/services/alerts.service.js | Opens, escalates or clears alerts inside the same transaction |
| 5 | backend/src/websocket.js | Sends updates after the database save |
| 6 | frontend/src/services/monitor.service.js | Receives updates and keeps the loaded readings/history |
| 7 | frontend/src/hooks/useMonitor.js | Subscribes React to that data |
| 8 | frontend/src/pages/Dashboard.jsx | Displays the values |

The database transaction means a reading and its alert changes succeed together or roll back together.

## Backend structure

```text
src/
  server.js          Starts the process and handles shutdown
  startServer.js     Connects the database, MQTT and WebSocket
  app.js             Registers Express routes and middleware
  mqtt.js            Receives device messages
  websocket.js       Handles browser requests and updates
  config/            Environment, Prisma and monitoring settings
  routes/            HTTP routes; currently health only
  controllers/       HTTP response handlers
  middleware/        HTTP headers and safe error responses
  services/          Database queries and alert logic
  validators/        Incoming MQTT/WebSocket message rules
  utils/             Shared errors and processing queue
```

MQTT and WebSocket call services directly. They are not Express HTTP requests, so they do not need duplicate REST routes.

The small processing queue keeps snapshots and incoming updates in order. Without it, an older query could arrive after a newer reading and replace the display.

## Frontend structure

```text
src/
  App.jsx            Chooses the page and shows shared controls
  main.jsx           Mounts React
  index.css          Tailwind and shared base styles
  pages/             Dashboard, Readings, Alerts and Device
  components/        Reused navigation, chart, badges and notices
  hooks/             React connection to monitor data
  services/          WebSocket messages, retry and request handling
  utils/             Date/number formatting and CSV export
```

monitor.service.js keeps networking outside the page components. It matches responses to requests, ignores old filter results, and reloads state after reconnecting. useMonitor gives the pages a current snapshot and refresh/filter functions.

## Where to change something

| Change | File |
| --- | --- |
| Default humidity limits and durations | backend/src/config/monitoring.js |
| Environment settings | backend/.env, using .env.example |
| How an alert opens or clears | backend/src/services/alerts.service.js |
| Accepted message fields | backend/src/validators/messages.js |
| Dashboard layout | frontend/src/pages/Dashboard.jsx |
| Chart | frontend/src/components/ReadingChart.jsx |
| Browser backend address | frontend/.env |
| Database entities | backend/prisma/schema.prisma, followed by a new migration |

Keep credentials in backend/.env and broker/passwords. A device code is an identifier, not a password. The broker authenticates publishers and limits their topics; the backend validates their data.

## Real measurements

The application never generates measurements. backend/prisma/seed.js creates only a device record. Test values exist only in tests and the optional test publisher, which does not run automatically.

For physical readings, firmware must publish the sensor values using the [message contract](COMMUNICATION.md). Keep test publishers out of the deployed broker/database. Existing rows are preserved; their source cannot be inferred from the current schema.

The ESP32 buzzer must work locally during network outages. The backend does not send buzzer commands.

## Checks

Run npm.cmd test in each component. Run npm.cmd run lint and npm.cmd run build in frontend/. The backend integration test additionally needs TEST_DATABASE_URL and uses an isolated schema.

These checks verify software behavior. They do not replace physical sensor tests or a browser visual review.
