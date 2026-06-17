import { v2 as cloudinary } from 'cloudinary';

// Configured from the environment (.env) — never hard-code credentials. The API secret stays
// server-side; the browser uploads through our API, so it never sees the secret.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };
