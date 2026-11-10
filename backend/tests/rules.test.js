import test from 'node:test';
import assert from 'node:assert/strict';
import { planAlerts } from '../src/services/alerts.service.js';
import { freshness } from '../src/services/dashboard.service.js';
const rows = (minutes, humidity = 60, wet = false) => Array.from({ length: minutes + 1 }, (_, i) => ({ receivedAt: new Date(i * 60000), humidityPercent: humidity, waterDetected: wet }));
test('humidity requires elapsed qualifying observations, including threshold equality', () => {
  assert.deepEqual(planAlerts(rows(29), []), []);
  assert.equal(planAlerts(rows(30), [])[0].severity, 'WARNING');
  assert.deepEqual(planAlerts(rows(14, 65), []), []);
  assert.equal(planAlerts(rows(15, 65), [])[0].severity, 'CRITICAL');
});
test('qualification resets on low reading and gaps; restart reconstruction has no memory dependency', () => {
  const history = rows(30);
  history[20].humidityPercent = 59.9;
  assert.deepEqual(planAlerts(history, []), []);
  assert.deepEqual(planAlerts([rows(0)[0], { ...rows(0)[0], receivedAt: new Date(1800000) }], []), []);
  assert.deepEqual(planAlerts(rows(30), []), planAlerts(JSON.parse(JSON.stringify(rows(30))), []));
});
test('humidity escalates same incident, never downgrades; recovery needs below 58 for 10 minutes', () => {
  const warning = { id: 2, type: 'HUMIDITY', severity: 'WARNING' };
  assert.equal(planAlerts(rows(15, 65), [warning])[0].action, 'escalate');
  const critical = { ...warning, severity: 'CRITICAL' };
  assert.deepEqual(planAlerts(rows(30), [critical]), []);
  assert.deepEqual(planAlerts(rows(10, 58), [critical]), []);
  assert.deepEqual(planAlerts(rows(9, 57), [critical]), []);
  assert.deepEqual(planAlerts(rows(10, 57), [critical]), [{ action: 'clear', id: 2 }]);
});
test('water opens immediately, stays unique, clears after dry observations and can coexist with humidity', () => {
  assert.equal(planAlerts(rows(0, 50, true), [])[0].type, 'WATER');
  const open = { id: 3, type: 'WATER', severity: 'CRITICAL' };
  assert.deepEqual(planAlerts(rows(0, 50, true), [open]), []);
  const dry = [{ receivedAt: new Date(0), humidityPercent: 50, waterDetected: false }, { receivedAt: new Date(10000), humidityPercent: 50, waterDetected: false }];
  assert.deepEqual(planAlerts(dry, [open]), [{ action: 'clear', id: 3 }]);
  assert.equal(planAlerts(rows(30, 60, true), []).length, 2);
});
test('freshness boundaries and no-data are independent from alert severity', () => {
  assert.equal(freshness(null, new Date()), 'NO_DATA');
  assert.equal(freshness(new Date(0), new Date(180000)), 'ONLINE');
  assert.equal(freshness(new Date(0), new Date(180001)), 'STALE');
  assert.equal(freshness(new Date(0), new Date(300001)), 'OFFLINE');
});
