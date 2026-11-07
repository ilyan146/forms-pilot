import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";

import { MAX_IMAGES, type PreparedImage } from "@/lib/images";

type Props = {
  images: PreparedImage[];
  preparing: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
};

export function ImageDrop({ images, preparing, onAdd, onRemove }: Props) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const full = images.length >= MAX_IMAGES;

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    onAdd([...event.dataTransfer.files]);
  }

  function onPaste(event: ClipboardEvent) {
    const files = [...event.clipboardData.files];
    if (files.length > 0) onAdd(files);
  }

  return (
    <section className="flex flex-col gap-2" onPaste={onPaste}>
      <button
        type="button"
        disabled={full || preparing}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded border-2 border-dashed px-3 py-6 text-center text-slate-600 disabled:opacity-50 ${
          dragging ? "border-slate-900 bg-slate-100" : "border-slate-300"
        }`}
      >
        {full
          ? `${MAX_IMAGES} files is the limit.`
          : preparing
            ? "Preparing files…"
            : "Drop images, PDFs or Excel (.xlsx) here, paste, or click to choose."}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*,.pdf,.xlsx"
        multiple
        hidden
        onChange={(event) => {
          onAdd([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />

      {images.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <li key={image.id} className="relative">
              {image.previewUrl ? <img
                src={image.previewUrl}
                alt={`Image ${index + 1}: ${image.name}`}
                className="aspect-square w-full rounded border object-cover"
              /> : <div className="flex aspect-square items-center justify-center rounded border bg-white p-1 text-center text-xs break-all" title={image.name}>
                {image.name}
              </div>}
              <span className="absolute bottom-0.5 left-0.5 rounded bg-white/90 px-1 text-xs">
                {index + 1}
              </span>
              <button
                type="button"
                aria-label={`Remove ${image.name}`}
                onClick={() => onRemove(image.id)}
                className="absolute top-0.5 right-0.5 rounded bg-white/90 px-1 text-xs"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
