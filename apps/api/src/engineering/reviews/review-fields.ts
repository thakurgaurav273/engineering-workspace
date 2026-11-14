import { BadRequestException } from '@nestjs/common';
import { ReviewType } from '@prisma/client';

export type ReviewField = 'wins' | 'challenges' | 'learning' | 'feedback' | 'rating';

/**
 * What each review type is made of. Both live in one table (WeeklyReview) but they are
 * different documents:
 *  - self:    the person on their own week - wins, challenges, learning. No rating: rating
 *             yourself isn't a performance score.
 *  - manager: a manager on a report's week - what went well, feedback, and the performance
 *             rating (the dashboard's "Avg performance score" averages these only).
 * Mirrored in the web app (applications/engineering/lib/reviews.ts).
 */
export const REVIEW_FIELDS: Record<ReviewType, readonly ReviewField[]> = {
  [ReviewType.self]: ['wins', 'challenges', 'learning'],
  [ReviewType.manager]: ['wins', 'feedback', 'rating'],
};

const ALL_FIELDS: ReviewField[] = ['wins', 'challenges', 'learning', 'feedback', 'rating'];
const SPOKEN: Record<ReviewField, string> = {
  wins: 'wins',
  challenges: 'challenges',
  learning: 'learning',
  feedback: 'feedback',
  rating: 'a rating',
};

/**
 * Rejects values in fields the review type doesn't use - e.g. a performance rating on a self
 * review. Clearing a field (null / empty) is always allowed.
 */
export function assertReviewFields(type: ReviewType, values: Partial<Record<ReviewField, unknown>>) {
  const allowed = REVIEW_FIELDS[type];
  const extra = ALL_FIELDS.filter((field) => {
    const value = values[field];
    return value !== undefined && value !== null && value !== '' && !allowed.includes(field);
  });
  if (extra.length) {
    throw new BadRequestException(
      `A ${type} review doesn't take ${extra.map((f) => SPOKEN[f]).join(' or ')}.`,
    );
  }
}
