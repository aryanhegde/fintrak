"use client";

import { useEffect, useRef, useState } from "react";
import { startOfDay, subDays } from "date-fns";
import { Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, convertAmountToMiliunits } from "@/lib/utils";
import { useCreateTransaction } from "../api/use-create-transaction";
import { useQuickAdd } from "../hooks/use-quick-add";
import { getUserCategories } from "@/features/categories/api/use-get-categories";
import { useBootstrapCategories } from "@/features/categories/api/use-bootstrap-categories";

type QuickAddInput = {
  amount: string;
  categoryId: string;
  note: string;
  day: "today" | "yesterday";
  now?: Date;
};

export function quickAddPayload(input: QuickAddInput) {
  const amount = parseFloat(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const now = input.now ?? new Date();
  const date =
    input.day === "yesterday"
      ? startOfDay(subDays(now, 1))
      : startOfDay(now);

  return {
    amount: convertAmountToMiliunits(-amount),
    categoryId: input.categoryId,
    date,
    notes: input.note.trim() === "" ? null : input.note.trim(),
  };
}

export const QuickAddSheet = () => {
  const { isOpen, onClose } = useQuickAdd();

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [day, setDay] = useState<"today" | "yesterday">("today");

  const createMutation = useCreateTransaction();
  const categoryQuery = getUserCategories({ enabled: isOpen });
  const bootstrapMutation = useBootstrapCategories();
  const bootstrapAttempted = useRef(false);

  const categories = categoryQuery.data ?? [];

  useEffect(() => {
    if (
      isOpen &&
      categoryQuery.isSuccess &&
      categories.length === 0 &&
      !bootstrapAttempted.current
    ) {
      bootstrapAttempted.current = true;
      bootstrapMutation.mutate();
    }
  }, [isOpen, categoryQuery.isSuccess, categories.length, bootstrapMutation]);

  const payload =
    categoryId === null
      ? null
      : quickAddPayload({ amount, categoryId, note, day });

  const onSave = () => {
    if (!payload) return;
    createMutation.mutate(payload, {
      onSuccess: () => {
        setAmount("");
        setNote("");
        setDay("today");
        // categoryId intentionally kept — repeat entries are often same category
      },
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Quick add</SheetTitle>
          <SheetDescription>Log a spend in seconds.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 pt-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {categoryQuery.isLoading || bootstrapMutation.isPending ? (
              <Loader2 className="size-4 animate-spin text-slate-400" />
            ) : (
              categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    categoryId === category.id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {category.name}
                </button>
              ))
            )}
          </div>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount in rupees"
            className="h-16 text-center text-4xl font-semibold tabular-nums"
            autoFocus
          />
          <div className="flex gap-2">
            {(["today", "yesterday"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={day === option}
                onClick={() => setDay(option)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition",
                  day === option
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 text-slate-400"
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note"
          />
          <Button
            className="w-full"
            size="lg"
            disabled={!payload || createMutation.isPending}
            onClick={onSave}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
