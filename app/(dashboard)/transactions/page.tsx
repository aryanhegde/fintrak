"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusIcon } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useBulkDeleteTransactions } from "@/fearures/transactions/api/use-bulk-delete-transactions";
import { getUserTransactions } from "@/fearures/transactions/api/use-get-transactions";
import { useNewTransaction } from "@/fearures/transactions/hooks/use-new-transaction";
import { columns } from "./columns";

const TransactionsPage = () => {
  const newTransaction = useNewTransaction();
  const deleteTransactions = useBulkDeleteTransactions();

  const transactionsQuery = getUserTransactions();

  const transactions = transactionsQuery.data || [];

  const isDisabled = false;

  if (transactionsQuery.isLoading) {
    return (
      <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-24">
        <Card className="border-none drop-shadow-sm">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <div className="h-[500px] w-full flex items-center justify-center">
              <Loader2 className="size-6 text-slate-300 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-24">
      <Card className="border-none drop-shadow-sm">
        <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-xl line-clamp-1">
            Transaction History
          </CardTitle>
          <Button size="sm" onClick={newTransaction.onOpen}>
            <PlusIcon className="size-4 mr-2" />
            Add New
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={transactions}
            filterKey="payee"
            onDelete={(row) => {
              const ids = row.map((r) => r.original.id);
              deleteTransactions.mutate({ ids });
            }}
            disabled={isDisabled}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsPage;
