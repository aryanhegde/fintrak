"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useMountedState } from "react-use";

import { useNewAccount } from "@/features/accounts/hooks/use-new-account";
import { useOpenAccount } from "@/features/accounts/hooks/use-open-account";
import { useNewCategory } from "@/features/categories/hooks/use-new-category";
import { useOpenCategory } from "@/features/categories/hooks/use-open-category";
import { useNewTransaction } from "@/features/transactions/hooks/use-new-transaction";
import { useOpenTransaction } from "@/features/transactions/hooks/use-open-transaction";
import { useQuickAdd } from "@/features/transactions/hooks/use-quick-add";

const LazyNewAccountSheet = dynamic(
  () =>
    import("@/features/accounts/components/new-account-sheet").then(
      (module) => module.NewAccountSheet
    ),
  { ssr: false }
);
const LazyEditAccountSheet = dynamic(
  () =>
    import("@/features/accounts/components/edit-account-sheet").then(
      (module) => module.EditAccountSheet
    ),
  { ssr: false }
);
const LazyNewCategorySheet = dynamic(
  () =>
    import("@/features/categories/components/new-category-sheet").then(
      (module) => module.NewCategorySheet
    ),
  { ssr: false }
);
const LazyEditCategorySheet = dynamic(
  () =>
    import("@/features/categories/components/edit-category-sheet").then(
      (module) => module.EditCategorySheet
    ),
  { ssr: false }
);
const LazyNewTransactionSheet = dynamic(
  () =>
    import("@/features/transactions/components/new-transaction-sheet").then(
      (module) => module.NewTransactionSheet
    ),
  { ssr: false }
);
const LazyEditTransactionSheet = dynamic(
  () =>
    import("@/features/transactions/components/edit-transaction-sheet").then(
      (module) => module.EditTransactionSheet
    ),
  { ssr: false }
);
const LazyQuickAddSheet = dynamic(
  () =>
    import("@/features/transactions/components/quick-add-sheet").then(
      (module) => module.QuickAddSheet
    ),
  { ssr: false }
);

const sheetKeys = [
  "newAccount",
  "editAccount",
  "newCategory",
  "editCategory",
  "newTransaction",
  "editTransaction",
  "quickAdd",
] as const;

type SheetKey = (typeof sheetKeys)[number];
type SheetVisibility = Record<SheetKey, boolean>;

export const getOpenSheetKeys = (visibility: SheetVisibility): SheetKey[] =>
  sheetKeys.filter((key) => visibility[key]);

const sheetComponents: Record<SheetKey, ComponentType> = {
  newAccount: LazyNewAccountSheet,
  editAccount: LazyEditAccountSheet,
  newCategory: LazyNewCategorySheet,
  editCategory: LazyEditCategorySheet,
  newTransaction: LazyNewTransactionSheet,
  editTransaction: LazyEditTransactionSheet,
  quickAdd: LazyQuickAddSheet,
};

export const SheetProvider = () => {
  const isMounted = useMountedState();
  const newAccount = useNewAccount((state) => state.isOpen);
  const editAccount = useOpenAccount((state) => state.isOpen);
  const newCategory = useNewCategory((state) => state.isOpen);
  const editCategory = useOpenCategory((state) => state.isOpen);
  const newTransaction = useNewTransaction((state) => state.isOpen);
  const editTransaction = useOpenTransaction((state) => state.isOpen);
  const quickAdd = useQuickAdd((state) => state.isOpen);

  if (!isMounted()) return null;

  const openSheetKeys = getOpenSheetKeys({
    newAccount,
    editAccount,
    newCategory,
    editCategory,
    newTransaction,
    editTransaction,
    quickAdd,
  });

  return (
    <>
      {openSheetKeys.map((key) => {
        const Sheet = sheetComponents[key];
        return <Sheet key={key} />;
      })}
    </>
  );
};
