"use client";

import { useMountedState } from "react-use";

import { NewAccountSheet } from "@/fearures/accounts/components/new-account-sheet";
import { EditAccountSheet } from "@/fearures/accounts/components/edit-account-sheet";

export const SheetProvider = () => {
  const isMounted = useMountedState();

  if (!isMounted) return null;

  return (
    <>
      <NewAccountSheet />
      <EditAccountSheet />
    </>
  );
};
