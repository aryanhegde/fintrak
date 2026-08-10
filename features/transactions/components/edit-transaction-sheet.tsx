import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { insertTransactionSchema } from "@/db/schema";
import { useConfirm } from "@/hooks/use-confirm";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { useDeleteTransaction } from "../api/use-delete-transaction";
import { useEditTransaction } from "../api/use-edit-transaction";
import { getUserTransaction } from "../api/use-get-transaction";
import { useOpenTransaction } from "../hooks/use-open-transaction";
import { TransactionForm } from "./transaction-form";
import { getUserCategories } from "@/features/categories/api/use-get-categories";
import { useCreateCategory } from "@/features/categories/api/use-create-category";

const formSchema = insertTransactionSchema
  .omit({
    id: true,
    accountId: true,
  })
  .extend({
    accountId: z.string().optional(),
  });

type FormValues = z.input<typeof formSchema>;

export const EditTransactionSheet = () => {
  const { isOpen, onClose, id } = useOpenTransaction();

  const [ConfirmDialog, confirm] = useConfirm(
    "Are you sure?",
    "You are about to delete this transaction."
  );

  const transactionQuery = getUserTransaction(id);
  const editMutation = useEditTransaction(id);
  const deleteMutation = useDeleteTransaction(id);

  const categoryQuery = getUserCategories();
  const categoryMutation = useCreateCategory();
  const onCreateCategory = (name: string) =>
    categoryMutation.mutate({
      name,
    });
  const categoryOptions = (categoryQuery.data ?? []).map((category) => ({
    label: category.name,
    value: category.id,
  }));

  const isPending =
    editMutation.isPending ||
    deleteMutation.isPending ||
    transactionQuery.isLoading ||
    categoryMutation.isPending;

  const isLoading = transactionQuery.isLoading || categoryQuery.isLoading;

  const onSubmit = (values: FormValues) => {
    // accountId is unregistered on the form (no account field is rendered),
    // but react-hook-form keeps it from defaultValues, which are always
    // populated from the fetched transaction by the time the form can be
    // submitted — so it round-trips through PATCH unchanged.
    editMutation.mutate(
      { ...values, accountId: values.accountId! },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const onDelete = async () => {
    const ok = await confirm();

    if (ok) {
      deleteMutation.mutate(undefined, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const defaultValues = transactionQuery.data
    ? {
        accountId: transactionQuery.data.accountId,
        categoryId: transactionQuery.data.categoryId,
        amount: transactionQuery.data.amount.toString(),
        date: transactionQuery.data.date
          ? new Date(transactionQuery.data.date)
          : new Date(),
        payee: transactionQuery.data.payee ?? "",
        notes: transactionQuery.data.notes,
      }
    : {
        accountId: "",
        categoryId: "",
        amount: "",
        date: new Date(),
        payee: "",
        notes: "",
      };
  return (
    <>
      <ConfirmDialog />
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="space-y-4">
          <SheetHeader>
            <SheetTitle>Edit Transaction</SheetTitle>
            <SheetDescription>Edit an existing transaction</SheetDescription>
          </SheetHeader>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-4 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <TransactionForm
              id={id}
              defaultValues={defaultValues}
              onSubmit={onSubmit}
              onDelete={onDelete}
              disabled={isPending}
              categoryOptions={categoryOptions}
              onCreateCategory={onCreateCategory}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
