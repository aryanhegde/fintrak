import { format, subDays } from "date-fns";

import { currentMonth, monthRange } from "@/lib/month";

type RangeParams = {
  from?: string | null;
  to?: string | null;
};

type ExplicitRange = {
  from: string;
  to: string;
};

function hasExplicitRange(params: RangeParams): params is ExplicitRange {
  return Boolean(params.from && params.to);
}

export function shouldCanonicalizeMonthRange(params: RangeParams) {
  return !hasExplicitRange(params);
}

export function effectiveMonthRange(params: RangeParams, now: Date) {
  const fallback = monthRange(currentMonth(now));

  if (!hasExplicitRange(params)) return fallback;

  return { from: params.from, to: params.to };
}

export function effectiveRollingRange(params: RangeParams, now: Date) {
  const fallback = {
    from: format(subDays(now, 30), "yyyy-MM-dd"),
    to: format(now, "yyyy-MM-dd"),
  };

  if (!hasExplicitRange(params)) return fallback;

  return { from: params.from, to: params.to };
}

export function effectiveRangeForPathname(
  pathname: string,
  params: RangeParams,
  now: Date
) {
  return pathname === "/"
    ? effectiveMonthRange(params, now)
    : effectiveRollingRange(params, now);
}
