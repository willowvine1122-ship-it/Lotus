import type { Health } from "@/lib/types";

const stroke: Record<Health, string> = {
  green: "var(--green)",
  amber: "var(--amber)",
  red: "var(--red)",
};

export function Sparkline({
  values,
  health,
  width = 120,
  height = 32,
}: {
  values: number[];
  health: Health;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="7-day trend"
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke[health]}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
