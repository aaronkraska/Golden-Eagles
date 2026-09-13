// Weighted positive - negative ranges from -1.5 to 8.5. Shift by 1.5
// then multiply by 10 to normalize to [0,100]. Model never sets the final score.
export const WEIGHTS = {
  businessImpact: 0.35,
  timeSavingPotential: 0.2,
  repetition: 0.15,
  dataReadiness: 0.15,
  implementationComplexity: -0.08,
  risk: -0.07,
};
// Validate again at the scoring boundary so direct callers cannot bypass the rating bounds.
export function scoreOpportunity(item) {
  const weighted = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
    if (!Number.isFinite(item[key]) || item[key] < 0 || item[key] > 10)
      throw new Error("Invalid component rating");
    return sum + item[key] * weight;
  }, 0);
  return Math.round((weighted + 1.5) * 10);
}
// Copy items with fresh scores, then sort descending with alphabetical titles breaking ties.
export const rank = (items) =>
  items
    .map((item) => ({ ...item, opportunityScore: scoreOpportunity(item) }))
    .sort(
      (a, b) =>
        b.opportunityScore - a.opportunityScore ||
        a.title.localeCompare(b.title),
    );
