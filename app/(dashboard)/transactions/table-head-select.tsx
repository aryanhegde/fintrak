import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Props = {
  columnIndex: number;
  selectedColumns: Record<string, string | null>;
  onChange: (columnIndex: number, value: string | null) => void;
};

const options = ["amount", "payee", "date"];

export const TableHeadSelect = ({
  columnIndex,
  onChange,
  selectedColumns,
}: Props) => {
  const currentSelection = selectedColumns[`column_${columnIndex}`];

  return (
    <Select
      value={currentSelection || ""}
      onValueChange={(value) => onChange(columnIndex, value)}
    >
      <SelectTrigger
        className={cn(
          "h-8 w-full min-w-32 rounded-lg border px-2.5 text-xs font-medium capitalize outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0",
          currentSelection
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-500"
        )}
      >
        <SelectValue placeholder="skip" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="skip">Skip </SelectItem>
        {options.map((option, index) => {
          const disabled =
            Object.values(selectedColumns).includes(option) &&
            selectedColumns[`column_${columnIndex}`] !== option;

          return (
            <SelectItem
              key={index}
              value={option}
              disabled={disabled}
              className="capitalize"
            >
              {option}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
