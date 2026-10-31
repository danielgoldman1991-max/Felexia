const CANONICAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function decimalScaled(value: unknown, scale: number): bigint {
  if (typeof value !== "string" || value.length > 64 || !CANONICAL.test(value) || !Number.isInteger(scale) || scale < 0 || scale > 12) throw new Error("DECIMAL_STRING_REQUIRED");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  if (whole.length + fraction.length > 30) throw new Error("DECIMAL_PRECISION_EXCEEDED");
  const factor = BigInt("10") ** BigInt(scale);
  const kept = fraction.slice(0, scale).padEnd(scale, "0");
  let result = BigInt(whole) * factor + BigInt(kept || "0");
  if (fraction.length > scale && fraction[scale] >= "5") result++;
  return negative ? -result : result;
}

export function decimalText(value: bigint, scale: number): string {
  const negative = value < BigInt("0");
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  return (negative ? "-" : "") + (scale ? digits.slice(0, -scale) + "." + digits.slice(-scale) : digits);
}

/** PostgreSQL numeric round: a tie rounds away from zero. */
export function divideRounded(value: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt("0")) throw new Error("DECIMAL_INVALID_DIVISOR");
  const sign = value < BigInt("0") ? -BigInt("1") : BigInt("1");
  const absolute = value < BigInt("0") ? -value : value;
  return sign * (absolute / denominator + (absolute % denominator * BigInt("2") >= denominator ? BigInt("1") : BigInt("0")));
}

export function normalizeDecimal(value: unknown, scale = 2): string { return decimalText(decimalScaled(value, scale), scale); }
