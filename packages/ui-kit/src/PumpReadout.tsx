import { useEffect, useRef, useState } from "react";

type PumpReadoutProps = {
  value: number;
  currency?: string;
  unit?: string;
};

export function PumpReadout({ value, currency = "£", unit }: PumpReadoutProps) {
  const [shown, setShown] = useState(0);
  const [announce, setAnnounce] = useState("");
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setShown(value);
      setAnnounce(`${currency}${value.toFixed(0)}${unit ? ` ${unit}` : ""}`);
      return;
    }
    setAnnounce("");
    const start = performance.now();
    const duration = 600;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(value * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setAnnounce(`${currency}${value.toFixed(0)}${unit ? ` ${unit}` : ""}`);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, currency, unit]);

  return (
    <div>
      <p
        className="tabular display"
        style={{ color: "var(--gauge)", fontSize: "3rem", margin: 0, minWidth: "8ch", fontVariantNumeric: "tabular-nums" }}
      >
        {`${currency}${shown.toFixed(0).padStart(3, " ")}`}
        {unit ? <span style={{ fontSize: "1rem" }}> {unit}</span> : null}
      </p>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
