import { useEffect, useState } from "react";

/** Current time, refreshed every `intervalMs`, for labels like "hace 2 min" and time windows. */
const useNow = (intervalMs = 15_000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
};

export default useNow;
