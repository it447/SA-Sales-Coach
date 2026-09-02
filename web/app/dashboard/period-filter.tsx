"use client";

import { useRouter } from "next/navigation";
import { colors } from "../../lib/theme";
import { PERIOD_OPTIONS, type PeriodFilter } from "../../lib/dashboardGrouping";

export function PeriodFilterSelect({ value }: { value: PeriodFilter }) {
  const router = useRouter();

  return (
    <select
      value={value}
      onChange={(e) => router.push(`/dashboard?period=${e.target.value}`)}
      style={{
        background: colors.navyLight,
        color: colors.cream,
        border: `1px solid ${colors.navyBorder}`,
        borderRadius: "8px",
        padding: "0.5rem 0.75rem",
        fontSize: "0.85rem",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      {PERIOD_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
