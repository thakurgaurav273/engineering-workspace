-- Application Installation (Phase 2). Additive only.
-- Apply with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "InstallationState" AS ENUM ('INSTALLED', 'DISABLED', 'MAINTENANCE', 'UNINSTALLED');

-- CreateTable
CREATE TABLE "ApplicationInstallation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "applicationKey" TEXT NOT NULL,
    "state" "InstallationState" NOT NULL DEFAULT 'INSTALLED',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApplicationInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationConfiguration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "applicationKey" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApplicationConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationInstallation_applicationKey_idx" ON "ApplicationInstallation"("applicationKey");
CREATE UNIQUE INDEX "ApplicationInstallation_orgId_applicationKey_key" ON "ApplicationInstallation"("orgId", "applicationKey");
CREATE INDEX "ApplicationConfiguration_applicationKey_idx" ON "ApplicationConfiguration"("applicationKey");
CREATE UNIQUE INDEX "ApplicationConfiguration_orgId_applicationKey_key" ON "ApplicationConfiguration"("orgId", "applicationKey");

-- AddForeignKey
ALTER TABLE "ApplicationInstallation" ADD CONSTRAINT "ApplicationInstallation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationConfiguration" ADD CONSTRAINT "ApplicationConfiguration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
