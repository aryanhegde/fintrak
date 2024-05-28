"use client";

import { useMountedState } from "react-use";

import { NewAccountSheet } from "@/fearures/accounts/components/new-account-sheet";

export const SheetProvider = () => {
  const isMounted = useMountedState();

  if (!isMounted) return null;

  return (
    <>
      <NewAccountSheet />
    </>
  );
};
