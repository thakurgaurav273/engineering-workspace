-- Squashed baseline for the Grovyn One schema.
--
-- The three original foundation migrations were never committed to git, so the
-- prior migration history could not build a schema from an empty database. This
-- baseline is generated from prisma/schema.prisma and replaces that history.
--
-- Every statement is idempotent: on a database that already has this schema the
-- migration is a no-op, so `prisma migrate deploy` records it without altering
-- any data. That lets an existing deployment adopt the baseline in place.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CheckInStatus" AS ENUM ('on_track', 'blocked', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "GoalVisibility" AS ENUM ('personal', 'team');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReviewType" AS ENUM ('self', 'manager');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'submitted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationPlatform" AS ENUM ('WEB', 'ANDROID', 'IOS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('CHECK_IN_CREATED', 'CHECK_IN_REMINDER', 'CHECK_IN_BLOCKED', 'WEEKLY_REVIEW_REMINDER', 'WEEKLY_DIGEST', 'GOAL_ASSIGNED', 'GOAL_UPDATED', 'RECOGNITION_RECEIVED', 'REVIEW_REQUESTED', 'REVIEW_COMPLETED', 'LINEAR_ISSUE_ASSIGNED', 'LINEAR_ISSUE_UPDATED', 'TASK_UPDATE_POSTED', 'SYSTEM', 'WORKSPACE_ITEM_ASSIGNED', 'WORKSPACE_ITEM_REMINDER', 'WORKSPACE_ITEM_COMMENT', 'WORKSPACE_ITEM_STATUS_CHANGED', 'MENTIONED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LinearWorkflowType" AS ENUM ('backlog', 'unstarted', 'started', 'completed', 'canceled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskUpdateStatus" AS ENUM ('on_track', 'at_risk', 'blocked', 'in_review', 'done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskUpdateAttachmentKind" AS ENUM ('file', 'image', 'voice_note');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "WorkspaceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "WorkspacePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "WorkspaceSource" AS ENUM ('MANUAL', 'LINEAR', 'SLACK', 'WHATSAPP', 'EMAIL', 'MEETING', 'PHONE_CALL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "WorkspaceReminderStage" AS ENUM ('NONE', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'ORG');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InstallationState" AS ENUM ('INSTALLED', 'DISABLED', 'MAINTENANCE', 'UNINSTALLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ClientType" AS ENUM ('COMPANY', 'INDIVIDUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "BusinessDocumentType" AS ENUM ('INVOICE', 'QUOTATION', 'OFFER_LETTER', 'PROPOSAL', 'PURCHASE_ORDER', 'RECEIPT', 'CREDIT_NOTE', 'DELIVERY_NOTE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NumberResetMode" AS ENUM ('NEVER', 'YEARLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'PROFORMA', 'TAX', 'CREDIT_NOTE', 'DEBIT_NOTE', 'RECURRING', 'ADVANCE', 'FINAL_SETTLEMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaxPriceMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaxRoundingMode" AS ENUM ('NONE', 'NEAREST', 'UP', 'DOWN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'CHEQUE', 'STRIPE', 'RAZORPAY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "OfferLetterStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "linearApiKey" TEXT,
    "linearWorkspaceName" TEXT,
    "linearConnectedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "signatureUrl" TEXT,
    "orgId" TEXT NOT NULL,
    "managerId" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultOrganizationId" TEXT,
    "lastActiveOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "managerId" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "joinedAt" TIMESTAMP(3),
    "invitedByMembershipId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationSwitchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromOrgId" TEXT,
    "toOrgId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationSwitchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "defaultRole" "Role" NOT NULL DEFAULT 'MEMBER',
    "allowGuestAccess" BOOLEAN NOT NULL DEFAULT false,
    "invitationPolicy" TEXT NOT NULL DEFAULT 'admin_only',
    "onboardingDefaults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserPreference" (
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "dailyCheckinReminder" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReviewReminder" BOOLEAN NOT NULL DEFAULT true,
    "reminderTime" TEXT NOT NULL DEFAULT '16:30',
    "weeklyReviewReminderDay" INTEGER NOT NULL DEFAULT 5,
    "autoShareRecognition" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "CheckInStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "blockers" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assignedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "visibility" "GoalVisibility" NOT NULL DEFAULT 'personal',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoalHistory" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyReview" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "type" "ReviewType" NOT NULL,
    "weekStart" DATE NOT NULL,
    "wins" TEXT,
    "challenges" TEXT,
    "learning" TEXT,
    "feedback" TEXT,
    "rating" INTEGER,
    "status" "ReviewStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Recognition" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushDevice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "NotificationPlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "browser" TEXT,
    "deviceName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkIns" BOOLEAN NOT NULL DEFAULT true,
    "checkInBlockers" BOOLEAN NOT NULL DEFAULT true,
    "reviews" BOOLEAN NOT NULL DEFAULT true,
    "recognition" BOOLEAN NOT NULL DEFAULT true,
    "goals" BOOLEAN NOT NULL DEFAULT true,
    "linearActivity" BOOLEAN NOT NULL DEFAULT true,
    "systemAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "workspace" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LinearIssue" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "linearId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "stateType" "LinearWorkflowType" NOT NULL,
    "priority" INTEGER,
    "estimate" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "assigneeId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinearIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskUpdate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "progress" INTEGER,
    "status" "TaskUpdateStatus" NOT NULL,
    "timeSpentMinutes" INTEGER,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskUpdateAttachment" (
    "id" TEXT NOT NULL,
    "taskUpdateId" TEXT NOT NULL,
    "kind" "TaskUpdateAttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskUpdateAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "assignedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "WorkspacePriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "source" "WorkspaceSource" NOT NULL DEFAULT 'MANUAL',
    "reminderStage" "WorkspaceReminderStage" NOT NULL DEFAULT 'NONE',
    "isClientProject" BOOLEAN NOT NULL DEFAULT false,
    "watcherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspaceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceItemComment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceItemCommentAttachment" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "kind" "TaskUpdateAttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceItemCommentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuthzRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthzRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationInstallation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "applicationKey" TEXT NOT NULL,
    "state" "InstallationState" NOT NULL DEFAULT 'INSTALLED',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationConfiguration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "applicationKey" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanyProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT,
    "logoUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "gstin" TEXT,
    "pan" TEXT,
    "cin" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "upiId" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "invoiceFooterNotes" TEXT,
    "authorizedSignatoryName" TEXT,
    "authorizedSignatoryDesignation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'COMPANY',
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "contactPersonName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "taxId" TEXT,
    "billingLine1" TEXT,
    "billingLine2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT DEFAULT 'India',
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentNumberSequence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "documentType" "BusinessDocumentType" NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "separator" TEXT NOT NULL DEFAULT '-',
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "resetMode" "NumberResetMode" NOT NULL DEFAULT 'NEVER',
    "useFinancialYear" BOOLEAN NOT NULL DEFAULT false,
    "periodKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'STANDARD',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "terms" TEXT,
    "priceMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "companySnapshot" JSONB,
    "clientSnapshot" JSONB,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundOff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxBreakdown" JSONB,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
    "taxes" JSONB,
    "notes" TEXT,
    "lineTaxable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Quotation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "number" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "terms" TEXT,
    "priceMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "companySnapshot" JSONB,
    "clientSnapshot" JSONB,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundOff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxBreakdown" JSONB,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
    "taxes" JSONB,
    "notes" TEXT,
    "lineTaxable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regime" TEXT NOT NULL DEFAULT 'IN_GST',
    "homeCountry" TEXT NOT NULL DEFAULT 'India',
    "defaultGstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceMode" "TaxPriceMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "roundingMode" "TaxRoundingMode" NOT NULL DEFAULT 'NEAREST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Proposal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "summary" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "companySnapshot" JSONB,
    "clientSnapshot" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProposalSection" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OfferLetter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT,
    "status" "OfferLetterStatus" NOT NULL DEFAULT 'DRAFT',
    "offerDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "candidateAddress" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "designation" TEXT,
    "reportingManager" TEXT,
    "startDate" TIMESTAMP(3),
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "workLocation" TEXT,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "variablePay" DOUBLE PRECISION,
    "salaryBreakdown" TEXT,
    "benefits" TEXT,
    "noticePeriod" TEXT,
    "probationPeriod" TEXT,
    "termsAndConditions" TEXT,
    "additionalNotes" TEXT,
    "bodyContent" TEXT,
    "companySnapshot" JSONB,
    "signatoryUserId" TEXT,
    "signatoryName" TEXT,
    "signatoryDesignation" TEXT,
    "signatureUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OfferLetterTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "jobRole" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferLetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Membership_managerId_idx" ON "Membership"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrganizationSwitchLog_userId_createdAt_idx" ON "OrganizationSwitchLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationSettings_orgId_key" ON "OrganizationSettings"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invitation_orgId_idx" ON "Invitation"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_orgId_email_status_key" ON "Invitation"("orgId", "email", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CheckIn_orgId_date_idx" ON "CheckIn"("orgId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CheckIn_userId_idx" ON "CheckIn"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CheckIn_userId_date_key" ON "CheckIn"("userId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Goal_orgId_status_idx" ON "Goal"("orgId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Goal_orgId_visibility_idx" ON "Goal"("orgId", "visibility");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoalHistory_goalId_idx" ON "GoalHistory"("goalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyReview_orgId_weekStart_idx" ON "WeeklyReview"("orgId", "weekStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyReview_revieweeId_idx" ON "WeeklyReview"("revieweeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReview_revieweeId_reviewerId_type_weekStart_key" ON "WeeklyReview"("revieweeId", "reviewerId", "type", "weekStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Recognition_orgId_createdAt_idx" ON "Recognition"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Recognition_recipientId_idx" ON "Recognition"("recipientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Recognition_authorId_idx" ON "Recognition"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_orgId_idx" ON "Notification"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushDevice_orgId_idx" ON "PushDevice"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushDevice_userId_active_idx" ON "PushDevice"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LinearIssue_orgId_assigneeId_idx" ON "LinearIssue"("orgId", "assigneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LinearIssue_orgId_stateType_idx" ON "LinearIssue"("orgId", "stateType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LinearIssue_orgId_linearId_key" ON "LinearIssue"("orgId", "linearId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskUpdate_orgId_issueId_createdAt_idx" ON "TaskUpdate"("orgId", "issueId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskUpdate_orgId_authorId_createdAt_idx" ON "TaskUpdate"("orgId", "authorId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskUpdateAttachment_taskUpdateId_idx" ON "TaskUpdateAttachment"("taskUpdateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceItem_orgId_ownerId_status_deletedAt_idx" ON "WorkspaceItem"("orgId", "ownerId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceItem_orgId_dueDate_idx" ON "WorkspaceItem"("orgId", "dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceItem_assignedById_idx" ON "WorkspaceItem"("assignedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceItemComment_itemId_createdAt_idx" ON "WorkspaceItemComment"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceItemCommentAttachment_commentId_idx" ON "WorkspaceItemCommentAttachment"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Permission_appKey_idx" ON "Permission"("appKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AuthzRole_key_key" ON "AuthzRole"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_orgId_idx" ON "UserRoleAssignment"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_userId_roleId_orgId_key" ON "UserRoleAssignment"("userId", "roleId", "orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformRoleAssignment_userId_idx" ON "PlatformRoleAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformRoleAssignment_userId_roleId_key" ON "PlatformRoleAssignment"("userId", "roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationInstallation_applicationKey_idx" ON "ApplicationInstallation"("applicationKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationInstallation_orgId_applicationKey_key" ON "ApplicationInstallation"("orgId", "applicationKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationConfiguration_applicationKey_idx" ON "ApplicationConfiguration"("applicationKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationConfiguration_orgId_applicationKey_key" ON "ApplicationConfiguration"("orgId", "applicationKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyProfile_orgId_key" ON "CompanyProfile"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_orgId_idx" ON "Client"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_orgId_archivedAt_idx" ON "Client"("orgId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentNumberSequence_orgId_documentType_key" ON "DocumentNumberSequence"("orgId", "documentType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_orgId_status_idx" ON "Invoice"("orgId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_orgId_clientId_idx" ON "Invoice"("orgId", "clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_orgId_issueDate_idx" ON "Invoice"("orgId", "issueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quotation_orgId_status_idx" ON "Quotation"("orgId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quotation_orgId_clientId_idx" ON "Quotation"("orgId", "clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quotation_orgId_issueDate_idx" ON "Quotation"("orgId", "issueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuotationLine_quotationId_idx" ON "QuotationLine"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaxConfig_orgId_key" ON "TaxConfig"("orgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Proposal_orgId_status_idx" ON "Proposal"("orgId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Proposal_orgId_clientId_idx" ON "Proposal"("orgId", "clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProposalSection_proposalId_idx" ON "ProposalSection"("proposalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_orgId_invoiceId_idx" ON "Payment"("orgId", "invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_orgId_paymentDate_idx" ON "Payment"("orgId", "paymentDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OfferLetter_orgId_status_idx" ON "OfferLetter"("orgId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OfferLetter_orgId_candidateEmail_idx" ON "OfferLetter"("orgId", "candidateEmail");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OfferLetterTemplate_orgId_employmentType_jobRole_key" ON "OfferLetterTemplate"("orgId", "employmentType", "jobRole");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_invitedByMembershipId_fkey" FOREIGN KEY ("invitedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "OrganizationSwitchLog" ADD CONSTRAINT "OrganizationSwitchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Goal" ADD CONSTRAINT "Goal_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Goal" ADD CONSTRAINT "Goal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "GoalHistory" ADD CONSTRAINT "GoalHistory_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "LinearIssue" ADD CONSTRAINT "LinearIssue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "LinearIssue" ADD CONSTRAINT "LinearIssue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "LinearIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaskUpdateAttachment" ADD CONSTRAINT "TaskUpdateAttachment_taskUpdateId_fkey" FOREIGN KEY ("taskUpdateId") REFERENCES "TaskUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WorkspaceItemComment" ADD CONSTRAINT "WorkspaceItemComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WorkspaceItemComment" ADD CONSTRAINT "WorkspaceItemComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "WorkspaceItemCommentAttachment" ADD CONSTRAINT "WorkspaceItemCommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "WorkspaceItemComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AuthzRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AuthzRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AuthzRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ApplicationInstallation" ADD CONSTRAINT "ApplicationInstallation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ApplicationConfiguration" ADD CONSTRAINT "ApplicationConfiguration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "DocumentNumberSequence" ADD CONSTRAINT "DocumentNumberSequence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaxConfig" ADD CONSTRAINT "TaxConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "OfferLetterTemplate" ADD CONSTRAINT "OfferLetterTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

