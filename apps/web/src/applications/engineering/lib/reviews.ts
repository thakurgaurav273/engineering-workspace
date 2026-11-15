// What each weekly review type asks for. Self and manager reviews share one table but are
// different documents - mirrors apps/api/src/engineering/reviews/review-fields.ts, which
// rejects fields a type doesn't use.

export type ReviewType = "self" | "manager";
export type ReviewTextField = "wins" | "challenges" | "learning" | "feedback";

export interface ReviewFieldSpec {
  key: ReviewTextField;
  label: string;
  placeholder: string;
  required?: boolean;
}

export const REVIEW_TEXT_FIELDS: Record<ReviewType, ReviewFieldSpec[]> = {
  // The person on their own week.
  self: [
    { key: "wins", label: "Wins", placeholder: "What went well this week?", required: true },
    {
      key: "challenges",
      label: "Challenges",
      placeholder: "What was hard, or slowed you down?",
    },
    { key: "learning", label: "Learning", placeholder: "What did you learn?" },
  ],
  // A manager on a report's week.
  manager: [
    {
      key: "wins",
      label: "What went well",
      placeholder: "What did they do well this week?",
      required: true,
    },
    {
      key: "feedback",
      label: "Feedback",
      placeholder: "What should they keep doing, or do differently next week?",
      required: true,
    },
  ],
};

/** Only a manager review carries a rating - it's the performance score, not a self-assessment. */
export const REVIEW_HAS_RATING: Record<ReviewType, boolean> = { self: false, manager: true };

export const RATING_LABELS: Record<number, string> = {
  1: "Below expectations",
  2: "Needs improvement",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
};

const PLAIN_LABEL: Record<ReviewTextField, string> = {
  wins: "Wins",
  challenges: "Challenges",
  learning: "Learning",
  feedback: "Feedback",
};

/**
 * The sections to show for a saved review: its type's fields in its type's wording, then
 * anything an older review stored outside them (written before the types had their own
 * fields), so nothing already written is hidden.
 */
export function reviewSections(
  review: { type: ReviewType } & Partial<Record<ReviewTextField, string | null>>,
): { label: string; value: string | null }[] {
  const own = REVIEW_TEXT_FIELDS[review.type];
  const extra = (Object.keys(PLAIN_LABEL) as ReviewTextField[]).filter(
    (key) => !own.some((f) => f.key === key) && review[key],
  );
  return [
    ...own.map((f) => ({ label: f.label, value: review[f.key] ?? null })),
    ...extra.map((key) => ({ label: PLAIN_LABEL[key], value: review[key] ?? null })),
  ];
}
