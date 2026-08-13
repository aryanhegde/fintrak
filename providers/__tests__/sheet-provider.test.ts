import { describe, expect, it } from "vitest";

describe("SheetProvider", () => {
  it("selects only the sheets whose stores are open", async () => {
    const sheetProvider = await import("@/providers/sheet-provider");

    expect(sheetProvider).toHaveProperty("getOpenSheetKeys");

    const getOpenSheetKeys = (
      sheetProvider as typeof sheetProvider & {
        getOpenSheetKeys: (
          visibility: Record<string, boolean>
        ) => Array<string>;
      }
    ).getOpenSheetKeys;

    expect(
      getOpenSheetKeys({
        newAccount: false,
        editAccount: true,
        newCategory: false,
        editCategory: false,
        newTransaction: true,
        editTransaction: false,
        quickAdd: true,
      })
    ).toEqual(["editAccount", "newTransaction", "quickAdd"]);
  });

  it("selects no sheet when every store is closed", async () => {
    const sheetProvider = await import("@/providers/sheet-provider");

    expect(sheetProvider).toHaveProperty("getOpenSheetKeys");

    const getOpenSheetKeys = (
      sheetProvider as typeof sheetProvider & {
        getOpenSheetKeys: (
          visibility: Record<string, boolean>
        ) => Array<string>;
      }
    ).getOpenSheetKeys;

    expect(
      getOpenSheetKeys({
        newAccount: false,
        editAccount: false,
        newCategory: false,
        editCategory: false,
        newTransaction: false,
        editTransaction: false,
        quickAdd: false,
      })
    ).toEqual([]);
  });
});
