const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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
      
      // For videos: generate signed URL and return in JSON (no watermarking/processing)
      // Videos are already processed with QR codes by packContentVideoReprocessor
      if (packContent.type && packContent.type.startsWith('video/')) {
        console.log(`Generating signed URL for video: ${packContent.name}`);
        
        const command = new GetObjectCommand({
          Bucket: PACK_CONTENT_BUCKET_NAME,
          Key: packContent.key,
        });
        
        // Generate signed URL valid for 2 hours (long enough for video playback)
        const signedUrl = await getSignedUrl(r2Client, command, { 
          expiresIn: 7200 // 2 hours
        });
        
        console.log(`✅ Signed URL generated for video, valid for 2 hours`);
        console.log(`   Video: ${packContent.name}`);
        console.log(`   Size: ${packContent.size} bytes`);
        console.log(`   User: ${username}`);
        
        // Return signed URL in JSON instead of redirecting
        // This allows CORS to work properly
        return res.status(200).json({
          success: true,
          signedUrl: signedUrl,
          type: 'video',
          name: packContent.name,
          size: packContent.size,
          watermark: username
        });
      }
      
      // For images: continue with watermarking
      console.log(`Processing image with watermark: ${packContent.name}`);
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
 * Generate QR code pattern for video watermarking with full grid coverage
 */
async function generateVideoQRCodePattern(user, vendorInfo, videoWidth = 1920, videoHeight = 1080) {
  const buyerUrl = `https://vixter.com.br/${user.username}`;
  const vendorUrl = `https://vixter.com.br/${vendorInfo?.username || 'vendor'}`;
  
  // Calculate QR code size based on video dimensions - 20% of smallest dimension (200% larger than images)
  const smallestDimension = Math.min(videoWidth, videoHeight);
  const calculatedSize = Math.floor(smallestDimension * 0.20);
  
  // Apply min/max constraints for QR codes (4x larger than images)
  const qrSize = Math.max(200, Math.min(calculatedSize, 600));
  
  // Lower opacity for subtle watermarking (same as images)
  const opacity = 0.15;
  
  console.log(`Video QR Code size: ${qrSize}px (calculated: ${calculatedSize}px) for video ${videoWidth}x${videoHeight}`);
  
  const [buyerQR, vendorQR] = await Promise.all([
    generateQRCode(buyerUrl, qrSize, false, opacity),
    generateQRCode(vendorUrl, qrSize, false, opacity)
  ]);
  
  return {
    buyerQR,
    vendorQR,
    size: qrSize,
    videoWidth,
    videoHeight
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
    
    // Check if stream is null or undefined
    if (!stream) {
      throw new Error('Stream is null or undefined');
    }
    
    // More robust stream validation
    try {
      // Check if stream has the expected properties
      if (typeof stream === 'object' && stream !== null) {
        // Check if it's a readable stream
        if (typeof stream.readable === 'boolean' && !stream.readable) {
          throw new Error('Stream is not readable');
        }
        
        // Check if it's iterable (for await...of)
        if (typeof stream[Symbol.asyncIterator] !== 'function') {
          console.warn('Stream is not async iterable, trying alternative method');
          // Try to convert to buffer directly if it's a Uint8Array or similar
          if (stream instanceof Uint8Array) {
            const fileBuffer = Buffer.from(stream);
            return fileBuffer;
          }
          throw new Error('Stream is not async iterable');
        }
      }
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    } catch (streamError) {
      console.error('Error processing stream:', streamError);
      throw new Error(`Stream processing failed: ${streamError.message}`);
    }
    
    const fileBuffer = Buffer.concat(chunks);

    if (contentItem.type.startsWith('video/')) {
      // NOTE: This code path should never be reached for videos
      // Videos now use signed URLs (see above in packContentAccess function)
      // This is kept as fallback only
      console.warn(`WARNING: Video reached generateWatermarkedMedia - should use signed URL instead`);
      console.log(`Serving pre-processed video: ${contentItem.name}`);
      console.log(`Video buffer size: ${fileBuffer.length} bytes`);
      return fileBuffer;
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
    
    // Try the modern approach first: use .input() + complexFilter
    ffmpeg()
      .input('color=c=black:s=320x240:d=2')
      .inputFormat('lavfi')
      .input(qrPath)
      .complexFilter('[0:v][1:v]overlay=20:20')
      .outputOptions(['-f', 'mp4', '-t', '2'])
      .on('end', () => {
        console.log('QR code overlay test completed successfully (modern approach)');
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
        console.log('Modern QR overlay approach failed, trying legacy movie filter...');
        
        // Fallback to legacy movie filter approach
        const testFilters = [
          `movie=${qrPath}[qr]`,
          `[0:v][qr]overlay=20:20[final]`
        ];
        
        ffmpeg()
          .input('color=c=black:s=320x240:d=2')
          .inputFormat('lavfi')
          .videoFilters(testFilters.join(','))
          .outputOptions(['-f', 'mp4', '-t', '2'])
          .on('end', () => {
            console.log('QR code overlay test completed successfully (legacy approach)');
            try {
              if (fs.existsSync(testOutputPath)) {
                fs.unlinkSync(testOutputPath);
              }
            } catch (cleanupError) {
              console.warn('Could not clean up QR test file:', cleanupError);
            }
            resolve(true);
          })
          .on('error', (legacyError) => {
            console.error('Both QR overlay approaches failed:', { modern: error.message, legacy: legacyError.message });
            try {
              if (fs.existsSync(testOutputPath)) {
                fs.unlinkSync(testOutputPath);
              }
            } catch (cleanupError) {
              console.warn('Could not clean up QR test file:', cleanupError);
            }
            resolve(false); // Don't reject, just return false to indicate QR overlay not available
          })
          .save(testOutputPath);
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
    
    // Simple test that just checks if ffmpeg can be executed
    // without creating actual files or using complex filters
    ffmpeg()
      .input('color=c=black:s=320x240:d=1')
      .inputFormat('lavfi')  // 👈 diz que é "lavfi input"
      .outputOptions(['-f', 'null'])
      .on('end', () => {
        console.log('FFmpeg test completed successfully');
        resolve(true);
      })
      .on('error', (error) => {
        console.error('FFmpeg test failed:', error);
        // Don't reject, just log the error and continue
        // This allows the function to fallback gracefully
        console.log('FFmpeg not available, will skip video watermarking');
        resolve(false);
      })
      .on('stderr', (stderrLine) => {
        // Suppress stderr output for cleaner logs
        // FFmpeg often outputs warnings that aren't errors
      })
      .save('/dev/null'); // Use /dev/null to avoid file system issues
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
        
        // Clean up all QR grid files
        const tempDir = os.tmpdir();
        const qrFiles = fs.readdirSync(tempDir).filter(file => file.startsWith('qr_') && file.endsWith('.png'));
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
      // Test ffmpeg availability first
      const ffmpegAvailable = await testFFmpeg();
      if (!ffmpegAvailable) {
        console.log('FFmpeg not available, returning original video without watermark');
        resolve(videoBuffer);
        return;
      }
      console.log('FFmpeg test passed, proceeding with video watermarking');
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
      
      // Get video dimensions after writing the file
      const videoDimensions = await getVideoDimensions(inputPath);
      const qrPattern = await generateVideoQRCodePattern(user, vendorInfo, videoDimensions.width, videoDimensions.height);
      
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
      
      // Try QR code grid approach first, fallback to text only
      if (qrPattern.buyerQR && qrPattern.vendorQR) {
        console.log('Attempting QR code grid watermarking...');
        
        try {
          // Generate QR code grid for full video coverage
          const qrOverlays = await generateVideoQRGrid(qrPattern, videoDimensions.width, videoDimensions.height);
          
          if (qrOverlays.length > 0) {
            console.log(`Generated ${qrOverlays.length} QR code overlays for grid coverage`);
            
            // Build complex filter chain for multiple QR overlays
            const filterChain = [];
            let currentInput = '[0:v]';
            
            // Add each QR code overlay
            qrOverlays.forEach((overlay, index) => {
              const nextInput = index === qrOverlays.length - 1 ? '[final]' : `[qr${index}]`;
              filterChain.push(`movie=${overlay.path}[qr${index}_img]`);
              filterChain.push(`${currentInput}[qr${index}_img]overlay=${overlay.x}:${overlay.y}${nextInput}`);
              currentInput = nextInput;
            });
            
            // Add text watermarks at the end
            filterChain.push(`[final]drawtext=text='${buyerText}':fontsize=12:fontcolor=white@0.3:x=20:y=20[text1]`);
            filterChain.push(`[text1]drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=35[final_text]`);
            
            videoFilters.push(filterChain.join(','));
            console.log('QR code grid filters applied');
            
            // Store QR paths for cleanup
            qrOverlays.forEach(overlay => {
              if (overlay.path && fs.existsSync(overlay.path)) {
                // Add to cleanup list
                if (!buyerQRPath) buyerQRPath = overlay.path;
                if (!vendorQRPath && overlay.path !== buyerQRPath) vendorQRPath = overlay.path;
              }
            });
            
          } else {
            throw new Error('No QR overlays generated');
          }
        } catch (qrError) {
          console.warn('QR code grid watermarking failed, falling back to text only:', qrError);
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
 * Get video dimensions using ffprobe
 */
async function getVideoDimensions(videoPath) {
  return new Promise((resolve, reject) => {
    // Check if file exists first
    if (!fs.existsSync(videoPath)) {
      console.warn('Video file does not exist:', videoPath);
      resolve({ width: 1920, height: 1080 });
      return;
    }
    
    // Check file size
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
        console.log(`Video dimensions: ${videoStream.width}x${videoStream.height}`);
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
 * Generate multiple QR code overlays for full video coverage
 */
async function generateVideoQRGrid(qrPattern, videoWidth, videoHeight) {
  const qrSize = qrPattern.size;
  const spacing = Math.max(qrSize * 2, 100); // Reduced spacing for tighter grid
  
  // Calculate grid dimensions
  const cols = Math.ceil(videoWidth / spacing);
  const rows = Math.ceil(videoHeight / spacing);
  
  console.log(`Generating QR grid: ${rows}x${cols} (${rows * cols} total QR codes) for video ${videoWidth}x${videoHeight}`);
  
  const qrOverlays = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * spacing + (spacing - qrSize) / 2;
      const y = row * spacing + (spacing - qrSize) / 2;
      
      // Skip if QR code would go outside video bounds
      if (x + qrSize > videoWidth || y + qrSize > videoHeight) continue;
      
      // Alternate between buyer and vendor QR codes
      const useBuyerQR = (row + col) % 2 === 0;
      const qrBuffer = useBuyerQR ? qrPattern.buyerQR : qrPattern.vendorQR;
      
      if (qrBuffer) {
        const qrPath = path.join(os.tmpdir(), `qr_${row}_${col}_${Date.now()}.png`);
        fs.writeFileSync(qrPath, qrBuffer);
        
        qrOverlays.push({
          path: qrPath,
          x: Math.round(x),
          y: Math.round(y),
          isBuyer: useBuyerQR
        });
      }
    }
  }
  
  return qrOverlays;
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