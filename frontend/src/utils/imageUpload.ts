// Turn a chosen / dropped / pasted image File into a compressed JPEG data URL.
// We downscale to a sane max dimension and re-encode so the stored string stays
// small (no separate file storage needed — it lives in the product's imageUrl).

const MAX_DIM = 1280;
const QUALITY = 0.82;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image'));
    img.src = src;
  });
}

export async function fileToCompressedDataUrl(
  file: File,
  maxDim = MAX_DIM,
  quality = QUALITY,
): Promise<string> {
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original; // canvas unsupported — fall back to the raw data URL
  // White matte so transparent PNGs don't turn black when re-encoded to JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}
