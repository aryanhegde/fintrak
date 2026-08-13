"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { ChevronDown } from "lucide-react";
import qs from "query-string";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { cn, formatDateRange } from "@/lib/utils";
import { effectiveRangeForPathname } from "@/lib/query-range";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";

type CompleteDateRange = {
  from: Date;
  to: Date;
};

const toDateRange = (range: {
  from: string;
  to: string;
}): CompleteDateRange => ({
  from: parseISO(range.from),
  to: parseISO(range.to),
});

export const DateFilter = () => {
  const router = useRouter();
  const pathname = usePathname();

  const params = useSearchParams();
  const accountId = params.get("accountId");
  const from = params.get("from");
  const to = params.get("to");
  const now = new Date();

  const effectiveRange = effectiveRangeForPathname(
    pathname,
    { from, to },
    now
  );
  const defaultRange = effectiveRangeForPathname(pathname, {}, now);
  const effectiveFrom = effectiveRange.from;
  const effectiveTo = effectiveRange.to;

  const [date, setDate] = useState<DateRange | undefined>(() =>
    toDateRange(effectiveRange)
  );

  useEffect(() => {
    setDate(toDateRange({ from: effectiveFrom, to: effectiveTo }));
  }, [effectiveFrom, effectiveTo]);

  const pushToUrl = (dateRange: DateRange | undefined) => {
    const range = dateRange?.from && dateRange.to
      ? {
          from: format(dateRange.from, "yyyy-MM-dd"),
          to: format(dateRange.to, "yyyy-MM-dd"),
        }
      : defaultRange;
    const query = {
      ...range,
      accountId,
    };

    const url = qs.stringifyUrl(
      {
        url: pathname,
        query,
      },
      { skipEmptyString: true, skipNull: true }
    );

    router.push(url);
  };

  const onReset = () => {
    setDate(toDateRange(defaultRange));
    pushToUrl(undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          disabled={false}
          size="sm"
          variant="outline"
          className="lg:w-auto w-full h-9 rounded-md px-3 font-normal bg-white/10 hover:bg-white/20 hover:text-white border-none focus:ring-offset-0 focus:ring-transparent outline-none text-white focus:bg-white/30 transition"
        >
          <span>{formatDateRange(toDateRange(effectiveRange))}</span>
          <ChevronDown className="ml-2 size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="lg:w-auto w-full p-0" align="start">
        <Calendar
          key={`${effectiveFrom}:${effectiveTo}`}
          disabled={false}
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
        />
        <div className="p-4 w-full flex items-center gap-x-2">
          <PopoverClose asChild>
            <Button
              onClick={onReset}
              disabled={!date?.from || !date?.to}
              className="w-full"
              variant="outline"
            >
              Reset
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button
              onClick={() => pushToUrl(date)}
              disabled={!date?.from || !date?.to}
              className="w-full"
            >
              Apply
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
};
