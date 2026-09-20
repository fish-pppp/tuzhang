import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { MAX_EXPENSE_PHOTOS, normalizeExpensePhotos, safePhotoUrl } from "@/lib/split/photo";
import type { ExpensePhoto } from "@/lib/split/types";
import { cn } from "@/lib/utils";

export function ExpensePhotoStrip({
  photos,
  className,
}: {
  photos: ExpensePhoto[] | undefined;
  className?: string;
}) {
  const safe = normalizeExpensePhotos(photos) ?? [];
  const [index, setIndex] = useState<number | null>(null);
  if (safe.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted">照片证明 · {safe.length} 张</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {safe.map((photo, i) => {
          const src = safePhotoUrl(photo.url);
          if (!src) return null;
          return (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="block w-full overflow-hidden rounded-lg bg-bg-elevated outline outline-1 -outline-offset-1 outline-fg/10 transition-opacity hover:opacity-90"
                aria-label={`查看第 ${i + 1} 张照片证明`}
              >
                <img src={src} alt="" className="aspect-square w-full object-cover" />
              </button>
            </li>
          );
        })}
      </ul>
      <ExpensePhotoViewer
        photos={safe}
        index={index}
        onClose={() => setIndex(null)}
        onIndex={setIndex}
      />
    </div>
  );
}

export function ExpensePhotoPicker({
  photos,
  disabled,
  pending,
  onPickFiles,
  onRemove,
}: {
  photos: ExpensePhoto[];
  disabled?: boolean;
  pending?: boolean;
  onPickFiles: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const remaining = MAX_EXPENSE_PHOTOS - photos.length;
  const busy = Boolean(disabled || pending);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {photos.length === 0
          ? `可加多张小票或付款截图，最多 ${MAX_EXPENSE_PHOTOS} 张`
          : pending
            ? "正在处理照片…"
            : `已选 ${photos.length} / ${MAX_EXPENSE_PHOTOS} 张`}
      </p>
      <input
        ref={inputRef}
        id="expense-photos"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        multiple
        className="sr-only"
        disabled={busy || remaining <= 0}
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) onPickFiles(files);
          e.target.value = "";
        }}
      />
      <ul className="flex flex-wrap gap-2">
        {photos.map((photo, i) => {
          const src = safePhotoUrl(photo.url);
          if (!src) return null;
          return (
            <li key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="block overflow-hidden rounded-lg outline outline-1 -outline-offset-1 outline-fg/10"
                aria-label={`查看第 ${i + 1} 张照片证明`}
              >
                <img src={src} alt="" className="size-16 object-cover" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                disabled={busy}
                className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-fg text-bg shadow-card disabled:opacity-50"
                aria-label="去掉这张照片"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </li>
          );
        })}
        {remaining > 0 ? (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "grid size-16 place-items-center rounded-lg border border-dashed border-border bg-chip/50 text-muted transition-colors hover:bg-chip hover:text-fg",
                busy && "opacity-60",
              )}
              aria-label={`添加照片，还能加 ${remaining} 张`}
            >
              <ImagePlus className="size-5" />
            </button>
          </li>
        ) : null}
      </ul>
      <ExpensePhotoViewer
        photos={photos}
        index={index}
        onClose={() => setIndex(null)}
        onIndex={setIndex}
      />
    </div>
  );
}

function ExpensePhotoViewer({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: ExpensePhoto[];
  index: number | null;
  onClose: () => void;
  onIndex: (index: number) => void;
}) {
  const open = index != null && index >= 0 && index < photos.length;
  const photo = open ? photos[index] : null;
  const src = photo ? safePhotoUrl(photo.url) : null;
  const count = photos.length;
  const closeRef = useRef<HTMLButtonElement>(null);

  function step(delta: number) {
    if (index == null || count <= 1) return;
    onIndex((index + delta + count) % count);
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (index == null || count <= 1) return;
      if (event.key === "ArrowLeft") onIndex((index - 1 + count) % count);
      if (event.key === "ArrowRight") onIndex((index + 1) % count);
    }
    // Capture so the parent bill dialog does not swallow Escape / arrows.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, index, count, onClose, onIndex]);

  if (!open || !src || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-fg/80 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="照片证明"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 text-bg">
        <p className="text-sm">
          照片证明
          <span className="ml-2 text-bg/70">
            第 {index + 1} / {count} 张
          </span>
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-md text-bg/80 transition-colors hover:bg-bg/15 hover:text-bg"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-8">
        <img
          src={src}
          alt=""
          className="max-h-[80dvh] max-w-full rounded-lg bg-bg-elevated object-contain"
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-bg/85 text-fg"
              aria-label="上一张"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-bg/85 text-fg"
              aria-label="下一张"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
