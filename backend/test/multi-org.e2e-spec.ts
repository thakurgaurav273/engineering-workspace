import * as request from "supertest";
import { createTestApp, TestContext, authHeader } from "./helpers/test.helper";

describe("Multi-organization membership (e2e)", () => {
  let ctx: TestContext; // Org A - the inviting org
  let orgBId: string;
  let userBId: string;
  let userBEmail: string;
  const userBPassword = "password123";

  beforeAll(async () => {
    ctx = await createTestApp();

    // A second, fully independent org with its own OWNER - this account will be
    // invited into Org A while already having an active membership elsewhere.
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    userBEmail = `owner-b-${unique}@example.com`;
    const registerRes = await request(ctx.app.getHttpServer())
      .post("/auth/register")
      .send({
        organizationName: "Org B",
        organizationSlug: `org-b-${unique}`,
        firstName: "Bea",
        lastName: "Owner",
        email: userBEmail,
        password: userBPassword,
      })
      .expect(201);

    orgBId = registerRes.body.data.user.orgId;
    userBId = registerRes.body.data.user.id;
  });

  afterAll(async () => {
    await ctx.prisma.organizationSwitchLog.deleteMany({ where: { userId: userBId } });
    await ctx.prisma.membership.deleteMany({ where: { userId: userBId } });
    await ctx.prisma.session.deleteMany({ where: { userId: userBId } });
    await ctx.prisma.userPreference.deleteMany({ where: { userId: userBId } });
    await ctx.prisma.user.deleteMany({ where: { id: userBId } });
    await ctx.prisma.organization.deleteMany({ where: { id: orgBId } });
    await ctx.cleanup();
  });

  it("registering an org logs an activation switch with no fromOrgId", async () => {
    const logs = await ctx.prisma.organizationSwitchLog.findMany({ where: { userId: userBId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].fromOrgId).toBeNull();
    expect(logs[0].toOrgId).toBe(orgBId);
  });

  it("inviting an already-registered email creates a pending invitation (not an instant account)", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/invitations")
      .set(authHeader(ctx.authToken))
      .send({ email: userBEmail, role: "MEMBER" })
      .expect(201);

    expect(res.body.data.status).toBe("pending");

    const invitation = await ctx.prisma.invitation.findFirst({
      where: { orgId: ctx.orgId, email: userBEmail },
    });
    expect(invitation).toBeTruthy();
    expect(invitation!.status).toBe("pending");

    // An existing user gets a placeholder INVITED membership right away.
    const membership = await ctx.prisma.membership.findUnique({
      where: { userId_orgId: { userId: userBId, orgId: ctx.orgId } },
    });
    expect(membership?.status).toBe("INVITED");
  });

  it("the public token preview reports existingAccount: true", async () => {
    const invitation = await ctx.prisma.invitation.findFirstOrThrow({
      where: { orgId: ctx.orgId, email: userBEmail, status: "pending" },
    });

    const res = await request(ctx.app.getHttpServer())
      .get(`/invitations/token/${invitation.token}`)
      .expect(200);

    expect(res.body.data).toEqual(
      expect.objectContaining({ email: userBEmail, existingAccount: true }),
    );
  });

  it("rejects accepting with the wrong password", async () => {
    const invitation = await ctx.prisma.invitation.findFirstOrThrow({
      where: { orgId: ctx.orgId, email: userBEmail, status: "pending" },
    });

    await request(ctx.app.getHttpServer())
      .post("/auth/accept-invite")
      .send({ token: invitation.token, password: "totally-wrong" })
      .expect(400);
  });

  let acceptedAccessToken: string;
  let acceptedRefreshToken: string;

  it("accepting as an existing account flips INVITED -> ACTIVE and issues tokens for the new org", async () => {
    const invitation = await ctx.prisma.invitation.findFirstOrThrow({
      where: { orgId: ctx.orgId, email: userBEmail, status: "pending" },
    });

    const res = await request(ctx.app.getHttpServer())
      .post("/auth/accept-invite")
      .send({ token: invitation.token, password: userBPassword })
      .expect(200);

    expect(res.body.data.user.orgId).toBe(ctx.orgId);
    expect(res.body.data.user.organizations).toHaveLength(2);
    expect(res.body.data.user.organizations.map((o: any) => o.id).sort()).toEqual(
      [ctx.orgId, orgBId].sort(),
    );

    acceptedAccessToken = res.body.data.accessToken;
    acceptedRefreshToken = res.body.data.refreshToken;

    const membership = await ctx.prisma.membership.findUnique({
      where: { userId_orgId: { userId: userBId, orgId: ctx.orgId } },
    });
    expect(membership?.status).toBe("ACTIVE");
    expect(membership?.joinedAt).toBeTruthy();

    const acceptedInvitation = await ctx.prisma.invitation.findUnique({ where: { id: invitation.id } });
    expect(acceptedInvitation?.status).toBe("accepted");
  });

  it("/auth/me lists both organizations for the newly-joined account", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/auth/me")
      .set(authHeader(acceptedAccessToken))
      .expect(200);

    expect(res.body.data.organizations).toHaveLength(2);
  });

  let switchedAccessToken: string;

  it("switches org via /auth/switch-org, rotating the session and logging the switch", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/auth/switch-org")
      .set(authHeader(acceptedAccessToken))
      .send({ orgId: orgBId, refreshToken: acceptedRefreshToken })
      .expect(200);

    expect(res.body.data.user.orgId).toBe(orgBId);
    switchedAccessToken = res.body.data.accessToken;

    const logs = await ctx.prisma.organizationSwitchLog.findMany({
      where: { userId: userBId },
      orderBy: { createdAt: "asc" },
    });
    // register(org B) -> accept-invite(org A) -> switch-org(org B)
    expect(logs).toHaveLength(3);
    expect(logs[2]).toEqual(
      expect.objectContaining({ fromOrgId: ctx.orgId, toOrgId: orgBId }),
    );
  });

  it("scopes subsequent requests to the newly-active org after switching", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/auth/me")
      .set(authHeader(switchedAccessToken))
      .expect(200);

    expect(res.body.data.orgId).toBe(orgBId);

    // Legacy User.orgId mirror stays in sync with whichever org is active.
    const user = await ctx.prisma.user.findUnique({ where: { id: userBId } });
    expect(user?.orgId).toBe(orgBId);
  });

  it("rejects switching into an org the caller has no membership in", async () => {
    await request(ctx.app.getHttpServer())
      .post("/auth/switch-org")
      .set(authHeader(ctx.authToken))
      .send({ orgId: orgBId, refreshToken: "not-a-real-refresh-token" })
      .expect(403);
  });

  it("revoking a pending invitation removes the placeholder INVITED membership", async () => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const thirdEmail = `owner-c-${unique}@example.com`;

    const thirdRegister = await request(ctx.app.getHttpServer())
      .post("/auth/register")
      .send({
        organizationName: "Org C",
        organizationSlug: `org-c-${unique}`,
        firstName: "Cy",
        lastName: "Owner",
        email: thirdEmail,
        password: "password123",
      })
      .expect(201);
    const thirdUserId = thirdRegister.body.data.user.id;
    const thirdOrgId = thirdRegister.body.data.user.orgId;

    const inviteRes = await request(ctx.app.getHttpServer())
      .post("/invitations")
      .set(authHeader(ctx.authToken))
      .send({ email: thirdEmail, role: "MEMBER" })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .delete(`/invitations/${inviteRes.body.data.id}`)
      .set(authHeader(ctx.authToken))
      .expect(200);

    const membership = await ctx.prisma.membership.findUnique({
      where: { userId_orgId: { userId: thirdUserId, orgId: ctx.orgId } },
    });
    expect(membership).toBeNull();

    // Cleanup this ad-hoc third org/user.
    await ctx.prisma.organizationSwitchLog.deleteMany({ where: { userId: thirdUserId } });
    await ctx.prisma.membership.deleteMany({ where: { userId: thirdUserId } });
    await ctx.prisma.session.deleteMany({ where: { userId: thirdUserId } });
    await ctx.prisma.userPreference.deleteMany({ where: { userId: thirdUserId } });
    await ctx.prisma.user.deleteMany({ where: { id: thirdUserId } });
    await ctx.prisma.organization.deleteMany({ where: { id: thirdOrgId } });
  });
});
