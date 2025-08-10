import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import FileType from 'file-type';
import sharp from 'sharp';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath.path);

const s3Enabled = Boolean(process.env.S3_BUCKET);
const s3 = s3Enabled ? new S3Client({
  region: process.env.S3_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
}) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  try {
    const form = formidable({ multiples: false, maxFileSize: 100 * 1024 * 1024 });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const userId = (fields.userId || 'unknown').toString();
    const makePoster = (fields.makePoster || 'true').toString() === 'true';
    const file = files.file;
    if (!file) {
      res.statusCode = 400;
      return res.json({ error: 'file is required' });
    }

    const input = await fs.readFile(file.filepath);
    const ft = await FileType.fromBuffer(input);
    if (!ft || !ft.mime.startsWith('video/')) {
      res.statusCode = 415;
      return res.json({ error: 'unsupported_media_type' });
    }

    // Transcode to mp4 H.264 + AAC using fluent-ffmpeg
    const chunks = [];
    await new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(file.filepath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-movflags +faststart',
          '-preset veryfast',
          '-profile:v high',
          '-level 4.1',
          '-crf 23',
          '-b:v 2500k',
          '-maxrate 2500k',
          '-bufsize 5000k',
          '-pix_fmt yuv420p',
        ])
        .format('mp4')
        .on('error', reject)
        .on('end', resolve)
        .pipe();

      command.on('data', (c) => chunks.push(c));
      command.on('error', reject);
    });

    let posterBuffer = null;
    if (makePoster) {
      // Extract frame at 0.5s and convert to WebP 720w
      const posterTmp = await new Promise((resolve, reject) => {
        const out = [];
        const cmd = ffmpeg()
          .input(file.filepath)
          .on('error', reject)
          .on('end', () => resolve(Buffer.concat(out)))
          .screenshots({ count: 1, timemarks: ['0.5'], filename: 'frame.png' })
          .pipe();
        cmd.on('data', (c) => out.push(c));
        cmd.on('error', reject);
      });
      posterBuffer = await sharp(posterTmp).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    }

    const mp4Buffer = Buffer.concat(chunks);
    const keyBase = `videos/${userId}/${Date.now()}`;

    let videoUrl, posterUrl;
    if (s3Enabled) {
      const videoKey = `${keyBase}.mp4`;
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: videoKey, Body: mp4Buffer, ContentType: 'video/mp4', CacheControl: 'public, max-age=31536000, immutable' }));
      videoUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${videoKey}`;

      if (posterBuffer) {
        const posterKey = `${keyBase}_poster.webp`;
        await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: posterKey, Body: posterBuffer, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' }));
        posterUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${posterKey}`;
      }
    } else {
      videoUrl = `data:video/mp4;base64,${mp4Buffer.toString('base64')}`;
      if (posterBuffer) posterUrl = `data:image/webp;base64,${posterBuffer.toString('base64')}`;
    }

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ videoUrl, posterUrl }));
  } catch (err) {
    console.error('api/transcode error:', err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'transcode_failed' }));
  }
};


