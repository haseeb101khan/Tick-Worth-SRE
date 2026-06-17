import { cloudinary } from '../cloudinary';
import { BadRequestError } from '../utils/errors';

/**
 * Upload an image (a base64 data: URL, or an existing http(s) URL) to Cloudinary and return the
 * hosted secure URL. The browser pre-compresses the file, so what arrives here is already small.
 */
export async function uploadImage(image: string, folder = 'tickworth/products'): Promise<string> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    throw new BadRequestError('Image hosting is not configured (set the CLOUDINARY_* env vars).');
  }
  const result = await cloudinary.uploader.upload(image, {
    folder,
    resource_type: 'image',
  });
  return result.secure_url;
}
