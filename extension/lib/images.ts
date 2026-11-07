import type { DocumentInput, ImageInput } from "@/lib/client";

/** The API accepts at most this many images per request. */
export const MAX_IMAGES = 8;

// Large photos are scaled down before upload: the model reads text fine at this
// size, and the request stays well under the API's size limit.
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

export type PreparedImage = (ImageInput | DocumentInput) & { id: string; name: string; previewUrl?: string };

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_FILE_BYTES = 10_000_000;

export async function prepareFile(file: File): Promise<PreparedImage> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 10 MB file limit.`);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const media_type = extension === "pdf" ? "application/pdf" : extension === "xlsx" ? XLSX_TYPE : undefined;
  if (media_type) {
    return { id: crypto.randomUUID(), name: file.name, media_type, data: await toBase64(file) };
  }
  return prepareImage(file);
}

export function extractionInputs(files: PreparedImage[]): { images: ImageInput[]; documents: DocumentInput[] } {
  const images: ImageInput[] = [];
  const documents: DocumentInput[] = [];
  for (const file of files) {
    const { media_type, data, name } = file;
    if (media_type === "application/pdf" || media_type === XLSX_TYPE) {
      documents.push({ media_type, data, name });
    } else {
      images.push({ media_type, data });
    }
  }
  return { images, documents };
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not supported. Use an image, PDF or .xlsx workbook.`);
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare images.");
  // JPEG has no transparency; without a white background clear areas turn black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  return {
    id: crypto.randomUUID(),
    name: file.name,
    previewUrl: URL.createObjectURL(blob),
    media_type: "image/jpeg",
    data: await toBase64(blob),
  };
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // Chunks keep String.fromCharCode under the engine's argument limit.
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}
