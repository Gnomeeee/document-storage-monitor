import { useEffect, useState, useSyncExternalStore } from "react";
import { createMonitorClient } from "../services/monitor.service.js";

export function useMonitor() {
  const deviceCode = import.meta.env.VITE_DEVICE_CODE || "DOC-ROOM-01";

  const [client] = useState(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/ws`;
    return createMonitorClient({ url, deviceCode });
  });

  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  return {
    ...state,
    deviceCode,
    refresh: client.refresh,
    setRange: client.setRange,
  };
}
