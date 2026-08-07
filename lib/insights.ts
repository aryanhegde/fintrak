import { addDays, differenceInCalendarDays, format } from "date-fns";

export type RecurringInput = {
  payee: string;
  amount: number; // miliunits, negative = expense
  date: Date;
};

export type RecurringPayment = {
  payee: string;
  amount: number; // miliunits, from the most recent occurrence
  cadence: "weekly" | "monthly";
  nextDate: string; // yyyy-MM-dd
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

export function detectRecurring(txns: RecurringInput[]): RecurringPayment[] {
  const groups = new Map<string, RecurringInput[]>();
  for (const txn of txns) {
    const key = txn.payee.trim().toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(txn);
    groups.set(key, group);
  }

  const results: RecurringPayment[] = [];

  for (const [key, group] of groups) {
    const sorted = [...group].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    // Cluster by amount: same sign, within ±10% of the cluster's first amount
    const clusters: RecurringInput[][] = [];
    for (const txn of sorted) {
      const cluster = clusters.find((c) => {
        const ref = c[0].amount;
        if (Math.sign(ref) !== Math.sign(txn.amount)) return false;
        const refAbs = Math.abs(ref);
        return refAbs > 0 && Math.abs(Math.abs(txn.amount) - refAbs) / refAbs <= 0.1;
      });
      if (cluster) cluster.push(txn);
      else clusters.push([txn]);
    }

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;

      const gaps: number[] = [];
      for (let i = 1; i < cluster.length; i++) {
        gaps.push(differenceInCalendarDays(cluster[i].date, cluster[i - 1].date));
      }
      const medianGap = median(gaps);

      let cadence: RecurringPayment["cadence"] | null = null;
      let tolerance = 0;
      if (medianGap >= 6 && medianGap <= 8) {
        cadence = "weekly";
        tolerance = 2;
      } else if (medianGap >= 25 && medianGap <= 35) {
        cadence = "monthly";
        tolerance = 5;
      }
      if (!cadence) continue;

      const stable = gaps.every((g) => Math.abs(g - medianGap) <= tolerance);
      if (!stable) continue;

      const last = cluster[cluster.length - 1];
      results.push({
        payee: last.payee.trim(),
        amount: last.amount,
        cadence,
        nextDate: format(addDays(last.date, Math.round(medianGap)), "yyyy-MM-dd"),
      });
    }
  }

  return results.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}
