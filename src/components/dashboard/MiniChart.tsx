"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

export default function MiniChart({
  data,
  color,
}: {
  data: { v: number }[];
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
