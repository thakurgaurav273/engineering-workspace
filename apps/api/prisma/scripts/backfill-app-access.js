/**
 * One-off backfill: give every ACTIVE member default access to the apps installed in their org.
 *
 * Unblocks members who joined before default-grant-on-join existed (they currently see only the
 * Settings chrome). Mirrors AppAccessService.grantDefaultAccess exactly:
 *   - "installed apps for an org" = ApplicationInstallation rows in state INSTALLED or MAINTENANCE
 *     (DISABLED/UNINSTALLED excluded), which is precisely what the runtime installation filter shows.
 *   - create-missing only: a pre-existing row (including an explicit granted=false revocation) is
 *     left untouched, so this is idempotent and never resurrects a revoked grant.
 *
 * Dry-run by default (prints what it would create). Pass --apply to write.
 *
 *   node prisma/scripts/backfill-app-access.js          # dry run
 *   node prisma/scripts/backfill-app-access.js --apply  # write grants
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  // Apps that count as "installed" for an org (matches applyInstallationState visibility).
  const installations = await prisma.applicationInstallation.findMany({
    where: { state: { in: ['INSTALLED', 'MAINTENANCE'] } },
    select: { orgId: true, applicationKey: true },
  });
  const appsByOrg = new Map();
  for (const i of installations) {
    const list = appsByOrg.get(i.orgId) ?? [];
    list.push(i.applicationKey);
    appsByOrg.set(i.orgId, list);
  }

  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE' },
    select: { orgId: true, userId: true },
  });

  const existing = await prisma.userApplicationAccess.findMany({
    select: { orgId: true, userId: true, applicationKey: true },
  });
  const have = new Set(existing.map((r) => `${r.orgId}|${r.userId}|${r.applicationKey}`));

  const toCreate = [];
  for (const m of memberships) {
    for (const applicationKey of appsByOrg.get(m.orgId) ?? []) {
      const key = `${m.orgId}|${m.userId}|${applicationKey}`;
      if (!have.has(key)) {
        toCreate.push({ orgId: m.orgId, userId: m.userId, applicationKey, granted: true });
        have.add(key); // guard against duplicate app rows per org
      }
    }
  }

  console.log(
    `Active memberships: ${memberships.length} · orgs with installs: ${appsByOrg.size} · ` +
      `existing grants: ${existing.length} · missing grants to create: ${toCreate.length}`,
  );

  if (!toCreate.length) {
    console.log('Nothing to backfill.');
    return;
  }
  if (!APPLY) {
    console.log('Dry run - re-run with --apply to write these grants.');
    return;
  }

  const result = await prisma.userApplicationAccess.createMany({
    data: toCreate,
    skipDuplicates: true,
  });
  console.log(`Created ${result.count} grant row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
