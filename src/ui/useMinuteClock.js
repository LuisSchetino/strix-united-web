import { useEffect, useState } from "react";

/** Re-renders on the minute (and when the tab returns) so time-relative copy stays true. */
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval = 0;
    const tick = () => setNow(new Date());
    const timeout = window.setTimeout(() => { tick(); interval = window.setInterval(tick, 60_000); }, 60_000 - (Date.now() % 60_000));
    const visible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, []);
  return now;
}
