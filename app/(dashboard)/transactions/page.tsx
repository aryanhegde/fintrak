"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

import { transactions as transactionSchema } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/utils";
import { useBulkCreateTransactions } from "@/features/transactions/api/use-bulk-create-transactions";
import { useBulkDeleteTransactions } from "@/features/transactions/api/use-bulk-delete-transactions";
import { getUserTransactions } from "@/features/transactions/api/use-get-transactions";
import { useNewTransaction } from "@/features/transactions/hooks/use-new-transaction";
import { useSelectAccount } from "@/features/accounts/hooks/use-select-account";

import { columns } from "./columns";
import ImportCard from "./import-card";
import { SummaryTilesLoading, TransactionsSummary } from "./summary-tiles";
import {
  TransactionsTable,
  TransactionsTableSkeleton,
} from "./transactions-table";
import { UploadButton } from "./upload-button";

enum VARIANTS {
  LIST = "LIST",
  IMPORT = "IMPORT",
}

const INITIAL_IMPORT_RESULTS = {
  data: [],
  errors: [],
  meta: {},
};

const PageHeader = ({
  subtitle,
  actions,
}: {
  subtitle: string;
  actions: React.ReactNode;
}) => (
  <div className="flex flex-col gap-y-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Transactions
      </h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
    {actions}
  </div>
);

const TransactionsPage = () => {
  const params = useSearchParams();

  const [AccountDialog, confirm] = useSelectAccount();
  const [variant, setVariant] = useState<VARIANTS>(VARIANTS.LIST);

  const [importResults, setImportResults] = useState(INITIAL_IMPORT_RESULTS);

  const onUpload = (results: typeof INITIAL_IMPORT_RESULTS) => {
    setImportResults(results);
    setVariant(VARIANTS.IMPORT);
  };

  const onCancelImport = () => {
    setImportResults(INITIAL_IMPORT_RESULTS);
    setVariant(VARIANTS.LIST);
  };

  const newTransaction = useNewTransaction();
  const createTransactions = useBulkCreateTransactions();
  const deleteTransactions = useBulkDeleteTransactions();

  const transactionsQuery = getUserTransactions();

  const transactions = transactionsQuery.data || [];

  const isDisabled = false;

  const onSubmitImport = async (
    values: (typeof transactionSchema.$inferInsert)[]
  ) => {
    const accountId = await confirm();

    if (!accountId) {
      return toast.error("Please add an account to continue.");
    }

    const data = values.map((value) => ({
      ...value,
      accountId: accountId as string,
    }));

    createTransactions.mutate(data, {
      onSuccess: () => {
        onCancelImport();
      },
    });
  };

  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  const dateRange = formatDateRange({ from, to });
  const subtitle = transactionsQuery.isLoading
    ? dateRange
    : `${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"} · ${dateRange}`;

  const headerActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <UploadButton onUpload={onUpload} />
      <Button
        size="sm"
        onClick={newTransaction.onOpen}
        className="h-9 w-full rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:w-auto"
      >
        <Plus className="mr-2 size-4" />
        Add transaction
      </Button>
    </div>
  );

  if (transactionsQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl py-8 pb-10">
        <div className="flex flex-col gap-6">
          <PageHeader subtitle={dateRange} actions={headerActions} />
          <SummaryTilesLoading />
          <TransactionsTableSkeleton />
        </div>
      </div>
    );
  }

  if (variant === VARIANTS.IMPORT) {
    return (
      <>
        <AccountDialog />
        <ImportCard
          data={importResults.data}
          onCancel={onCancelImport}
          onSubmit={onSubmitImport}
        />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl py-8 pb-10">
      <div className="flex flex-col gap-6">
        <PageHeader subtitle={subtitle} actions={headerActions} />
        <TransactionsSummary transactions={transactions} />
        <TransactionsTable
          columns={columns}
          data={transactions}
          filterKey="payee"
          onDelete={(row) => {
            const ids = row.map((r) => r.original.id);
            deleteTransactions.mutate({ ids });
          }}
          disabled={isDisabled}
          onAddNew={newTransaction.onOpen}
        />
      </div>
    </div>
  );
};

export default TransactionsPage;
