const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const formidable = require('formidable');
const fs = require('fs/promises');
const sharp = require('sharp');
const FileType = require('file-type');

// Initialize S3 client if env is present
const s3Enabled = Boolean(process.env.S3_BUCKET);
const s3 = s3Enabled ? new S3Client({
  region: process.env.S3_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
}) : null;

module.exports = async (req, res) => {
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
    const ft = await FileType.fromBuffer(input);
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

      const key = `${type === 'avatar' ? 'profilePictures' : 'coverPhotos'}/${userId}_optimized_${w}.webp`;

      if (s3Enabled) {
        await s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: webpBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        const publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
        outputs[w] = publicUrl;
      } else {
        outputs[w] = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
      }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ urls: outputs }));
  } catch (err) {
    console.error('api/convert error:', err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'conversion_failed' }));
  }
};


