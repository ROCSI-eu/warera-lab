export type DisplayNumberKind =
  "number" | "integer" | "points" | "quantity" | "production" | "price" | "cost" | "margin";

const maximumFractionDigits: Record<DisplayNumberKind, number> = {
  number: 2,
  integer: 0,
  points: 0,
  quantity: 4,
  production: 2,
  price: 4,
  cost: 4,
  margin: 4,
};

function formatter(kind: DisplayNumberKind, signed: boolean, value: number): Intl.NumberFormat {
  const digits = maximumFractionDigits[kind];
  const absolute = Math.abs(value);
  const useScientific = digits > 0 && absolute > 0 && absolute < 10 ** -digits;

  return new Intl.NumberFormat(undefined, {
    ...(useScientific
      ? { notation: "scientific" as const, maximumSignificantDigits: 4 }
      : { maximumFractionDigits: digits }),
    ...(signed ? { signDisplay: "exceptZero" as const } : {}),
  });
}

export function formatDisplayNumber(value: number, kind: DisplayNumberKind = "number"): string {
  return formatter(kind, false, value).format(value);
}

export function formatDisplayDelta(value: number, kind: DisplayNumberKind = "number"): string {
  return formatter(kind, true, value).format(value);
}

export function formatOptionalDisplayNumber(
  value: number | undefined,
  kind: DisplayNumberKind = "number",
): string {
  return value === undefined ? "—" : formatDisplayNumber(value, kind);
}
