-- Tenant/organization lifecycle status. SUSPENDED tenants' users are blocked from signing in.
DO $$ BEGIN
    CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE';
