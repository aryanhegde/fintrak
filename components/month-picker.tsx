"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import qs from "query-string";

import {
  currentMonth,
  monthLabel,
  monthRange,
  nextMonth,
  prevMonth,
} from "@/lib/month";
import { Button } from "@/components/ui/button";

export const MonthPicker = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const from = params.get("from");
  // Selected month is derived from the from param (yyyy-MM-dd → yyyy-MM).
  const month = from ? from.slice(0, 7) : currentMonth();

  const pushMonth = (target: string, replace = false) => {
    const range = monthRange(target);
    const url = qs.stringifyUrl(
      {
        url: pathname,
        query: {
          ...Object.fromEntries(params.entries()),
          from: range.from,
          to: range.to,
        },
      },
      { skipEmptyString: true, skipNull: true }
    );
    if (replace) {
      router.replace(url);
    } else {
      router.push(url);
    }
  };

  useEffect(() => {
    if (!from) {
      pushMonth(month, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atCurrentMonth = month >= currentMonth();

  return (
    <div className="flex items-center gap-x-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => pushMonth(prevMonth(month))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-semibold text-slate-900">
        {monthLabel(month)}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        disabled={atCurrentMonth}
        onClick={() => pushMonth(nextMonth(month))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
};
