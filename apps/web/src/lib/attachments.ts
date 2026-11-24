import type { Attachment } from "./api";

export const attachmentUrl = (a: Pick<Attachment, "id">) => `/api/attachments/${a.id}`;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
const MAX_BYTES = 10 * 1024 * 1024;

/** Keeps the images the server will accept; says why the rest were left out. */
export const pickImages = (files: Iterable<File>) => {
  const ok: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (!IMAGE_ACCEPT.split(",").includes(file.type)) rejected.push(`${file.name}: no es PNG, JPEG, WebP, GIF ni AVIF`);
    else if (file.size > MAX_BYTES) rejected.push(`${file.name}: pesa más de 10 MB`);
    else ok.push(file);
  }
  return { ok, rejected };
};
