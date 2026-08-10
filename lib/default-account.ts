import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import { db } from "@/db/drizzle";
import { accounts } from "@/db/schema";

const DEFAULT_ACCOUNT_NAME = "Cash";

export async function ensureDefaultAccount(userId: string) {
  const [existing] = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(accounts)
    .values({ id: createId(), name: DEFAULT_ACCOUNT_NAME, userId })
    .returning({ id: accounts.id, name: accounts.name });

  return created;
}
