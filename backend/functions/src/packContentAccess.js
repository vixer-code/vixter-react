const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Initialize R2 client (Cloudflare R2 is S3-compatible)
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
 * Cloud Function to serve pack content with watermark and access control
 */
exports.packContentAccess = onRequest({
  region: 'us-east1',
  cors: true,
  invoker: 'public',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authorization header with Bearer token required'
        });
      }
      
      const token = authHeader.substring(7);
      console.log('Using JWT token from Authorization header');
      
      let packId, contentKey, username, orderId, vendorId, vendorUsername, userId, watermark;
      
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid JWT format - expected 3 parts');
        }
        
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        packId = payload.packId;
        contentKey = payload.contentKey;
        username = payload.username;
        orderId = payload.orderId;
        vendorId = payload.vendorId;
        vendorUsername = payload.vendorUsername;
        userId = payload.userId;
        watermark = username;
        
        console.log('Decoded JWT payload:', { packId, contentKey, username, orderId, vendorId, vendorUsername, userId, watermark });
      } catch (error) {
        console.error('Error decoding JWT token:', error);
        console.error('Token received:', token.substring(0, 50) + '...');
        return res.status(400).json({
          error: 'Invalid token format',
          details: error.message
        });
      }

      if (!packId || !contentKey || !username) {
        return res.status(400).json({
          error: 'Missing required parameters: packId, contentKey, username'
        });
      }

      const user = {
        userId: userId,
        username: username
      };
      console.log('Using JWT token data for user:', user);

      const packContent = await getPackContentMetadata(packId, contentKey);
      if (!packContent) {
        return res.status(404).json({
          error: 'Content not found'
        });
      }

      const vendorInfo = {
        username: vendorUsername,
        profileUrl: `vixter.com.br/profile/${vendorUsername}`
      };
      console.log('Using JWT vendor info:', vendorInfo);
      
      const watermarkedBuffer = await generateWatermarkedMedia(
        packContent,
        watermark,
        username,
        user,
        vendorInfo
      );

      res.set({
        'Content-Type': packContent.type,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Disposition': 'inline',
        'X-Watermark': watermark || 'protected',
        'X-Username': username
      });

      res.send(watermarkedBuffer);

    } catch (error) {
      console.error('Error in packContentAccess:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  });
});

/**
 * Get pack content metadata from Firestore
 */
async function getPackContentMetadata(packId, contentKey) {
  try {
    const packDoc = await db.collection('packs').doc(packId).get();
    
    if (!packDoc.exists) {
      return null;
    }

    const packData = packDoc.data();
    const contentItem = packData.packContent?.find(item => item.key === contentKey);
    
    if (!contentItem) {
      return null;
    }

    return {
      ...contentItem,
      packId,
      packTitle: packData.title
    };

  } catch (error) {
    console.error('Error getting pack content metadata:', error);
    return null;
  }
}

/**
 * Analyze image brightness to determine if it's a light or dark image
 */
async function analyzeImageBrightness(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    
    const resized = await image
      .resize(50, 50, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer();
    
    let totalBrightness = 0;
    for (let i = 0; i < resized.length; i++) {
      totalBrightness += resized[i];
    }
    
    const averageBrightness = totalBrightness / resized.length;
    const normalizedBrightness = averageBrightness / 255;
    
    return normalizedBrightness;
  } catch (error) {
    console.error('Error analyzing image brightness:', error);
    return 0.5;
  }
}

/**
 * Generate QR code with opacity applied ONLY to black pixels
 */
async function generateQRCode(url, size = 60, isLightBackground = false, opacity = 0.15) {
  try {
    const baseColor = isLightBackground ? '#000000' : '#FFFFFF';
    
    console.log(`Generating QR code: size=${size}, color=${baseColor}, opacity=${opacity}, background=${isLightBackground ? 'light' : 'dark'}`);

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

    // Get raw pixel data to manipulate only the colored pixels
    const { data, info } = await sharp(qrBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Modify alpha channel: reduce opacity only for non-transparent pixels
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      
      // If pixel is not fully transparent (meaning it's part of the QR code)
      if (alpha > 0) {
        // Set alpha to the desired opacity (0-255 range)
        data[i + 3] = Math.round(255 * opacity);
      }
      // Transparent pixels stay transparent (alpha remains 0)
    }
    
    // Create new image with modified alpha channel
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
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

/**
 * Generate multiple QR codes for subtle watermarking
 */
async function generateQRCodePattern(user, vendorInfo, imageSize, isLightBackground = false) {
  const buyerUrl = `https://vixter.com.br/${user.username}`;
  const vendorUrl = `https://vixter.com.br/${vendorInfo?.username || 'vendor'}`;
  
  // Scale QR codes based on image size - 5% of smallest dimension
  // Calculate the size first, then apply min/max constraints
  const smallestDimension = Math.min(imageSize.width, imageSize.height);
  const calculatedSize = Math.floor(smallestDimension * 0.05); // 5% of smallest dimension
  
  // Apply min/max constraints
  const qrSize = Math.max(50, Math.min(calculatedSize, 150));
  
  // Lower opacity for subtle watermarking
  const opacity = 0.15;
  
  console.log(`QR Code size: ${qrSize}px (calculated: ${calculatedSize}px) for image ${imageSize.width}x${imageSize.height}`);
  
  const [buyerQR, vendorQR] = await Promise.all([
    generateQRCode(buyerUrl, qrSize, isLightBackground, opacity),
    generateQRCode(vendorUrl, qrSize, isLightBackground, opacity)
  ]);
  
  return {
    buyerQR,
    vendorQR,
    size: qrSize,
    isLightBackground,
    opacity
  };
}

/**
 * Generate QR code pattern for video watermarking
 */
async function generateVideoQRCodePattern(user, vendorInfo) {
  const buyerUrl = `https://vixter.com.br/${user.username}`;
  const vendorUrl = `https://vixter.com.br/${vendorInfo?.username || 'vendor'}`;
  
  const qrSize = 50;
  const opacity = 0.15;
  
  const [buyerQR, vendorQR] = await Promise.all([
    generateQRCode(buyerUrl, qrSize, false, opacity),
    generateQRCode(vendorUrl, qrSize, false, opacity)
  ]);
  
  return {
    buyerQR,
    vendorQR,
    size: qrSize
  };
}

/**
 * Generate watermarked media
 */
async function generateWatermarkedMedia(contentItem, watermark, username, user, vendorInfo) {
  try {
    const fileName = contentItem.key;
    
    const command = new GetObjectCommand({
      Bucket: PACK_CONTENT_BUCKET_NAME,
      Key: fileName,
    });

    const response = await r2Client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found in R2 storage');
    }

    const chunks = [];
    const stream = response.Body;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const fileBuffer = Buffer.concat(chunks);

    if (contentItem.type.startsWith('video/')) {
      try {
        return await addVideoWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
      } catch (videoError) {
        console.error('Video watermarking failed, returning original video:', videoError);
        // Return original video if watermarking fails
        return fileBuffer;
      }
    } else if (contentItem.type === 'image/webp') {
      const isAnimatedWebP = await checkIfAnimatedWebP(fileBuffer);
      if (isAnimatedWebP) {
        return await addVideoWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
      } else {
        return await addImageWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
      }
    } else if (contentItem.type.startsWith('image/')) {
      return await addImageWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
    } else {
      return fileBuffer;
    }

  } catch (error) {
    console.error('Error generating watermarked media:', error);
    throw error;
  }
}

/**
 * Add subtle watermark to image with grid pattern QR code placement
 */
async function addImageWatermark(imageBuffer, watermark, username, contentItem, user, vendorInfo) {
  try {
    const image = sharp(imageBuffer).ensureAlpha();
    const metadata = await image.metadata();
    
    const brightness = await analyzeImageBrightness(imageBuffer);
    const isLightBackground = brightness > 0.5;
    
    console.log(`Image brightness: ${(brightness * 100).toFixed(1)}% - Using ${isLightBackground ? 'black' : 'white'} QR codes`);
    
    const qrPattern = await generateQRCodePattern(user, vendorInfo, metadata, isLightBackground);
    
    const minDimension = Math.min(metadata.width, metadata.height);
    const fontSize = Math.max(10, minDimension / 40);
    
    const compositeOperations = [];
    
    // Grid pattern QR code placement covering the entire image
    if (qrPattern.buyerQR && qrPattern.vendorQR) {
      const qrSize = qrPattern.size;
      
      // Spacing between QR codes - wider spacing for subtle coverage
      const spacing = Math.max(qrSize * 3.5, 180); // Increased spacing for less density
      
      // Calculate grid
      const cols = Math.ceil(metadata.width / spacing);
      const rows = Math.ceil(metadata.height / spacing);
      
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * spacing + (spacing - qrSize) / 2;
          const y = row * spacing + (spacing - qrSize) / 2;
          
          // Skip if QR code would go outside image bounds
          if (x + qrSize > metadata.width || y + qrSize > metadata.height) continue;
          
          // Alternate between buyer and vendor QR codes
          const useBuyerQR = (row + col) % 2 === 0;
          const qrBuffer = useBuyerQR ? qrPattern.buyerQR : qrPattern.vendorQR;
          
          compositeOperations.push({
            input: qrBuffer,
            top: Math.round(y),
            left: Math.round(x),
            blend: 'over'
          });
        }
      }
      
      console.log(`Placed QR codes in ${rows}x${cols} grid (${rows * cols} total) across ${metadata.width}x${metadata.height} image`);
    }
    
    // Very subtle text watermark
    const watermarkSvg = `
      <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="30" font-family="Arial" font-size="${fontSize}" 
              fill="rgba(255,255,255,0.15)" stroke="rgba(0,0,0,0.3)" stroke-width="0.5">
          vixter.com.br/${user.username}
        </text>
        <text x="20" y="${30 + fontSize + 5}" font-family="Arial" font-size="${fontSize}" 
              fill="rgba(255,255,255,0.15)" stroke="rgba(0,0,0,0.3)" stroke-width="0.5">
          vixter.com.br/${vendorInfo?.username || 'vendor'}
        </text>
      </svg>
    `;

    compositeOperations.push({
      input: Buffer.from(watermarkSvg),
      top: 0,
      left: 0,
      blend: 'over'
    });

    const watermarkedImage = await image
      .composite(compositeOperations)
      .jpeg({ quality: 95, progressive: true })
      .toBuffer();

    return watermarkedImage;

  } catch (error) {
    console.error('Error adding watermark to image:', error);
    return imageBuffer;
  }
}

/**
 * Test QR code overlay functionality
 */
async function testQRCodeOverlay(qrPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    const tempDir = os.tmpdir();
    const testOutputPath = path.join(tempDir, `qr_test_${Date.now()}.mp4`);
    
    const testFilters = [
      `movie=${qrPath}[qr]`,
      `[0:v][qr]overlay=20:20[final]`
    ];
    
    ffmpeg()
      .input('testsrc=duration=2:size=320x240:rate=1')
      .videoFilters(testFilters.join(','))
      .outputOptions(['-f', 'mp4', '-t', '2'])
      .on('end', () => {
        console.log('QR code overlay test completed successfully');
        try {
          if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
          }
        } catch (cleanupError) {
          console.warn('Could not clean up QR test file:', cleanupError);
        }
        resolve(true);
      })
      .on('error', (error) => {
        console.error('QR code overlay test failed:', error);
        try {
          if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
          }
        } catch (cleanupError) {
          console.warn('Could not clean up QR test file:', cleanupError);
        }
        reject(error);
      })
      .save(testOutputPath);
  });
}

/**
 * Test if ffmpeg is working correctly
 */
async function testFFmpeg() {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    const tempDir = os.tmpdir();
    const testOutputPath = path.join(tempDir, `ffmpeg_test_${Date.now()}.mp4`);
    
    ffmpeg()
      .input('testsrc=duration=1:size=320x240:rate=1')
      .outputOptions(['-f', 'mp4', '-t', '1'])
      .on('end', () => {
        console.log('FFmpeg test completed successfully');
        // Clean up test file
        try {
          if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
          }
        } catch (cleanupError) {
          console.warn('Could not clean up test file:', cleanupError);
        }
        resolve(true);
      })
      .on('error', (error) => {
        console.error('FFmpeg test failed:', error);
        // Clean up test file
        try {
          if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
          }
        } catch (cleanupError) {
          console.warn('Could not clean up test file:', cleanupError);
        }
        reject(error);
      })
      .save(testOutputPath);
  });
}

/**
 * Add subtle watermark to video
 */
async function addVideoWatermark(videoBuffer, watermark, username, contentItem, user, vendorInfo) {
  return new Promise(async (resolve, reject) => {
    let ffmpegProcess = null;
    let timeoutId = null;
    let inputPath = null;
    let outputPath = null;
    let buyerQRPath = null;
    let vendorQRPath = null;
    
    const cleanup = () => {
      try {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        if (buyerQRPath && fs.existsSync(buyerQRPath)) fs.unlinkSync(buyerQRPath);
        if (vendorQRPath && fs.existsSync(vendorQRPath)) fs.unlinkSync(vendorQRPath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp files:', cleanupError);
      }
    };
    
    try {
      // Test ffmpeg availability first
      try {
        await testFFmpeg();
        console.log('FFmpeg test passed, proceeding with video watermarking');
      } catch (ffmpegTestError) {
        console.error('FFmpeg test failed, returning original video:', ffmpegTestError);
        resolve(videoBuffer);
        return;
      }
      const maxSize = 150 * 1024 * 1024;
      if (videoBuffer.length > maxSize) {
        console.warn('Video too large for watermarking, returning original');
        resolve(videoBuffer);
        return;
      }
      
      // Validate video buffer
      if (!videoBuffer || videoBuffer.length === 0) {
        console.error('Invalid video buffer provided');
        reject(new Error('Invalid video buffer'));
        return;
      }
      
      const qrPattern = await generateVideoQRCodePattern(user, vendorInfo);
      
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      inputPath = path.join(tempDir, `input_${timestamp}.${getFileExtension(contentItem.type)}`);
      outputPath = path.join(tempDir, `output_${timestamp}.mp4`);
      
      console.log(`Writing input video to: ${inputPath} (${videoBuffer.length} bytes)`);
      fs.writeFileSync(inputPath, videoBuffer);
      
      // Verify input file was written correctly
      if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
        console.error('Failed to write input video file');
        cleanup();
        reject(new Error('Failed to write input video file'));
        return;
      }
      
      if (qrPattern.buyerQR) {
        buyerQRPath = path.join(tempDir, `buyer_qr_${timestamp}.png`);
        fs.writeFileSync(buyerQRPath, qrPattern.buyerQR);
        console.log(`Buyer QR code written to: ${buyerQRPath}`);
      }
      if (qrPattern.vendorQR) {
        vendorQRPath = path.join(tempDir, `vendor_qr_${timestamp}.png`);
        fs.writeFileSync(vendorQRPath, qrPattern.vendorQR);
        console.log(`Vendor QR code written to: ${vendorQRPath}`);
      }
      
      const buyerText = escapeFFmpegText(`vixter.com.br/${user.username}`);
      const vendorText = escapeFFmpegText(`vixter.com.br/${vendorInfo?.username || 'vendor'}`);
      
      timeoutId = setTimeout(() => {
        console.error('Video processing timeout - killing ffmpeg process');
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGKILL');
        }
        cleanup();
        reject(new Error('Video processing timeout'));
      }, 240000);
      
      // Build video filters with QR codes and text
      const videoFilters = [];
      
      // Try QR code approach first, fallback to text only
      if (buyerQRPath && vendorQRPath && fs.existsSync(buyerQRPath) && fs.existsSync(vendorQRPath)) {
        console.log('Attempting QR code watermarking...');
        
        try {
          // Verify QR files are valid
          const buyerQRStats = fs.statSync(buyerQRPath);
          const vendorQRStats = fs.statSync(vendorQRPath);
          
          if (buyerQRStats.size > 0 && vendorQRStats.size > 0) {
            const qrSize = qrPattern.size;
            const margin = 20;
            
            // Test QR code overlay functionality first
            try {
              await testQRCodeOverlay(buyerQRPath);
              console.log('QR code overlay test passed');
              
              // Alternative approach: use image2 demuxer for static QR code
              const staticFilters = [
                `movie=${buyerQRPath}[buyer_qr]`,
                `[0:v][buyer_qr]overlay=${margin}:${margin}[qr1]`,
                `[qr1]drawtext=text='${buyerText}':fontsize=12:fontcolor=white@0.3:x=20:y=h-th-40[final]`
              ];
              
              videoFilters.push(staticFilters.join(','));
              console.log('QR code filters applied');
            } catch (qrTestError) {
              console.warn('QR code overlay test failed, using text only:', qrTestError);
              throw new Error('QR code overlay test failed');
            }
          } else {
            throw new Error('QR code files are empty');
          }
        } catch (qrError) {
          console.warn('QR code watermarking failed, falling back to text only:', qrError);
          // Fallback to text only
          const textFilters = [
            `drawtext=text='${buyerText}':fontsize=12:fontcolor=white@0.3:x=20:y=20`,
            `drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=35`
          ];
          videoFilters.push(textFilters.join(','));
        }
      } else {
        console.log('QR code files not available, using text watermarks only');
        // Fallback to text only
        const textFilters = [
          `drawtext=text='${buyerText}':fontsize=12:fontcolor=white@0.3:x=20:y=20`,
          `drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=35`
        ];
        videoFilters.push(textFilters.join(','));
      }
      
      console.log('FFmpeg video filters:', videoFilters);
      
      ffmpegProcess = ffmpeg(inputPath)
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
          console.log('FFmpeg process started with command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('Video processing: ' + Math.round(progress.percent) + '% done');
          }
        })
        .on('stderr', (stderrLine) => {
          console.log('FFmpeg stderr:', stderrLine);
        })
        .on('end', () => {
          try {
            clearTimeout(timeoutId);
            
            // Verify output file exists and has content
            if (!fs.existsSync(outputPath)) {
              console.error('Output file was not created');
              cleanup();
              reject(new Error('Output file was not created'));
              return;
            }
            
            const outputStats = fs.statSync(outputPath);
            if (outputStats.size === 0) {
              console.error('Output file is empty');
              cleanup();
              reject(new Error('Output file is empty'));
              return;
            }
            
            const watermarkedBuffer = fs.readFileSync(outputPath);
            cleanup();
            console.log(`Video watermarking completed successfully. Output size: ${watermarkedBuffer.length} bytes`);
            resolve(watermarkedBuffer);
          } catch (error) {
            console.error('Error reading watermarked video:', error);
            cleanup();
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('FFmpeg error details:', {
            message: error.message,
            code: error.code,
            signal: error.signal,
            killed: error.killed,
            cmd: error.cmd
          });
          clearTimeout(timeoutId);
          cleanup();
          reject(error);
        })
        .save(outputPath);
        
    } catch (error) {
      console.error('Error setting up video watermarking:', error);
      if (timeoutId) clearTimeout(timeoutId);
      cleanup();
      reject(error);
    }
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

/**
 * Check if WebP file is animated
 */
async function checkIfAnimatedWebP(buffer) {
  try {
    const bufferString = buffer.toString('binary');
    return bufferString.includes('ANIM');
  } catch (error) {
    console.warn('Error checking WebP animation:', error);
    return false;
  }
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType) {
  const extensions = {
    'video/mp4': 'mp4',
    'video/avi': 'avi',
    'video/mov': 'mov',
    'video/wmv': 'wmv',
    'video/flv': 'flv',
    'video/webm': 'webm',
    'video/mkv': 'mkv',
    'video/m4v': 'm4v',
    'image/webp': 'webp'
  };
  
  return extensions[mimeType] || 'mp4';
}