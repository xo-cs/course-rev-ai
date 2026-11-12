"use client";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 500;

export class ImageCheckError extends Error {}

/**
 * Validate + prepare a screenshot: rejects non-images, >5MB and tiny images.
 * Returns an upload-friendly JPEG (longest side <= 2000px, well under Vercel's 4.5MB body limit)
 * and a small thumbnail data URL for the chat bubble.
 */
export async function prepareScreenshot(file: File): Promise<{ upload: Blob; mimeType: string; thumb: string }> {
  if (!file.type.startsWith("image/")) throw new ImageCheckError("That file isn't an image. Upload a PNG or JPG screenshot.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageCheckError("That image is over 5MB. Try a smaller screenshot or crop it.");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new ImageCheckError("I couldn't open that image. Try a PNG or JPG screenshot.");
  }
  if (Math.max(bmp.width, bmp.height) < MIN_SIDE)
    throw new ImageCheckError("That image is too small to read. Take a screenshot at full size, zoomed in on the credits table.");

  const draw = (maxSide: number) => {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  };
  const big = draw(2000);
  const upload = await new Promise<Blob>((res, rej) => big.toBlob((b) => (b ? res(b) : rej(new ImageCheckError("Couldn't prepare the image."))), "image/jpeg", 0.9));
  const thumb = draw(360).toDataURL("image/jpeg", 0.72);
  bmp.close();
  return { upload, mimeType: "image/jpeg", thumb };
}
