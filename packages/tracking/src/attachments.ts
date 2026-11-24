import { schema as s, type Db } from "@agent-tracking/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { TrackingError, type Tracker } from "./tracker";

/** Raster images only: SVG can carry scripts and these are served from the app's own origin. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const SIGNATURES: [string, (b: Uint8Array) => boolean][] = [
  ["image/png", (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/gif", (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46],
  ["image/webp", (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP"],
  ["image/avif", (b) => String.fromCharCode(...b.slice(4, 12)).startsWith("ftypavi")],
];

/** The real type from the first bytes; what the browser or the agent claims is not trusted. */
export const sniffImage = (bytes: Uint8Array) => SIGNATURES.find(([, test]) => test(bytes))?.[0] ?? null;

export const attachmentMeta = z.object({
  kind: z.enum(["reference", "screen"]).default("reference"),
  requirementId: z.string().min(1).nullish(),
  dodItemId: z.string().min(1).nullish(),
  featureId: z.string().min(1).nullish(),
  title: z.string().max(200).default(""),
  route: z.string().max(300).default(""),
});

export type NewAttachment = z.input<typeof attachmentMeta> & { filename: string; bytes: Uint8Array };

export async function featureOf(db: Db, projectId: string, featureId: string) {
  const row = await db
    .select({ id: s.features.id })
    .from(s.features)
    .innerJoin(s.requirements, eq(s.requirements.id, s.features.requirementId))
    .where(and(eq(s.features.id, featureId), eq(s.requirements.projectId, projectId)))
    .limit(1);
  if (!row[0]) throw new TrackingError("Ese feature no es de este proyecto");
}

/** Validates and stores an image. Shared by the upload route and the MCP tool for screens. */
export async function saveAttachment(db: Db, tracker: Pick<Tracker, "projectOr404" | "touch">, projectId: string, actor: string, input: NewAttachment) {
  await tracker.projectOr404(projectId);
  const data = attachmentMeta.parse(input);
  if (input.bytes.length === 0) throw new TrackingError("La imagen está vacía");
  if (input.bytes.length > MAX_IMAGE_BYTES) throw new TrackingError("La imagen pesa más de 10 MB");
  const mime = sniffImage(input.bytes);
  if (!mime) throw new TrackingError("Solo se aceptan imágenes PNG, JPEG, WebP, GIF o AVIF");
  let { requirementId } = data;
  if (data.dodItemId) {
    const dod = await db.query.dodItems.findFirst({ where: eq(s.dodItems.id, data.dodItemId), columns: { requirementId: true } });
    if (!dod) throw new TrackingError("Ese criterio no existe");
    requirementId ??= dod.requirementId;
  }
  if (requirementId) {
    const req = await db.query.requirements.findFirst({
      where: and(eq(s.requirements.id, requirementId), eq(s.requirements.projectId, projectId)),
      columns: { id: true },
    });
    if (!req) throw new TrackingError("Ese requerimiento no es de este proyecto");
  }
  if (data.featureId) await featureOf(db, projectId, data.featureId);
  const id = crypto.randomUUID();
  const filename = input.filename.replace(/[/\\\0]/g, "").slice(0, 120) || "imagen";
  await db.insert(s.attachments).values({
    id,
    projectId,
    kind: data.kind,
    requirementId: requirementId ?? null,
    dodItemId: data.dodItemId ?? null,
    featureId: data.featureId ?? null,
    title: data.title,
    route: data.route,
    filename,
    mime,
    size: input.bytes.length,
    data: Buffer.from(input.bytes),
    createdBy: actor,
  });
  await tracker.touch(projectId, "attachment", id);
  const { data: _bytes, ...row } = (await db.query.attachments.findFirst({ where: eq(s.attachments.id, id) }))!;
  return row;
}
