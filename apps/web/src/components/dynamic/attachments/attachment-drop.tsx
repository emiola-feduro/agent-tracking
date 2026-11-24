import { useId, useRef, useState, type ReactNode } from "react";
import { IMAGE_ACCEPT, pickImages } from "@/lib/attachments";

type AttachmentDropProps = {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  /** compact: just a small "Adjuntar imagen" link, for criteria. */
  compact?: boolean;
  label?: ReactNode;
};

/**
 * Adds images by choosing files, dropping them, or pasting a screenshot (Ctrl+V while focused).
 * Rejected files are explained right there.
 */
const AttachmentDrop = ({ onFiles, busy = false, compact = false, label = "Agregar imágenes" }: AttachmentDropProps) => {
  const input = useRef<HTMLInputElement>(null);
  const hint = useId();
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const take = (files: Iterable<File>) => {
    const { ok, rejected } = pickImages(files);
    setErrors(rejected);
    if (ok.length) onFiles(ok);
  };

  const picker = (
    <input
      ref={input}
      type="file"
      accept={IMAGE_ACCEPT}
      multiple
      hidden
      onChange={(e) => {
        take(e.target.files ?? []);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <>
        {picker}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-sm text-xs font-medium text-brand hover:underline disabled:opacity-50"
        >
          {busy ? "Subiendo..." : label}
        </button>
        {errors.length > 0 && <span className="text-xs text-danger">{errors.join(". ")}</span>}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {picker}
      <div
        role="button"
        tabIndex={0}
        aria-describedby={hint}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        onPaste={(e) => {
          const files = [...e.clipboardData.files];
          if (files.length) {
            e.preventDefault();
            take(files);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed px-4 py-2 text-center transition-colors duration-150 ${over ? "border-brand bg-brand-soft" : "border-line-strong hover:border-brand hover:bg-subtle"}`}
      >
        <span className="text-sm font-medium text-ink">{busy ? "Subiendo..." : label}</span>
        <span id={hint} className="text-xs text-muted">
          Arrastra, elige o pega una captura con Ctrl+V. PNG, JPEG, WebP o GIF, hasta 10 MB.
        </span>
      </div>
      {errors.length > 0 && <p className="text-xs text-danger">{errors.join(". ")}</p>}
    </div>
  );
};

export default AttachmentDrop;
