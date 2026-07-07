import * as request from "supertest";
import * as bcrypt from "bcrypt";
import { createTestApp, createTestMember, TestContext, authHeader } from "./helpers/test.helper";

describe("Workspace (e2e)", () => {
  let ctx: TestContext;
  let reportId: string;
  let reportToken: string;
  let outsiderId: string;
  let outsiderToken: string;
  let jrId: string;
  let jrToken: string;
  let itemId: string;
  let assignedItemId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    const passwordHash = await bcrypt.hash("password123", 12);

    const report = await createTestMember(ctx, {
      email: `report-${Date.now()}@example.com`,
      passwordHash,
      firstName: "Report",
      lastName: "Ee",
      managerId: ctx.userId,
    });
    reportId = report.id;
    reportToken = (
      await request(ctx.app.getHttpServer())
        .post("/auth/login")
        .send({ email: report.email, password: "password123" })
        .expect(200)
    ).body.data.accessToken;

    const outsider = await createTestMember(ctx, {
      email: `outsider-${Date.now()}@example.com`,
      passwordHash,
      firstName: "Out",
      lastName: "Sider",
    });
    outsiderId = outsider.id;
    outsiderToken = (
      await request(ctx.app.getHttpServer())
        .post("/auth/login")
        .send({ email: outsider.email, password: "password123" })
        .expect(200)
    ).body.data.accessToken;

    // A direct report of `report`, for the delegation chain: owner -> report -> jr.
    const jr = await createTestMember(ctx, {
      email: `jr-${Date.now()}@example.com`,
      passwordHash,
      firstName: "Junior",
      lastName: "Dev",
      managerId: reportId,
    });
    jrId = jr.id;
    jrToken = (
      await request(ctx.app.getHttpServer())
        .post("/auth/login")
        .send({ email: jr.email, password: "password123" })
        .expect(200)
    ).body.data.accessToken;
  });

  afterAll(async () => {
    await ctx.prisma.workspaceItem.deleteMany({ where: { orgId: ctx.orgId } });
    await ctx.prisma.session.deleteMany({
      where: { userId: { in: [reportId, outsiderId, jrId] } },
    });
    await ctx.prisma.user.deleteMany({ where: { id: { in: [reportId, outsiderId, jrId] } } });
    await ctx.cleanup();
  });

  describe("POST /workspace", () => {
    it("lets anyone create an item for themselves", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(reportToken))
        .send({ title: "Reply to WhatsApp message", source: "WHATSAPP", priority: "HIGH" })
        .expect(201);

      expect(res.body.data.title).toBe("Reply to WhatsApp message");
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.assignedBy).toBeNull();
      itemId = res.body.data.id;
    });

    it("fails validation for a title that is too short", async () => {
      await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(reportToken))
        .send({ title: "x" })
        .expect(400);
    });

    it("rejects an unrelated member assigning an item to someone else", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(outsiderToken))
        .send({ title: "Sneaky assignment", ownerId: reportId })
        .expect(403);
      expect(res.body.success).toBe(false);
    });

    it("lets the owner/admin (org owner) assign an item to the report and creates a notification", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(ctx.authToken))
        .send({ title: "Review payment proposal", ownerId: reportId, source: "MEETING" })
        .expect(201);

      expect(res.body.data.ownerId).toBe(reportId);
      expect(res.body.data.assignedBy.id).toBe(ctx.userId);
      assignedItemId = res.body.data.id;

      const notif = await ctx.prisma.notification.findFirst({
        where: { userId: reportId, type: "WORKSPACE_ITEM_ASSIGNED" },
      });
      expect(notif).not.toBeNull();
      expect(notif?.actionUrl).toBe(`/workspace/${res.body.data.id}`);
    });
  });

  describe("GET /workspace/assigned", () => {
    it("lets the assigner see what they delegated to the report, scoped by assignedById not ownerId", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace/assigned")
        .set(authHeader(ctx.authToken))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every((i: { assignedById: string }) => i.assignedById === ctx.userId),
      ).toBe(true);
      expect(
        res.body.data.some((i: { title: string }) => i.title === "Review payment proposal"),
      ).toBe(true);
    });

    it("returns nothing for someone who hasn't assigned anything", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace/assigned")
        .set(authHeader(reportToken))
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("GET /workspace", () => {
    it("returns only the report's own items, not the owner's", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace")
        .set(authHeader(reportToken))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.every((i: { ownerId: string }) => i.ownerId === reportId)).toBe(true);
    });

    it("supports search by title", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace?search=WhatsApp")
        .set(authHeader(reportToken))
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toContain("WhatsApp");
    });

    it("supports filtering by source", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace?source=MEETING")
        .set(authHeader(reportToken))
        .expect(200);
      expect(res.body.data.every((i: { source: string }) => i.source === "MEETING")).toBe(true);
    });

    it("does not leak the report's items to an unrelated outsider", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace")
        .set(authHeader(outsiderToken))
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("GET /workspace/board", () => {
    it("groups items by status column", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace/board")
        .set(authHeader(reportToken))
        .expect(200);
      expect(res.body.data.PENDING.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.IN_PROGRESS).toEqual([]);
      expect(res.body.data.DONE).toEqual([]);
    });
  });

  describe("PATCH /workspace/:id/status", () => {
    it("lets the owner drag their item to a new column", async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/workspace/${itemId}/status`)
        .set(authHeader(reportToken))
        .send({ status: "IN_PROGRESS" })
        .expect(200);
      expect(res.body.data.status).toBe("IN_PROGRESS");
    });

    it("rejects an unrelated outsider moving the item", async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/workspace/${itemId}/status`)
        .set(authHeader(outsiderToken))
        .send({ status: "DONE" })
        .expect(403);
    });

    it("sets completedAt when moved to DONE", async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/workspace/${itemId}/status`)
        .set(authHeader(reportToken))
        .send({ status: "DONE" })
        .expect(200);
      expect(res.body.data.status).toBe("DONE");
      expect(res.body.data.completedAt).not.toBeNull();
    });
  });

  describe("PATCH /workspace/:id/archive", () => {
    it("archives a completed item", async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/workspace/${itemId}/archive`)
        .set(authHeader(reportToken))
        .expect(200);
      expect(res.body.data.archivedAt).not.toBeNull();
    });

    it("rejects archiving a non-completed item", async () => {
      const create = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(reportToken))
        .send({ title: "Not done yet" })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .patch(`/workspace/${create.body.data.id}/archive`)
        .set(authHeader(reportToken))
        .expect(400);
    });
  });

  describe("PATCH /workspace/:id", () => {
    it("lets the assigner (org owner) edit an item they assigned", async () => {
      const list = await request(ctx.app.getHttpServer())
        .get("/workspace?source=MEETING")
        .set(authHeader(reportToken))
        .expect(200);
      const assignedId = list.body.data[0].id;

      const res = await request(ctx.app.getHttpServer())
        .patch(`/workspace/${assignedId}`)
        .set(authHeader(ctx.authToken))
        .send({ priority: "URGENT" })
        .expect(200);
      expect(res.body.data.priority).toBe("URGENT");
    });
  });

  describe("GET /workspace/summary", () => {
    it("returns the report's own summary", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/workspace/summary")
        .set(authHeader(reportToken))
        .expect(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
      expect(typeof res.body.data.completionRate).toBe("number");
    });

    it("lets the org owner view the report's summary (as their manager)", async () => {
      await request(ctx.app.getHttpServer())
        .get(`/workspace/summary?userId=${reportId}`)
        .set(authHeader(ctx.authToken))
        .expect(200);
    });

    it("rejects an unrelated outsider viewing the report's summary", async () => {
      await request(ctx.app.getHttpServer())
        .get(`/workspace/summary?userId=${reportId}`)
        .set(authHeader(outsiderToken))
        .expect(403);
    });
  });

  describe("DELETE /workspace/:id", () => {
    it("soft-deletes an item", async () => {
      const create = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(reportToken))
        .send({ title: "Throwaway item" })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .delete(`/workspace/${create.body.data.id}`)
        .set(authHeader(reportToken))
        .expect(200);

      await request(ctx.app.getHttpServer())
        .get(`/workspace/${create.body.data.id}`)
        .set(authHeader(reportToken))
        .expect(404);
    });
  });

  describe("Comments", () => {
    it("lets the owner comment and notifies the assigner", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post(`/workspace/${assignedItemId}/comments`)
        .set(authHeader(reportToken))
        .send({ body: "I'll get to this by Friday." })
        .expect(201);

      expect(res.body.data.body).toBe("I'll get to this by Friday.");
      expect(res.body.data.author.id).toBe(reportId);

      const notif = await ctx.prisma.notification.findFirst({
        where: { userId: ctx.userId, type: "WORKSPACE_ITEM_COMMENT" },
      });
      expect(notif).not.toBeNull();
      expect(notif?.actionUrl).toBe(`/workspace/${assignedItemId}`);
    });

    it("lets the assigner comment back and notifies the owner", async () => {
      await request(ctx.app.getHttpServer())
        .post(`/workspace/${assignedItemId}/comments`)
        .set(authHeader(ctx.authToken))
        .send({ body: "Sounds good, thanks!" })
        .expect(201);

      const notif = await ctx.prisma.notification.findFirst({
        where: { userId: reportId, type: "WORKSPACE_ITEM_COMMENT" },
      });
      expect(notif).not.toBeNull();
    });

    it("lists comments in chronological order", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/workspace/${assignedItemId}/comments`)
        .set(authHeader(reportToken))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].body).toBe("I'll get to this by Friday.");
      expect(res.body.data[1].body).toBe("Sounds good, thanks!");
    });

    it("rejects an unrelated outsider from commenting", async () => {
      await request(ctx.app.getHttpServer())
        .post(`/workspace/${assignedItemId}/comments`)
        .set(authHeader(outsiderToken))
        .send({ body: "Not my business" })
        .expect(403);
    });

    it("rejects an unrelated outsider from reading comments", async () => {
      await request(ctx.app.getHttpServer())
        .get(`/workspace/${assignedItemId}/comments`)
        .set(authHeader(outsiderToken))
        .expect(403);
    });

    it("fails validation for an empty comment", async () => {
      await request(ctx.app.getHttpServer())
        .post(`/workspace/${assignedItemId}/comments`)
        .set(authHeader(reportToken))
        .send({ body: "" })
        .expect(400);
    });
  });

  describe("Delegation chain: owner -> report -> jr", () => {
    it("rejects an outsider delegating an item they have no access to", async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/workspace/${assignedItemId}/delegate`)
        .set(authHeader(outsiderToken))
        .send({ ownerId: jrId })
        .expect(403);
    });

    it("rejects delegating to whoever already owns it", async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/workspace/${assignedItemId}/delegate`)
        .set(authHeader(reportToken))
        .send({ ownerId: reportId })
        .expect(400);
    });

    it("lets the report (current owner) delegate down to their own direct report, folding themselves and the original assigner into watchers", async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/workspace/${assignedItemId}/delegate`)
        .set(authHeader(reportToken))
        .send({ ownerId: jrId })
        .expect(200);

      expect(res.body.data.ownerId).toBe(jrId);
      expect(res.body.data.assignedBy.id).toBe(reportId);

      const stored = await ctx.prisma.workspaceItem.findUnique({ where: { id: assignedItemId } });
      expect(stored?.watcherIds).toEqual(expect.arrayContaining([reportId, ctx.userId]));

      const notif = await ctx.prisma.notification.findFirst({
        where: { userId: jrId, type: "WORKSPACE_ITEM_ASSIGNED" },
      });
      expect(notif).not.toBeNull();
    });

    it("notifies both the immediate senior and the original assigner when the jr changes status", async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/workspace/${assignedItemId}/status`)
        .set(authHeader(jrToken))
        .send({ status: "IN_PROGRESS" })
        .expect(200);

      const seniorNotif = await ctx.prisma.notification.findFirst({
        where: { userId: reportId, type: "WORKSPACE_ITEM_STATUS_CHANGED" },
      });
      const adminNotif = await ctx.prisma.notification.findFirst({
        where: { userId: ctx.userId, type: "WORKSPACE_ITEM_STATUS_CHANGED" },
      });
      expect(seniorNotif).not.toBeNull();
      expect(adminNotif).not.toBeNull();
    });

    it("notifies both the immediate senior and the original assigner when the jr comments", async () => {
      await request(ctx.app.getHttpServer())
        .post(`/workspace/${assignedItemId}/comments`)
        .set(authHeader(jrToken))
        .send({ body: "Almost done with this." })
        .expect(201);

      const seniorNotif = await ctx.prisma.notification.findFirst({
        where: { userId: reportId, type: "WORKSPACE_ITEM_COMMENT" },
      });
      const adminNotif = await ctx.prisma.notification.findFirst({
        where: { userId: ctx.userId, type: "WORKSPACE_ITEM_COMMENT" },
      });
      expect(seniorNotif).not.toBeNull();
      expect(adminNotif).not.toBeNull();
    });
  });

  describe("Client project flag", () => {
    it("creates an item flagged as a client project", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(jrToken))
        .send({ title: "Client escalation", isClientProject: true })
        .expect(201);
      expect(res.body.data.isClientProject).toBe(true);
    });

    it("defaults to false when omitted", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(jrToken))
        .send({ title: "Internal cleanup" })
        .expect(201);
      expect(res.body.data.isClientProject).toBe(false);
    });

    it("can be toggled via update", async () => {
      const create = await request(ctx.app.getHttpServer())
        .post("/workspace")
        .set(authHeader(jrToken))
        .send({ title: "Maybe client work" })
        .expect(201);

      const res = await request(ctx.app.getHttpServer())
        .patch(`/workspace/${create.body.data.id}`)
        .set(authHeader(jrToken))
        .send({ isClientProject: true })
        .expect(200);
      expect(res.body.data.isClientProject).toBe(true);
    });
  });
});
