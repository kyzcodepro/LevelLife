"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function LqiTrend({
  data,
}: {
  data: { week: string; total: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="#232a3b" strokeDasharray="3 3" />
          <XAxis dataKey="week" tick={{ fill: "#8b93a7", fontSize: 11 }} />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#8b93a7", fontSize: 11 }}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1b2130",
              border: "1px solid #232a3b",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#7C5CFF"
            strokeWidth={2.5}
            dot={{ fill: "#7C5CFF", r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
