export type Priority = "high" | "medium" | "low";

export function calculatePriority(rank: number): Priority {
  if (rank <= 10) {
    return "high";
  }
  if (rank <= 50) {
    return "medium";
  }
  return "low";
}
