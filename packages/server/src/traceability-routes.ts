import { TEST_IDEA_STATUSES } from "@agent-tracking/core";
import { LOCAL_USER, type Tracker } from "@agent-tracking/tracking";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

const parse = async <T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
  return parsed.data;
};

/** Agent activity log and test ideas. Files, symbols and features come in the project snapshot. */
export function traceabilityRoutes(tracker: Tracker) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, mcp: "/mcp" }));

  app.get("/projects/:id/activity", async (c) => {
    const projectId = c.req.param("id");
    await tracker.projectOr404(projectId);
    const limit = Number(c.req.query("limit") ?? 50);
    return c.json(await tracker.listEvents(projectId, { limit: Number.isFinite(limit) ? limit : 50, before: c.req.query("before") }));
  });

  const ideaInput = z.object({
    text: z.string().trim().min(1, "Escribe la idea"),
    featureId: z.string().nullable().optional(),
    requirementId: z.string().nullable().optional(),
  });
  app.post("/projects/:id/test-ideas", async (c) => {
    const projectId = c.req.param("id");
    const idea = await tracker.addTestIdea(projectId, LOCAL_USER, { ...(await parse(c.req.raw, ideaInput)), origin: "human" });
    return c.json(idea, 201);
  });
  app.patch("/projects/:id/test-ideas/:ideaId", async (c) => {
    const { id: projectId, ideaId } = c.req.param();
    const input = await parse(c.req.raw, z.object({ status: z.enum(TEST_IDEA_STATUSES), text: z.string().trim().min(1) }).partial());
    return c.json(await tracker.updateTestIdea(projectId, LOCAL_USER, ideaId, input));
  });
  app.delete("/projects/:id/tests/:testId", async (c) => {
    const { id: projectId, testId } = c.req.param();
    await tracker.deleteTest(projectId, testId);
    return c.body(null, 204);
  });
  app.delete("/projects/:id/test-ideas/:ideaId", async (c) => {
    const { id: projectId, ideaId } = c.req.param();
    await tracker.deleteTestIdea(projectId, ideaId);
    return c.body(null, 204);
  });

  return app;
}
