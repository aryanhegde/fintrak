import {
  addMonths,
  endOfMonth,
  format,
  parse,
  startOfMonth,
  subMonths,
} from "date-fns";

function parseMonth(month: string) {
  return parse(month, "yyyy-MM", new Date());
}

export function monthRange(month: string) {
  const date = parseMonth(month);
  return {
    from: format(startOfMonth(date), "yyyy-MM-dd"),
    to: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function prevMonth(month: string) {
  return format(subMonths(parseMonth(month), 1), "yyyy-MM");
}

export function nextMonth(month: string) {
  return format(addMonths(parseMonth(month), 1), "yyyy-MM");
}

export function monthLabel(month: string) {
  return format(parseMonth(month), "MMMM yyyy");
}

export function currentMonth(now: Date = new Date()) {
  return format(now, "yyyy-MM");
}
