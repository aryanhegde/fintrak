"use client";

import { Plus } from "lucide-react";

import { useQuickAdd } from "@/features/transactions/hooks/use-quick-add";
import { Button } from "@/components/ui/button";

export const QuickAddButton = () => {
  const { onOpen } = useQuickAdd();

  return (
    <Button
      onClick={onOpen}
      size="icon"
      aria-label="Quick add expense"
      className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-blue-600 shadow-lg hover:bg-blue-700"
    >
      <Plus className="size-6" />
    </Button>
  );
};
