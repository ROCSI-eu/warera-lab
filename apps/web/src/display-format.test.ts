import { describe, expect, it } from "vitest";

import {
  formatDisplayDelta,
  formatDisplayNumber,
  formatOptionalDisplayNumber,
} from "./display-format.js";

describe("display number formatting", () => {
  it("removes floating-point artifacts from normal monetary output", () => {
    expect(formatDisplayNumber(Number("19.440000000000006"), "margin")).toBe("19.44");
    expect(formatDisplayNumber(0.091656566856831, "price")).toBe("0.0917");
  });

  it("preserves meaningful very small non-zero values", () => {
    const rendered = formatDisplayNumber(0.000000123456, "price");
    expect(rendered).not.toBe("0");
    expect(rendered.toLowerCase()).toContain("e");
  });

  it("keeps integer classes integer-shaped", () => {
    expect(formatDisplayNumber(5, "points")).toBe("5");
    expect(formatDisplayNumber(4, "integer")).toBe("4");
  });

  it("uses the same precision policy for signed comparison deltas", () => {
    expect(formatDisplayDelta(Number("19.440000000000006"), "margin")).toBe("+19.44");
    expect(formatDisplayDelta(-0.091656566856831, "price")).toBe("-0.0917");
  });

  it("renders missing optional source values without inventing a number", () => {
    expect(formatOptionalDisplayNumber(undefined, "production")).toBe("—");
    expect(formatOptionalDisplayNumber(12.3456, "production")).toBe("12.35");
  });
});
