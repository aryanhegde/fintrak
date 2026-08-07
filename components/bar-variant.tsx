import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CustomTooltip } from "./custom-tooltip";

type Props = {
  data?: {
    date: string;
    income: number;
    expenses: number;
  }[];
};

export const BarVariant = ({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="4 4"
          vertical={false}
          stroke="#e2e8f0"
        />
        <defs>
          <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
            <stop offset="2%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="98%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="2%" stopColor="#f43f5e" stopOpacity={0.3} />
            <stop offset="98%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          axisLine={false}
          tickLine={false}
          dataKey="date"
          tickFormatter={(value) => format(value, "dd MMM")}
          style={{ fontSize: "12px" }}
          tick={{ fill: "#94a3b8" }}
          tickMargin={16}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={40}
          style={{ fontSize: "12px" }}
          tick={{ fill: "#94a3b8" }}
          tickFormatter={(value) =>
            Intl.NumberFormat("en-US", { notation: "compact" }).format(value)
          }
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="income" fill="url(#income)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="url(#expenses)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
