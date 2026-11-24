import { schema as s, type Db } from "@agent-tracking/db";
import { attachmentMeta, featureOf, saveAttachment, type Tracker } from "@agent-tracking/tracking";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

/**
 * Images of a project: references attached to requirements and criteria ("it should look like this")
 * and screens of the app, uploaded from the UI or reported by agents.
 *
 *   POST   /projects/:id/attachments            multipart: file + kind, requirementId, dodItemId, featureId, title, route
 *   GET    /attachments/:attachmentId          the image
 *   PATCH  /projects/:id/attachments/:aid      { title, route, featureId }
 *   DELETE /projects/:id/attachments/:aid
 */
export function attachmentRoutes(db: Db, tracker: Tracker) {
  const app = new Hono();

  app.post("/projects/:id/attachments", async (c) => {
    const projectId = c.req.param("id");
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HTTPException(400, { message: "Falta la imagen" });
    const fields = Object.fromEntries([...form!.entries()].filter(([k, v]) => k !== "file" && typeof v === "string" && v !== ""));
    const parsed = attachmentMeta.safeParse(fields);
    if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
    const row = await saveAttachment(db, tracker, projectId, "user:local", {
      ...parsed.data,
      filename: file.name || "imagen",
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return c.json(row, 201);
  });

  app.get("/attachments/:attachmentId", async (c) => {
    const row = await db.query.attachments.findFirst({
      where: eq(s.attachments.id, c.req.param("attachmentId")),
      columns: { data: true, mime: true },
    });
    if (!row) throw new HTTPException(404, { message: "Imagen no encontrada" });
    return new Response(new Uint8Array(row.data), {
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });

  app.patch("/projects/:id/attachments/:aid", async (c) => {
    const { id: projectId, aid } = c.req.param();
    const raw = await c.req.json().catch(() => ({}));
    const parsed = z
      .object({ title: z.string().max(200), route: z.string().max(300), featureId: z.string().min(1).nullable() })
      .partial()
      .safeParse(raw);
    if (!parsed.success) throw new HTTPException(400, { message: z.prettifyError(parsed.error) });
    if (parsed.data.featureId) await featureOf(db, projectId, parsed.data.featureId);
    const [row] = await db
      .update(s.attachments)
      .set(parsed.data)
      .where(and(eq(s.attachments.id, aid), eq(s.attachments.projectId, projectId)))
      .returning({ id: s.attachments.id });
    if (!row) throw new HTTPException(404, { message: "Imagen no encontrada" });
    await tracker.touch(projectId, "attachment", aid);
    return c.json(row);
  });

  app.delete("/projects/:id/attachments/:aid", async (c) => {
    const { id: projectId, aid } = c.req.param();
    await db.delete(s.attachments).where(and(eq(s.attachments.id, aid), eq(s.attachments.projectId, projectId)));
    await tracker.touch(projectId, "attachment", aid);
    return c.body(null, 204);
  });

  return app;
}

