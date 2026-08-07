import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";
import { TableHeadSelect } from "./table-head-select";

type Props = {
  headers: string[];
  body: string[][];
  selectedColumns: Record<string, string | null>;
  onTableHeadSelectChange: (columnIndex: number, value: string | null) => void;
};

const ImportTable = ({
  body,
  headers,
  onTableHeadSelectChange,
  selectedColumns,
}: Props) => {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow>
            {headers.map((_item, index) => (
              <TableHead key={index} className="h-12 px-2">
                <TableHeadSelect
                  columnIndex={index}
                  selectedColumns={selectedColumns}
                  onChange={onTableHeadSelectChange}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {body.map((row: string[], index) => (
            <TableRow
              key={index}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
            >
              {row.map((cell, index) => (
                <TableCell
                  key={index}
                  className="px-4 py-2.5 text-sm text-slate-600 whitespace-nowrap"
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ImportTable;
