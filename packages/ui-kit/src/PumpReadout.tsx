import { animate, m, useMotionValue, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { pumpGlow, usePrefersReducedMotion } from "./motion.js";

type PumpReadoutProps = {
  value: number;
  currency?: string;
  unit?: string;
  layoutId?: string;
};

export function PumpReadout({ value, currency = "£", unit, layoutId }: PumpReadoutProps) {
  const reduce = usePrefersReducedMotion();
  const mv = useMotionValue(0);
  const shown = useTransform(mv, (v) => Math.round(v));
  const [digits, setDigits] = useState("0");
  const [announce, setAnnounce] = useState("");
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const unsub = shown.on("change", (v) => setDigits(String(v)));
    return () => unsub();
  }, [shown]);

  useEffect(() => {
    setAnnounce("");
    setLit(false);
    if (reduce) {
      mv.set(value);
      setDigits(String(Math.round(value)));
      setAnnounce(`${currency}${Math.round(value)}${unit ? ` ${unit}` : ""}`);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        setLit(true);
        setAnnounce(`${currency}${Math.round(value)}${unit ? ` ${unit}` : ""}`);
      },
    });
    return () => controls.stop();
  }, [value, currency, unit, reduce, mv]);

  return (
    <m.div
      {...(layoutId ? { layoutId } : {})}
      variants={pumpGlow}
      animate={lit && !reduce ? "lit" : "rest"}
      className="inline-block"
    >
      <p
        className="tabular display"
        style={{
          color: "var(--gauge)",
          fontSize: "clamp(2.6rem, 8vw, 4.4rem)",
          margin: 0,
          minWidth: "7ch",
          letterSpacing: "0.04em",
          textShadow: lit && !reduce ? "0 0 32px rgba(232,179,60,0.55)" : "none",
        }}
      >
        {currency}
        {digits.padStart(3, " ")}
        {unit ? <span style={{ fontSize: "1rem", marginLeft: "0.4rem" }}>{unit}</span> : null}
      </p>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </m.div>
  );
}
