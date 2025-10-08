const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const Busboy = require('busboy');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const PACK_CONTENT_BUCKET_NAME = process.env.R2_PACK_CONTENT_BUCKET_NAME || 'vixter-pack-content-private';

// Initialize CORS
const corsHandler = cors({ 
  origin: [
    'https://vixter-react.vercel.app',
    'https://vixter.com.br',
    'https://www.vixter.com.br',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
});

/**
 * Cloud Function to upload and process pack videos with vendor QR code
 */
exports.packUploadVideo = onRequest({
  region: 'us-east1',
  cors: [
    'https://vixter-react.vercel.app',
    'https://vixter.com.br',
    'https://www.vixter.com.br',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  invoker: 'public',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (req, res) => {
  // Set CORS headers manually as backup
  res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return corsHandler(req, res, async () => {
    let inputPath = null;
    let outputPath = null;
    let vendorQRPath = null;
    
    const cleanup = () => {
      try {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        if (vendorQRPath && fs.existsSync(vendorQRPath)) fs.unlinkSync(vendorQRPath);
        
        // Clean up QR grid files
        const tempDir = os.tmpdir();
        const qrFiles = fs.readdirSync(tempDir).filter(file => 
          file.startsWith('vendor_qr_') && file.endsWith('.png')
        );
        qrFiles.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (err) {
            console.warn(`Could not delete QR file ${file}:`, err);
          }
        });
      } catch (cleanupError) {
        console.error('Error cleaning up temp files:', cleanupError);
      }
    };
    
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authorization header with Bearer token required'
        });
      }
      
      const token = authHeader.substring(7);
      
      // Verify Firebase token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({
          error: 'Invalid or expired token'
        });
      }
      
      // Get user data
      const userId = decodedToken.uid;
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({
          error: 'User not found'
        });
      }
      
      const vendorUsername = userDoc.data().username;
      
      // Parse multipart form data
      const busboy = Busboy({ headers: req.headers });
      const formData = {};
      let videoFile = null;
      let videoFilename = null;
      let videoContentType = null;
      
      const filePromise = new Promise((resolve, reject) => {
        busboy.on('field', (fieldname, val) => {
          formData[fieldname] = val;
        });
        
        busboy.on('file', (fieldname, file, info) => {
          const { filename, mimeType } = info;
          
          if (fieldname === 'video') {
            videoFilename = filename;
            videoContentType = mimeType;
            
            const tempDir = os.tmpdir();
            const timestamp = Date.now();
            inputPath = path.join(tempDir, `upload_${timestamp}_${filename}`);
            
            const writeStream = fs.createWriteStream(inputPath);
            file.pipe(writeStream);
            
            writeStream.on('finish', () => {
              console.log(`Video file saved to: ${inputPath}`);
            });
            
            writeStream.on('error', (error) => {
              console.error('Error saving video file:', error);
              reject(error);
            });
          }
        });
        
        busboy.on('finish', () => {
          resolve();
        });
        
        busboy.on('error', (error) => {
          reject(error);
        });
      });
      
      req.pipe(busboy);
      await filePromise;
      
      // Validate required fields
      const { packId, key } = formData;
      
      if (!packId || !key) {
        cleanup();
        return res.status(400).json({
          error: 'Missing required fields: packId, key'
        });
      }
      
      if (!inputPath || !fs.existsSync(inputPath)) {
        cleanup();
        return res.status(400).json({
          error: 'No video file uploaded'
        });
      }
      
      console.log(`Processing video for vendor: ${vendorUsername}`);
      
      // Get video dimensions
      const videoDimensions = await getVideoDimensions(inputPath);
      console.log(`Video dimensions: ${videoDimensions.width}x${videoDimensions.height}`);
      
      // Generate vendor QR code
      const vendorUrl = `https://vixter.com.br/${vendorUsername}`;
      const qrPattern = await generateVideoQRCodePattern(vendorUsername, videoDimensions.width, videoDimensions.height);
      
      if (qrPattern.vendorQR) {
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        vendorQRPath = path.join(tempDir, `vendor_qr_${timestamp}.png`);
        fs.writeFileSync(vendorQRPath, qrPattern.vendorQR);
        console.log(`Vendor QR code written to: ${vendorQRPath}`);
      }
      
      // Process video with vendor QR code
      const timestamp = Date.now();
      outputPath = path.join(os.tmpdir(), `output_${timestamp}.mp4`);
      
      const vendorText = escapeFFmpegText(`vixter.com.br/${vendorUsername}`);
      
      // Test ffmpeg availability first
      const ffmpegAvailable = await testFFmpeg();
      if (!ffmpegAvailable) {
        console.warn('FFmpeg not available, uploading video without watermark');
        // Upload original video without watermark
        const fileBuffer = fs.readFileSync(inputPath);
        const uploadResult = await uploadToR2(key, fileBuffer, videoContentType || 'video/mp4');
        cleanup();
        
        return res.status(200).json({
          success: true,
          data: {
            key: uploadResult.key,
            size: fileBuffer.length,
            type: videoContentType || 'video/mp4',
            name: videoFilename,
            processed: false
          }
        });
      }
      
      await new Promise((resolve, reject) => {
        const videoFilters = [];
        
        // Try QR code grid approach first
        if (qrPattern.vendorQR) {
          console.log('Attempting QR code grid watermarking...');
          
          // Build simple overlay filter with text
          const textFilters = [
            `drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=20`
          ];
          videoFilters.push(textFilters.join(','));
        } else {
          // Fallback to text only
          const textFilters = [
            `drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=20`
          ];
          videoFilters.push(textFilters.join(','));
        }
        
        console.log('FFmpeg video filters:', videoFilters);
        
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset superfast',
            '-crf 23',
            '-movflags +faststart',
            '-pix_fmt yuv420p',
            '-maxrate 3M',
            '-bufsize 6M',
            '-threads 0'
          ])
          .videoFilters(videoFilters)
          .on('start', (commandLine) => {
            console.log('FFmpeg process started:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log('Video processing: ' + Math.round(progress.percent) + '% done');
            }
          })
          .on('end', () => {
            console.log('Video processing completed');
            resolve();
          })
          .on('error', (error) => {
            console.error('FFmpeg error:', error);
            reject(error);
          })
          .save(outputPath);
      });
      
      // Verify output file
      if (!fs.existsSync(outputPath)) {
        cleanup();
        return res.status(500).json({
          error: 'Failed to process video'
        });
      }
      
      const processedVideoBuffer = fs.readFileSync(outputPath);
      console.log(`Processed video size: ${processedVideoBuffer.length} bytes`);
      
      // Upload to R2
      const uploadResult = await uploadToR2(key, processedVideoBuffer, 'video/mp4');
      
      cleanup();
      
      return res.status(200).json({
        success: true,
        data: {
          key: uploadResult.key,
          size: processedVideoBuffer.length,
          type: 'video/mp4',
          name: videoFilename,
          processed: true
        }
      });
      
    } catch (error) {
      console.error('Error in packUploadVideo:', error);
      cleanup();
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  });
});

/**
 * Upload processed video to R2
 */
async function uploadToR2(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: PACK_CONTENT_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  
  await r2Client.send(command);
  
  return {
    key,
    size: buffer.length,
    contentType
  };
}

/**
 * Generate QR code for video watermarking
 */
async function generateQRCode(url, size = 200, opacity = 0.15) {
  try {
    const baseColor = '#FFFFFF'; // White for videos
    
    console.log(`Generating QR code: size=${size}, color=${baseColor}, opacity=${opacity}`);

    // Generate base QR code
    const qrBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: size,
      margin: 1,
      color: {
        dark: baseColor,
        light: '#00000000'
      }
    });

    // Apply opacity using sharp (if available)
    try {
      const sharp = require('sharp');
      const { data, info } = await sharp(qrBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Modify alpha channel
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          data[i + 3] = Math.round(255 * opacity);
        }
      }
      
      const qrWithOpacity = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4
        }
      })
      .png()
      .toBuffer();

      return qrWithOpacity;
    } catch (sharpError) {
      console.warn('Sharp not available, using QR code without opacity adjustment');
      return qrBuffer;
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

/**
 * Generate QR code pattern for video watermarking
 */
async function generateVideoQRCodePattern(vendorUsername, videoWidth = 1920, videoHeight = 1080) {
  const vendorUrl = `https://vixter.com.br/${vendorUsername}`;
  
  // Calculate QR code size - 20% of smallest dimension
  const smallestDimension = Math.min(videoWidth, videoHeight);
  const calculatedSize = Math.floor(smallestDimension * 0.20);
  
  // Apply min/max constraints
  const qrSize = Math.max(200, Math.min(calculatedSize, 600));
  
  const opacity = 0.15;
  
  console.log(`Video QR Code size: ${qrSize}px for video ${videoWidth}x${videoHeight}`);
  
  const vendorQR = await generateQRCode(vendorUrl, qrSize, opacity);
  
  return {
    vendorQR,
    size: qrSize,
    videoWidth,
    videoHeight
  };
}

/**
 * Get video dimensions using ffprobe
 */
async function getVideoDimensions(videoPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(videoPath)) {
      console.warn('Video file does not exist:', videoPath);
      resolve({ width: 1920, height: 1080 });
      return;
    }
    
    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      console.warn('Video file is empty:', videoPath);
      resolve({ width: 1920, height: 1080 });
      return;
    }
    
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.warn('Could not get video dimensions, using defaults:', err);
        resolve({ width: 1920, height: 1080 });
        return;
      }
      
      if (!metadata || !metadata.streams) {
        console.warn('No metadata or streams found, using defaults');
        resolve({ width: 1920, height: 1080 });
        return;
      }
      
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (videoStream && videoStream.width && videoStream.height) {
        resolve({
          width: videoStream.width,
          height: videoStream.height
        });
      } else {
        console.warn('No valid video stream found, using defaults');
        resolve({ width: 1920, height: 1080 });
      }
    });
  });
}

/**
 * Test if ffmpeg is working correctly
 */
async function testFFmpeg() {
  return new Promise((resolve) => {
    ffmpeg()
      .input('color=c=black:s=320x240:d=1')
      .inputFormat('lavfi')
      .outputOptions(['-f', 'null'])
      .on('end', () => {
        console.log('FFmpeg test completed successfully');
        resolve(true);
      })
      .on('error', (error) => {
        console.error('FFmpeg test failed:', error);
        resolve(false);
      })
      .save('/dev/null');
  });
}

/**
 * Escape special characters for FFmpeg text
 */
function escapeFFmpegText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/=/g, '\\=')
    .replace(/;/g, '\\;')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

