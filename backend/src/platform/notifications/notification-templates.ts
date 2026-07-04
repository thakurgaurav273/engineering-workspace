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
  | 'systemAnnouncements'
  | 'workspace';

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
  TASK_UPDATE_POSTED: 'linearActivity',
  SYSTEM: 'systemAnnouncements',
  WORKSPACE_ITEM_ASSIGNED: 'workspace',
  WORKSPACE_ITEM_REMINDER: 'workspace',
  WORKSPACE_ITEM_COMMENT: 'workspace',
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

  static taskUpdatePosted(
    authorName: string,
    issueIdentifier: string,
    issueId: string,
    taskUpdateId: string,
    avatarUrl?: string | null,
  ): NotificationPayload {
    return {
      type: NotificationType.TASK_UPDATE_POSTED,
      title: 'New task update',
      body: `${authorName} posted an update on ${issueIdentifier}.`,
      entityType: 'task-update',
      entityId: taskUpdateId,
      actionUrl: `/task-updates/${issueId}`,
      metadata: avatarUrl ? { avatarUrl } : undefined,
    };
  }

  static linearIssueAssigned(issueIdentifier: string, issueTitle: string, issueId: string): NotificationPayload {
    return {
      type: NotificationType.LINEAR_ISSUE_ASSIGNED,
      title: 'New issue assigned',
      body: `${issueIdentifier} - ${issueTitle}`,
      entityType: 'linear-issue',
      entityId: issueId,
      actionUrl: `/task-updates/${issueId}`,
    };
  }

  static workspaceItemAssigned(
    assignerName: string,
    itemId: string,
    itemTitle: string,
    avatarUrl?: string | null,
  ): NotificationPayload {
    return {
      type: NotificationType.WORKSPACE_ITEM_ASSIGNED,
      title: 'New Action Item',
      body: `${assignerName} assigned you a new action item: "${itemTitle}"`,
      entityType: 'workspace-item',
      entityId: itemId,
      actionUrl: `/workspace/${itemId}`,
      metadata: avatarUrl ? { avatarUrl } : undefined,
    };
  }

  static workspaceItemReminder(
    stage: 'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE',
    itemId: string,
    itemTitle: string,
  ): NotificationPayload {
    const copy = {
      DUE_SOON: { title: 'Action item due tomorrow', body: `"${itemTitle}" is due tomorrow.` },
      DUE_TODAY: { title: 'Action item due today', body: `"${itemTitle}" is due today.` },
      OVERDUE: { title: 'Action item overdue', body: `"${itemTitle}" is overdue.` },
    }[stage];

    return {
      type: NotificationType.WORKSPACE_ITEM_REMINDER,
      title: copy.title,
      body: copy.body,
      entityType: 'workspace-item',
      entityId: itemId,
      actionUrl: `/workspace/${itemId}`,
    };
  }

  static workspaceItemComment(
    commenterName: string,
    itemId: string,
    itemTitle: string,
    avatarUrl?: string | null,
  ): NotificationPayload {
    return {
      type: NotificationType.WORKSPACE_ITEM_COMMENT,
      title: 'New comment',
      body: `${commenterName} commented on "${itemTitle}"`,
      entityType: 'workspace-item',
      entityId: itemId,
      actionUrl: `/workspace/${itemId}`,
      metadata: avatarUrl ? { avatarUrl } : undefined,
    };
  }
}
