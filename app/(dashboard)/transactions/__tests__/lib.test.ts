import { describe, expect, it } from "vitest";

import {
  MONOGRAM_STYLES,
  monogramInitials,
  monogramStyle,
  summarizeTransactions,
} from "../lib";

describe("summarizeTransactions", () => {
  it("splits inflow, outflow and net", () => {
    const rows = [{ amount: 200 }, { amount: -120.5 }, { amount: 100 }, { amount: -30 }];
    expect(summarizeTransactions(rows)).toEqual({
      inflow: 300,
      outflow: 150.5,
      net: 149.5,
    });
  });

  it("returns zeros for an empty period", () => {
    expect(summarizeTransactions([])).toEqual({ inflow: 0, outflow: 0, net: 0 });
  });
});

describe("monogramInitials", () => {
  it("uses first letters of the first two words", () => {
    expect(monogramInitials("Amazon Prime")).toBe("AP");
  });

  it("uses the first two letters of a single word", () => {
    expect(monogramInitials("Uber")).toBe("UB");
  });

  it("trims whitespace and uppercases", () => {
    expect(monogramInitials("  swiggy  ")).toBe("SW");
  });

  it("falls back to ? for empty names", () => {
    expect(monogramInitials("")).toBe("?");
    expect(monogramInitials("   ")).toBe("?");
  });
});

describe("monogramStyle", () => {
  it("is deterministic and drawn from the palette", () => {
    const style = monogramStyle("Netflix");
    expect(monogramStyle("Netflix")).toBe(style);
    expect(MONOGRAM_STYLES).toContain(style);
  });

  it("handles empty names", () => {
    expect(MONOGRAM_STYLES).toContain(monogramStyle(""));
  });
});
