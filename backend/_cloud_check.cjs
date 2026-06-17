require('dotenv').config();
const { v2: c } = require('cloudinary');
c.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('keys present -> cloud_name:', !!process.env.CLOUDINARY_CLOUD_NAME,
            '| api_key:', !!process.env.CLOUDINARY_API_KEY,
            '| api_secret:', !!process.env.CLOUDINARY_API_SECRET);
const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
(async () => {
  try {
    const r = await c.uploader.upload(img, { folder: 'tickworth/products' });
    console.log('UPLOAD OK ->', r.secure_url);
    try { await c.uploader.destroy(r.public_id); console.log('cleanup: test image deleted'); }
    catch (e) { console.log('cleanup skipped:', e.message); }
  } catch (e) {
    console.log('UPLOAD FAILED:', e && e.message ? e.message : String(e));
  }
})();
