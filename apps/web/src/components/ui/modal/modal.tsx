import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Max width in px. */
  width?: number;
};

/** A native <dialog> with a header, a scrolling body and a footer; Escape and the backdrop close it. */
const Modal = ({ open, onClose, title, description, footer, children, width = 720 }: ModalProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      style={{ width: `min(calc(100vw - 2rem), ${width}px)` }}
      className="m-auto max-h-[90dvh] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="border-b border-line px-5 py-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="text-sm text-muted">{description}</p>}
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
};

export default Modal;
