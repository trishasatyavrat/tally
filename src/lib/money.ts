// Money helpers.
//
// Prisma returns Decimal columns as Decimal objects, not JS numbers -
// deliberately, because floats cannot represent most decimal cents
// exactly. We convert to number only at the display boundary, and never
// do arithmetic on the converted value.
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";

export function formatUSD(value: Decimal | number | string): string {
  const n = typeof value === "number" ? value : Number(value.toString());
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Percentage of a cap that has been spent, clamped to [0, 100] for bar
// widths. Returns null when there is no cap to compare against.
export function percentOfCap(spent: number, cap: number | null): number | null {
  if (cap === null || cap <= 0) return null;
  return Math.min(100, Math.round((spent / cap) * 100));
}
