-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('view', 'edit');

-- CreateEnum
CREATE TYPE "ShareItemType" AS ENUM ('task', 'note');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('birthday', 'anniversary', 'work_anniversary', 'graduation', 'exam_passed', 'achievement', 'milestone', 'purchase', 'relationship', 'travel', 'custom');

-- CreateEnum
CREATE TYPE "MilestoneRecurringFrequency" AS ENUM ('yearly', 'monthly');

-- CreateTable
CREATE TABLE "User" (
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "dob" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userEmail" TEXT NOT NULL,
    "taskCategories" JSONB,
    "taskDurations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userEmail")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "lastRejectedAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "parentId" TEXT,
    "reminderAt" TIMESTAMP(3),
    "onlyNotifyAtReminder" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "recurrence" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "isTimeBlocked" BOOLEAN,
    "calendarEventId" TEXT,
    "pomodoroSessions" INTEGER,
    "estimatedPomodoros" INTEGER,
    "timeSpent" INTEGER,
    "isAllDay" BOOLEAN,
    "calendarColor" TEXT,
    "location" TEXT,
    "attendees" JSONB,
    "isRecurring" BOOLEAN,
    "originalTaskId" TEXT,
    "syncToGoogleTasks" BOOLEAN NOT NULL DEFAULT true,
    "googleTaskId" TEXT,
    "googleTaskListId" TEXT,
    "googleTaskSyncStatus" TEXT,
    "googleTaskLastSync" TIMESTAMP(3),
    "googleTaskUrl" TEXT,
    "googleTaskError" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "audioUrl" TEXT,
    "color" TEXT,
    "fontSize" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accomplishment" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Accomplishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MilestoneType" NOT NULL,
    "originalDate" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringFrequency" "MilestoneRecurringFrequency",
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notificationSettings" JSONB,
    "lastNotifiedAt" TIMESTAMP(3),
    "nextAnniversaryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "context" JSONB,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suggestedTasks" JSONB,
    "quickActions" JSONB,
    "taskReferences" JSONB,
    "metadata" JSONB,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" "ShareItemType" NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerName" TEXT,
    "permission" "SharePermission" NOT NULL DEFAULT 'view',
    "shareToken" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastEditedAt" TIMESTAMP(3),
    "lastEditedBy" TEXT,
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "SharedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareHistoryEntry" (
    "id" TEXT NOT NULL,
    "sharedItemId" TEXT NOT NULL,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareCollaborator" (
    "id" TEXT NOT NULL,
    "sharedItemId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'view',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "relatedTaskId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "data" JSONB,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "subscription" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "deviceInfo" JSONB,
    "notificationStats" JSONB,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userEmail" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "overdueAlerts" BOOLEAN NOT NULL DEFAULT true,
    "taskReminders" BOOLEAN NOT NULL DEFAULT true,
    "quietHours" JSONB,
    "dailyLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userEmail")
);

-- CreateTable
CREATE TABLE "EmailPreference" (
    "userEmail" TEXT NOT NULL,
    "welcomeEmails" BOOLEAN NOT NULL DEFAULT true,
    "taskReminders" BOOLEAN NOT NULL DEFAULT true,
    "shareNotifications" BOOLEAN NOT NULL DEFAULT true,
    "teamInvitations" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "dailyDigest" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "reminderFrequency" TEXT DEFAULT 'immediate',
    "digestDay" TEXT DEFAULT 'monday',
    "dailyDigestTime" TEXT DEFAULT '09:00',
    "quietHours" JSONB,
    "lastDailySent" TIMESTAMP(3),
    "lastWeeklySent" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("userEmail")
);

-- CreateTable
CREATE TABLE "GoogleTasksSetting" (
    "userEmail" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "defaultTaskListId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "syncDirection" TEXT,
    "autoSync" BOOLEAN,
    "syncInterval" INTEGER,
    "lastError" TEXT,
    "onDeletedTasksAction" TEXT,
    "syncMode" TEXT,
    "taskListPrefix" TEXT,
    "categoryTaskLists" JSONB,
    "archivedTaskListId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleTasksSetting_pkey" PRIMARY KEY ("userEmail")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_userEmail_createdAt_idx" ON "Task"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

-- CreateIndex
CREATE INDEX "Note_userEmail_createdAt_idx" ON "Note"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Accomplishment_userEmail_date_idx" ON "Accomplishment"("userEmail", "date");

-- CreateIndex
CREATE INDEX "Milestone_userEmail_isActive_originalDate_idx" ON "Milestone"("userEmail", "isActive", "originalDate");

-- CreateIndex
CREATE INDEX "ChatSession_userEmail_updatedAt_idx" ON "ChatSession"("userEmail", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_timestamp_idx" ON "ChatMessage"("sessionId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "SharedItem_shareToken_key" ON "SharedItem"("shareToken");

-- CreateIndex
CREATE INDEX "SharedItem_ownerEmail_createdAt_idx" ON "SharedItem"("ownerEmail", "createdAt");

-- CreateIndex
CREATE INDEX "SharedItem_itemId_itemType_idx" ON "SharedItem"("itemId", "itemType");

-- CreateIndex
CREATE INDEX "ShareHistoryEntry_sharedItemId_timestamp_idx" ON "ShareHistoryEntry"("sharedItemId", "timestamp");

-- CreateIndex
CREATE INDEX "ShareCollaborator_userEmail_isActive_idx" ON "ShareCollaborator"("userEmail", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShareCollaborator_sharedItemId_userEmail_key" ON "ShareCollaborator"("sharedItemId", "userEmail");

-- CreateIndex
CREATE INDEX "Notification_userEmail_isRead_createdAt_idx" ON "Notification"("userEmail", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_relatedTaskId_idx" ON "Notification"("relatedTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userEmail_isActive_idx" ON "PushSubscription"("userEmail", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_expiresAt_idx" ON "PasswordResetToken"("email", "expiresAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accomplishment" ADD CONSTRAINT "Accomplishment_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedItem" ADD CONSTRAINT "SharedItem_ownerEmail_fkey" FOREIGN KEY ("ownerEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareHistoryEntry" ADD CONSTRAINT "ShareHistoryEntry_sharedItemId_fkey" FOREIGN KEY ("sharedItemId") REFERENCES "SharedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareHistoryEntry" ADD CONSTRAINT "ShareHistoryEntry_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareCollaborator" ADD CONSTRAINT "ShareCollaborator_sharedItemId_fkey" FOREIGN KEY ("sharedItemId") REFERENCES "SharedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareCollaborator" ADD CONSTRAINT "ShareCollaborator_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailPreference" ADD CONSTRAINT "EmailPreference_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleTasksSetting" ADD CONSTRAINT "GoogleTasksSetting_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
