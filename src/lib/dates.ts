// Plain helpers - deliberately NOT in actions.ts, because every export
// from a "use server" file must be an async Server Action. A sync helper
// exported alongside them is a build error.
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
