const VRM = /\b[A-Z]{2}[0-9]{2}\s?[A-Z]{3}\b/i;
const SENSITIVE_KEYS = new Set(["vrm", "reg", "registration", "plate"]);

export function redact(value: unknown): unknown {
  if (typeof value === "string") return value.replace(VRM, "[REDACTED_VRM]");
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED_VRM]" : redact(v);
    }
    return out;
  }
  return value;
}

export function createLogger(write: (line: string) => void = (l) => {
  console.log(l);
}) {
  return {
    info(payload: unknown) {
      write(JSON.stringify({ level: "info", ...((redact(payload) as object) ?? {}) }));
    },
  };
}
