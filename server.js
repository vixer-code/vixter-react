const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const rateLimit = require('express-rate-limit');
const FileType = require('file-type');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();

// Basic hardening
app.use(express.json());
app.disable('x-powered-by');

// CORS (adjust origin in production)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Rate limit media endpoints
const mediaLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 60 });

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));

// In-app image conversion endpoint (local or for S3)
// POST /api/convert
//   form-data: file (image), type=cover|avatar, userId=<id>
const upload = multer({ limits: { fileSize: 30 * 1024 * 1024 } });

// Basic S3 client (configure with env vars when you switch from Firebase)
const s3Enabled = Boolean(process.env.S3_BUCKET);
const s3 = s3Enabled ? new S3Client({
  region: process.env.S3_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
}) : null;

app.post('/api/convert', mediaLimiter, upload.single('file'), async (req, res) => {
  try {
    const { type = 'cover', userId = 'unknown' } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    // Validate real content-type
    const ft = await FileType.fromBuffer(req.file.buffer);
    if (!ft || !ft.mime.startsWith('image/')) {
      return res.status(415).json({ error: 'unsupported_media_type' });
    }

    const quality = 78;
    // Align widths with serverless API for consistent client handling
    const sizeMap = type === 'avatar'
      ? { small: 128, medium: 256, large: 512 }
      : { small: 480, medium: 960, large: 1440 };

    const outputs = {};
    for (const [label, width] of Object.entries(sizeMap)) {
      const webpBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      const key = `${type === 'avatar' ? 'profilePictures' : 'coverPhotos'}/${userId}_${label}_${width}.webp`;

      if (s3Enabled) {
        await s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: webpBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        const publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
        outputs[label] = publicUrl;
      } else {
        outputs[label] = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
      }
    }

    return res.json({ type, sizes: outputs, uploadedAt: new Date().toISOString() });
  } catch (err) {
    console.error('convert error:', err);
    return res.status(500).json({ error: 'conversion_failed' });
  }
});

// Video transcode endpoint: MP4 H.264 + poster WebP
// POST /api/transcode  form-data: file (video), userId, makePoster=true|false
app.post('/api/transcode', mediaLimiter, upload.single('file'), async (req, res) => {
  try {
    const { userId = 'unknown', makePoster = 'true' } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const ft = await FileType.fromBuffer(req.file.buffer);
    if (!ft || !ft.mime.startsWith('video/')) {
      return res.status(415).json({ error: 'unsupported_media_type' });
    }

    // Transcode to MP4 H.264 + AAC, limit bitrate for web delivery
    const inputTmp = Buffer.from(req.file.buffer);
    const chunks = [];
    const posterChunks = [];

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputTmp)
        .inputFormat('mov,mp4,m4a,3gp,3g2,mj2')
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
        .pipe()
        .on('data', (c) => chunks.push(c))
        .on('error', reject);
    });

    let posterBuffer = null;
    if (makePoster === 'true') {
      // Extract frame at 0.5s and convert to WebP 720w
      const rawPosterChunks = [];
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(req.file.buffer)
          .on('error', reject)
          .on('end', resolve)
          .screenshots({ count: 1, timemarks: ['0.5'], filename: 'frame.png' })
          .pipe()
          .on('data', (c) => rawPosterChunks.push(c))
          .on('error', reject);
      });
      const rawPoster = Buffer.concat(rawPosterChunks);
      posterBuffer = await sharp(rawPoster).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
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
      // Return data URLs if no S3 (for testing only)
      videoUrl = `data:video/mp4;base64,${mp4Buffer.toString('base64')}`;
      if (posterBuffer) posterUrl = `data:image/webp;base64,${posterBuffer.toString('base64')}`;
    }

    return res.json({ videoUrl, posterUrl });
  } catch (err) {
    console.error('transcode error:', err);
    return res.status(500).json({ error: 'transcode_failed' });
  }
});

// Centralized error handler for upload size and unexpected errors
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large', limit: '30MB' });
  }
  if (err) {
    console.error('unhandled error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
  return next();
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 