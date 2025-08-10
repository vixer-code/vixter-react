import formidable from 'formidable';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  try {
    const form = formidable({ multiples: false, maxFileSize: 30 * 1024 * 1024 });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const type = (fields.type || 'cover').toString();
    const userId = (fields.userId || 'unknown').toString();
    const file = files.file;
    if (!file) {
      res.statusCode = 400;
      return res.json({ error: 'file is required' });
    }

    const input = await fs.readFile(file.filepath);
    const ft = await fileTypeFromBuffer(input);
    if (!ft || !ft.mime.startsWith('image/')) {
      res.statusCode = 415;
      return res.json({ error: 'unsupported_media_type' });
    }

    const quality = 78;
    const widths = type === 'avatar' ? [512] : [720, 1440];
    const outputs = {};

    for (const w of widths) {
      const webpBuffer = await sharp(input)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      // Return base64 data URL since we're not using S3
      outputs[w] = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
    }

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ urls: outputs }));
  } catch (err) {
    console.error('api/convert error:', err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'conversion_failed' }));
  }
}


