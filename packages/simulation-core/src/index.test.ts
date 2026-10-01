import { describe, expect, it } from "vitest";

import { scenarioValue } from "./index.js";

describe("scenarioValue", () => {
  it("keeps the value and provenance together", () => {
    expect(scenarioValue(42, "derived")).toEqual({ value: 42, provenance: "derived" });
  });
});
