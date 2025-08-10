// pages/api/convert.js (Next.js API route)
import formidable from 'formidable';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { promises as fs } from 'fs';
import { storage } from '../../../config/firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const form = formidable({ multiples: false, maxFileSize: 10 * 1024 * 1024 });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const type = (fields.type || 'post').toString();
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'file is required' });

    const buffer = await fs.readFile(file.filepath);
    const ft = await fileTypeFromBuffer(buffer);
    if (!ft || !ft.mime.startsWith('image/')) {
      return res.status(415).json({ error: 'unsupported_media_type' });
    }

    const sizes =
      type === 'avatar'
        ? { small: 128, medium: 256, large: 512 }
        : { small: 480, medium: 960, large: 1440 };

    const quality = 80;
    const urls = {};

    for (const [label, width] of Object.entries(sizes)) {
      const webpBuffer = await sharp(buffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      const filename = `${Date.now()}-${label}.webp`;
      const storagePath = `uploads/${type}/${filename}`;
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, webpBuffer, { contentType: 'image/webp' });
      urls[label] = await getDownloadURL(fileRef);
    }

    return res.json({
      type,
      sizes: urls,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('api/convert error:', err);
    return res.status(500).json({ error: 'conversion_failed', details: err.message });
  }
}
