import { describe, expect, it } from "vitest";

import {
  accountNameSchema as apiAccountNameSchema,
  categoryNameSchema as apiCategoryNameSchema,
  notesSchema as apiNotesSchema,
  payeeSchema as apiPayeeSchema,
} from "@/lib/api-validation";
import {
  accountNameSchema,
  categoryNameSchema,
  notesSchema,
  payeeSchema,
} from "@/lib/validation";

describe("framework-neutral validation", () => {
  it("exports the bounded schemas without the Hono adapter", () => {
    expect(accountNameSchema.parse("  Cash  ")).toBe("Cash");
    expect(categoryNameSchema.safeParse(" ").success).toBe(false);
    expect(payeeSchema.safeParse("x".repeat(121)).success).toBe(false);
    expect(notesSchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("preserves the api-validation public schema exports", () => {
    expect(apiAccountNameSchema).toBe(accountNameSchema);
    expect(apiCategoryNameSchema).toBe(categoryNameSchema);
    expect(apiPayeeSchema).toBe(payeeSchema);
    expect(apiNotesSchema).toBe(notesSchema);
  });
});
