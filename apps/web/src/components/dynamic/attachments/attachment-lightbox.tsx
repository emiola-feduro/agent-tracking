import { useEffect, useRef } from "react";
import Button from "@/components/ui/button/button";
import type { Attachment } from "@/lib/api";
import { attachmentUrl } from "@/lib/attachments";

type AttachmentLightboxProps = {
  images: Attachment[];
  index: number | null;
  onIndex: (index: number | null) => void;
};

/** Full size view of one image, with previous and next (arrow keys too). */
const AttachmentLightbox = ({ images, index, onIndex }: AttachmentLightboxProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const image = index === null ? null : images[index];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (image && !dialog.open) dialog.showModal();
    if (!image && dialog.open) dialog.close();
  }, [image]);

  const step = (delta: number) => index !== null && onIndex((index + delta + images.length) % images.length);

  return (
    <dialog
      ref={ref}
      onClose={() => onIndex(null)}
      onClick={(e) => e.target === ref.current && onIndex(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      aria-label={image?.title || image?.filename || "Imagen"}
      className="m-auto max-h-[94dvh] w-[min(calc(100vw-1.5rem),1200px)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/70"
    >
      {image && (
        <div className="flex max-h-[94dvh] flex-col">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-semibold">{image.title || image.filename}</p>
              {image.route && <code className="font-mono text-xs text-muted">{image.route}</code>}
            </div>
            <div className="flex items-center gap-1">
              {images.length > 1 && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => step(-1)} aria-label="Imagen anterior">
                    Anterior
                  </Button>
                  <span className="text-xs text-muted tabular-nums">
                    {index! + 1} de {images.length}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => step(1)} aria-label="Imagen siguiente">
                    Siguiente
                  </Button>
                </>
              )}
              <a href={attachmentUrl(image)} target="_blank" rel="noreferrer" className="rounded-md px-2.5 py-1.5 text-sm text-ink-soft hover:bg-subtle hover:text-ink">
                Abrir original
              </a>
              <Button variant="ghost" size="sm" onClick={() => onIndex(null)}>
                Cerrar
              </Button>
            </div>
          </header>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-subtle p-3">
            <img src={attachmentUrl(image)} alt={image.title || image.filename} className="max-h-[80dvh] max-w-full rounded-sm object-contain" />
          </div>
        </div>
      )}
    </dialog>
  );
};

export default AttachmentLightbox;
