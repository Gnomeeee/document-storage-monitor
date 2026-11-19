function escapeCell(value) {
  let text = String(value ?? "");

  // Prevent a spreadsheet from treating exported text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function csvText(rows) {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(filename, rows) {
  const file = new Blob(["\uFEFF", csvText(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReadingsCsv(readings, deviceCode) {
  const rows = readings.map((reading) => [
    deviceCode,
    reading.receivedAt,
    reading.temperatureC,
    reading.humidityPercent,
    reading.waterDetected,
    reading.readingUid,
  ]);
  downloadCsv("readings.csv", [
    [
      "Device",
      "Received at (UTC)",
      "Temperature (C)",
      "Humidity (%)",
      "Water detected",
      "Reading UID",
    ],
    ...rows,
  ]);
}
