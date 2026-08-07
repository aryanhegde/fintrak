import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { CategoryTooltip } from "./category-tooltip";

const COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#cbd5e1", "#e2e8f0"];

const RADIAN = Math.PI / 180;

const renderPillLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent < 0.05) return null;
  const radius = (innerRadius + outerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const label = `${Math.round(percent * 100)}%`;
  const width = label.length * 7 + 14;

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x - width / 2}
        y={y - 11}
        width={width}
        height={22}
        rx={11}
        fill="#ffffff"
        stroke="#e2e8f0"
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={600}
        fill="#0f172a"
      >
        {label}
      </text>
    </g>
  );
};

type Props = {
  data: {
    name: string;
    value: number;
  }[];
};

export const PieVariant = ({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          content={({ payload }: any) => {
            return (
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4">
                {payload.map((entry: any, index: number) => (
                  <li
                    key={`item-${index}`}
                    className="flex items-center gap-x-2"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {entry.value}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }}
        />
        <Tooltip content={<CategoryTooltip />} />
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={65}
          paddingAngle={4}
          cornerRadius={6}
          dataKey="value"
          labelLine={false}
          label={renderPillLabel}
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};
