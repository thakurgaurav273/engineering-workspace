import { NotificationType } from '@prisma/client';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

type PreferenceCategory =
  | 'checkIns'
  | 'reviews'
  | 'recognition'
  | 'goals'
  | 'linearActivity'
  | 'systemAnnouncements';

const CATEGORY_BY_TYPE: Record<NotificationType, PreferenceCategory> = {
  CHECK_IN_CREATED: 'checkIns',
  CHECK_IN_REMINDER: 'checkIns',
  GOAL_ASSIGNED: 'goals',
  GOAL_UPDATED: 'goals',
  RECOGNITION_RECEIVED: 'recognition',
  REVIEW_REQUESTED: 'reviews',
  REVIEW_COMPLETED: 'reviews',
  LINEAR_ISSUE_ASSIGNED: 'linearActivity',
  LINEAR_ISSUE_UPDATED: 'linearActivity',
  SYSTEM: 'systemAnnouncements',
};

export function categoryForType(type: NotificationType): PreferenceCategory {
  return CATEGORY_BY_TYPE[type];
}

export class NotificationTemplates {
  static checkInCreated(authorName: string, checkInId: string, avatarUrl?: string | null): NotificationPayload {
    return {
      type: NotificationType.CHECK_IN_CREATED,
      title: 'New check-in',
      body: `${authorName} submitted today's check-in.`,
      entityType: 'checkin',
      entityId: checkInId,
      actionUrl: '/checkins',
      metadata: avatarUrl ? { avatarUrl } : undefined,
    };
  }

  static recognitionReceived(
    authorName: string,
    title: string,
    recognitionId: string,
    avatarUrl?: string | null,
  ): NotificationPayload {
    return {
      type: NotificationType.RECOGNITION_RECEIVED,
      title: 'You were recognized',
      body: `${authorName} recognized you: "${title}"`,
      entityType: 'recognition',
      entityId: recognitionId,
      actionUrl: '/recognition',
      metadata: avatarUrl ? { avatarUrl } : undefined,
    };
  }

  static reviewRequested(reviewerName: string, reviewId: string, avatarUrl?: string | null): NotificationPayload {
    return {
      type: NotificationType.REVIEW_REQUESTED,
      title: 'Weekly review started',
      body: `${reviewerName} started a weekly review for you.`,
      entityType: 'review',
      entityId: reviewId,
      actionUrl: '/reviews',
      metadata: avatarUrl ? { avatarUrl } : undefined,
    };
  }

  static reviewCompleted(reviewerName: string, reviewId: string, avatarUrl?: string | null): NotificationPayload {
    return {
      type: NotificationType.REVIEW_COMPLETED,
      title: 'Review completed',
      body: `${reviewerName} completed your weekly review.`,
      entityType: 'review',
      entityId: reviewId,
      actionUrl: '/reviews',
      metadata: avatarUrl ? { avatarUrl } : undefined,
    };
  }
}
