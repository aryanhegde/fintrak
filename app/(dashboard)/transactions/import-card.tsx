import { Button } from "@/components/ui/button";
import { useState } from "react";
import ImportTable from "./import-table";
import { CheckCircle2, Circle } from "lucide-react";
import { cn, convertAmountToMiliunits } from "@/lib/utils";
import { format, parse } from "date-fns";

const dateFormat = "yyyy-MM-dd HH:mm";
const outputFormat = "yyyy-MM-dd";

const requiredOptions = ["amount", "date", "payee"];

interface SelectedColumnState {
  [key: string]: string | null;
}

type Props = {
  data: string[][];
  onCancel: () => void;
  onSubmit: (data: any) => void;
};

const ImportCard = ({ data, onCancel, onSubmit }: Props) => {
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumnState>(
    {}
  );

  const headers = data[0];
  const body = data.slice(1);

  const onTableHeadSelectChange = (
    columnIndex: number,
    value: string | null
  ) => {
    setSelectedColumns((prev) => {
      const newSelectedColumns = { ...prev };

      for (const key in newSelectedColumns) {
        if (newSelectedColumns[key] === value) {
          newSelectedColumns[key] = null;
        }
      }

      if (value === "skip") {
        value = null;
      }

      newSelectedColumns[`column_${columnIndex}`] = value;
      return newSelectedColumns;
    });
  };

  const progress = Object.values(selectedColumns).filter(Boolean).length;

  const handleContinue = () => {
    const getColumnIndex = (column: string) => {
      return column.split("_")[1];
    };

    const mappedData = {
      headers: headers.map((_header, index) => {
        const columnIndex = getColumnIndex(`column_${index}`);
        return selectedColumns[`column_${columnIndex}`] || null;
      }),
      body: body
        .map((row) => {
          const transformedRow = row.map((cell, index) => {
            const columnIndex = getColumnIndex(`column_${index}`);
            return selectedColumns[`column_${columnIndex}`] ? cell : null;
          });

          return transformedRow.every((item) => item === null)
            ? []
            : transformedRow;
        })
        .filter((row) => row.length > 0),
    };

    const arrayOfData = mappedData.body.map((row) => {
      return row.reduce((acc: any, cell, index) => {
        const header = mappedData.headers[index];
        if (header !== null) {
          acc[header] = cell;
        }
        return acc;
      }, {});
    });

    const formattedData = arrayOfData.map((item) => ({
      ...item,
      amount: convertAmountToMiliunits(parseFloat(item.amount)),
      date: format(parse(item.date, dateFormat, new Date()), outputFormat),
    }));

    onSubmit(formattedData);
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl py-8 pb-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-y-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Import transactions
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Map your CSV columns — date, payee and amount are required.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              className="h-9 w-full rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleContinue}
              disabled={progress < requiredOptions.length}
              className="h-9 w-full rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:w-auto"
            >
              Continue
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Match columns
            </span>
            {["date", "payee", "amount"].map((option) => {
              const isMapped = Object.values(selectedColumns).includes(option);

              return (
                <span
                  key={option}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                    isMapped
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {isMapped ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                  {option}
                </span>
              );
            })}
          </div>
          <div className="p-5">
            <ImportTable
              headers={headers}
              body={body}
              selectedColumns={selectedColumns}
              onTableHeadSelectChange={onTableHeadSelectChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportCard;
