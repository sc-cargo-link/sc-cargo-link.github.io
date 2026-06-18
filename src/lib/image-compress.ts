const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 0.85;

export interface CompressedImage {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function fitWithinMaxDimensions(
  width: number,
  height: number,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function compressImageFile(file: File): Promise<CompressedImage> {
  const img = await loadImageFromFile(file);
  const { width, height } = fitWithinMaxDimensions(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Failed to compress image"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const compressedFile = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });

  return { file: compressedFile, dataUrl, width, height };
}
