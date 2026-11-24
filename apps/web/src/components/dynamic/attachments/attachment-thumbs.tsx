import { useState } from "react";
import type { Attachment } from "@/lib/api";
import { attachmentUrl } from "@/lib/attachments";
import AttachmentLightbox from "./attachment-lightbox";

type AttachmentThumbsProps = {
  images: Attachment[];
  onDelete?: (image: Attachment) => void;
  size?: "sm" | "md";
};

/** A row of thumbnails; a click opens the image full size. */
const AttachmentThumbs = ({ images, onDelete, size = "md" }: AttachmentThumbsProps) => {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const box = size === "sm" ? "h-14 w-20" : "h-24 w-36";

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {images.map((image, i) => (
          <li key={image.id} className="group relative">
            <button
              type="button"
              onClick={() => setOpen(i)}
              className={`block overflow-hidden rounded-md border border-line bg-subtle transition-colors duration-150 hover:border-brand ${box}`}
            >
              <img src={attachmentUrl(image)} alt={image.title || image.filename} loading="lazy" className="size-full object-cover" />
            </button>
            {onDelete && (
              <button
                type="button"
                aria-label={`Quitar ${image.title || image.filename}`}
                onClick={() => confirm("Quitar esta imagen. No se puede deshacer.") && onDelete(image)}
                className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full border border-line bg-surface text-muted opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
              >
                <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
      <AttachmentLightbox images={images} index={open} onIndex={setOpen} />
    </>
  );
};

export default AttachmentThumbs;
