-- Per-user default landing application (null = the application launcher /apps).
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "defaultApplicationKey" TEXT;
