import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  accountNameSchema,
  categoryNameSchema,
  notesSchema,
  payeeSchema,
} from "@/lib/validation";

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    plaidId: text("plaid_id"),
    name: text("name").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => ({
    userIdIdx: index("accounts_user_id_idx").on(table.userId),
  })
);

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}));

export const insertAccountSchema = createInsertSchema(accounts, {
  name: accountNameSchema,
});

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    plaidId: text("plaid_id"),
    name: text("name").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => ({
    userIdNameUnique: uniqueIndex("categories_user_id_name_unique").on(
      table.userId,
      table.name
    ),
  })
);

export const insertCategorySchema = createInsertSchema(categories, {
  name: categoryNameSchema,
});

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    amount: integer("amount").notNull(),
    payee: text("payee"),
    notes: text("notes"),
    date: timestamp("date", { mode: "date" }).notNull(),
    accountId: text("account_id")
      .references(() => accounts.id, {
        onDelete: "cascade",
      })
      .notNull(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    accountIdDateIdx: index("transactions_account_id_date_idx").on(
      table.accountId,
      table.date
    ),
  })
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  transactions: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
}));

export const insertTransactionSchema = createInsertSchema(transactions, {
  date: z.coerce.date(),
  payee: payeeSchema,
  notes: notesSchema,
});
