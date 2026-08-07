import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
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

export const LineVariant = ({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="4 4"
          vertical={false}
          stroke="#e2e8f0"
        />
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
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
        <Line
          dot={false}
          strokeWidth={2.5}
          dataKey="income"
          stroke="#2563eb"
        />
        <Line
          dot={false}
          strokeWidth={2.5}
          dataKey="expenses"
          stroke="#f43f5e"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
