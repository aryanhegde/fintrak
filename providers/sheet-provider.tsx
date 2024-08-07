"use client";

import { useMountedState } from "react-use";

import { EditAccountSheet } from "@/fearures/accounts/components/edit-account-sheet";
import { NewCategorySheet } from "@/fearures/categories/components/new-category-sheet";
import { EditCategorySheet } from "@/fearures/categories/components/edit-category-sheet";
import { NewTransactionSheet } from "@/fearures/transactions/components/new-transaction-sheet";
import { NewAccountSheet } from "@/fearures/accounts/components/new-account-sheet";
import { EditTransactionSheet } from "@/fearures/transactions/components/edit-transaction-sheet";

export const SheetProvider = () => {
  const isMounted = useMountedState();

  if (!isMounted) return null;

  return (
    <>
      <NewAccountSheet />
      <EditAccountSheet />
      <NewCategorySheet />
      <EditCategorySheet />
      <NewTransactionSheet />
      <EditTransactionSheet />
    </>
  );
};
