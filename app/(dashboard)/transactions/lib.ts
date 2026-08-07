export const MONOGRAM_STYLES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
] as const;

export function summarizeTransactions(rows: { amount: number }[]) {
  let inflow = 0;
  let outflow = 0;

  for (const { amount } of rows) {
    if (amount > 0) inflow += amount;
    else outflow += Math.abs(amount);
  }

  return { inflow, outflow, net: inflow - outflow };
}

export function monogramInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return (words[0][0] + words[1][0]).toUpperCase();
}

export function monogramStyle(name: string) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);

  return MONOGRAM_STYLES[hash % MONOGRAM_STYLES.length];
}
