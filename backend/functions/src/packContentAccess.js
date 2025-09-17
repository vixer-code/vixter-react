const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
const corsHandler = cors({ origin: true });

/**
 * Cloud Function to serve pack content with watermark and access control
 * Handles secure access to pack media with user-specific watermarks
 */
exports.packContentAccess = onRequest({
  region: 'us-east1',
  cors: true
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Extract parameters from query string
      const {
        packId,
        contentKey,
        watermark,
        username,
        orderId,
        token
      } = req.query;

      // Validate required parameters
      if (!packId || !contentKey || !username) {
        return res.status(400).json({
          error: 'Missing required parameters: packId, contentKey, username'
        });
      }

      // Verify user authentication and authorization
      const user = await verifyUserAccess(token, packId, orderId, username);
      if (!user) {
        return res.status(403).json({
          error: 'Access denied: Invalid authentication or authorization'
        });
      }

      // Get pack content metadata
      const packContent = await getPackContentMetadata(packId, contentKey);
      if (!packContent) {
        return res.status(404).json({
          error: 'Content not found'
        });
      }

      // Get vendor information for watermark
      const vendorInfo = await getVendorInfo(packContent.packId);
      
      // Generate watermarked media with profile links
      const watermarkedBuffer = await generateWatermarkedMedia(
        packContent,
        watermark,
        username,
        user,
        vendorInfo
      );

      // Set security headers to prevent downloads and caching
      res.set({
        'Content-Type': packContent.type,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Disposition': 'inline', // Force inline viewing
        'X-Watermark': watermark || 'protected',
        'X-Username': username
      });

      // Send the watermarked media
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
 * Verify user access to pack content
 */
async function verifyUserAccess(token, packId, orderId, username) {
  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user has a valid pack order for this pack
    const packOrderQuery = db.collection('packOrders')
      .where('buyerId', '==', userId)
      .where('packId', '==', packId);

    const packOrders = await packOrderQuery.get();

    console.log('Pack orders found:', packOrders.size);
    packOrders.forEach(doc => {
      console.log('Order:', doc.id, 'Status:', doc.data().status);
    });

    if (packOrders.empty) {
      console.log('No pack order found for user:', userId, 'pack:', packId);
      return null;
    }

    // Check if any order has valid status
    const validOrders = packOrders.docs.filter(doc => {
      const status = doc.data().status;
      return ['COMPLETED', 'CONFIRMED', 'AUTO_RELEASED', 'APPROVED'].includes(status);
    });

    if (validOrders.length === 0) {
      console.log('No valid pack order status found. Available statuses:', 
        packOrders.docs.map(doc => doc.data().status));
      return null;
    }

    // Verify the order is valid and not expired
    const packOrder = validOrders[0].data();
    const orderTimestamp = packOrder.timestamps?.createdAt;
    
    if (orderTimestamp) {
      const orderDate = orderTimestamp.toDate();
      const now = new Date();
      const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);
      
      // Optional: Add expiration logic (e.g., 30 days)
      // if (daysDiff > 30) {
      //   console.log('Pack order expired:', daysDiff, 'days old');
      //   return null;
      // }
    }

    return {
      userId,
      username: decodedToken.email?.split('@')[0] || username,
      packOrder: packOrders.docs[0].id
    };

  } catch (error) {
    console.error('Error verifying user access:', error);
    return null;
  }
}

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
 * Get vendor information for watermark
 */
async function getVendorInfo(packId) {
  try {
    const packDoc = await db.collection('packs').doc(packId).get();
    
    if (!packDoc.exists) {
      return null;
    }

    const packData = packDoc.data();
    const vendorId = packData.vendorId;
    
    if (!vendorId) {
      return null;
    }

    // Get vendor profile information
    const vendorDoc = await db.collection('users').doc(vendorId).get();
    
    if (!vendorDoc.exists) {
      return null;
    }

    const vendorData = vendorDoc.data();
    
    return {
      username: vendorData.username || vendorData.displayName || 'vendor',
      profileUrl: `vixter.com.br/profile/${vendorData.username || vendorId}`
    };

  } catch (error) {
    console.error('Error getting vendor info:', error);
    return null;
  }
}

/**
 * Generate watermarked media
 */
async function generateWatermarkedMedia(contentItem, watermark, username, user, vendorInfo) {
  try {
    // Download the original media from R2
    const fileName = contentItem.key;
    
    const command = new GetObjectCommand({
      Bucket: PACK_CONTENT_BUCKET_NAME,
      Key: fileName,
    });

    // Get file from R2
    const response = await r2Client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found in R2 storage');
    }

    // Convert stream to buffer
    const chunks = [];
    const stream = response.Body;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const fileBuffer = Buffer.concat(chunks);

    // Check file type and apply appropriate watermark
    if (contentItem.type.startsWith('image/')) {
      return await addImageWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
    } else if (contentItem.type.startsWith('video/')) {
      return await addVideoWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
    } else {
      // For other file types, return original with security headers
      return fileBuffer;
    }

  } catch (error) {
    console.error('Error generating watermarked media:', error);
    throw error;
  }
}

/**
 * Add watermark to image using Sharp
 */
async function addImageWatermark(imageBuffer, watermark, username, contentItem, user, vendorInfo) {
  try {
    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Calculate watermark size based on image dimensions
    const minDimension = Math.min(metadata.width, metadata.height);
    const watermarkSize = Math.max(24, minDimension / 25);
    const fontSize = Math.max(14, watermarkSize * 0.8);
    
    // Create watermark text with profile links
    const buyerProfileUrl = `vixter.com.br/profile/${user.username}`;
    const vendorProfileUrl = vendorInfo?.profileUrl || 'vixter.com.br';
    const watermarkText = `${watermark || username} - vixter.com.br`;
    
    // Create a more sophisticated watermark with multiple positions and profile links
    const watermarkSvg = `
      <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="watermark" patternUnits="userSpaceOnUse" width="${watermarkSize * 6}" height="${watermarkSize * 6}">
            <text x="${watermarkSize * 3}" y="${watermarkSize * 3}" 
                  font-family="Arial, sans-serif" 
                  font-size="${fontSize}" 
                  font-weight="bold"
                  fill="rgba(255,255,255,0.4)" 
                  stroke="rgba(0,0,0,0.6)"
                  stroke-width="1"
                  text-anchor="middle" 
                  dominant-baseline="central"
                  transform="rotate(-45 ${watermarkSize * 3} ${watermarkSize * 3})">
              ${watermarkText}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark)"/>
        
        <!-- Additional corner watermarks for extra security with profile links -->
        <text x="20" y="30" 
              font-family="Arial, sans-serif" 
              font-size="${Math.max(10, fontSize * 0.6)}" 
              font-weight="bold"
              fill="rgba(255,255,255,0.3)" 
              stroke="rgba(0,0,0,0.5)"
              stroke-width="0.5">Comprador: ${buyerProfileUrl}</text>
              
        <text x="20" y="50" 
              font-family="Arial, sans-serif" 
              font-size="${Math.max(10, fontSize * 0.6)}" 
              font-weight="bold"
              fill="rgba(255,255,255,0.3)" 
              stroke="rgba(0,0,0,0.5)"
              stroke-width="0.5">Vendedora: ${vendorProfileUrl}</text>
              
        <text x="${metadata.width - 20}" y="${metadata.height - 10}" 
              font-family="Arial, sans-serif" 
              font-size="${Math.max(10, fontSize * 0.6)}" 
              font-weight="bold"
              fill="rgba(255,255,255,0.3)" 
              stroke="rgba(0,0,0,0.5)"
              stroke-width="0.5"
              text-anchor="end">vixter.com.br</text>
      </svg>
    `;

    // Apply watermark with better blending
    const watermarkedImage = await image
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          blend: 'overlay'
        }
      ])
      .jpeg({ quality: 85, progressive: true }) // Use JPEG for better compression
      .toBuffer();

    return watermarkedImage;

  } catch (error) {
    console.error('Error adding watermark to image:', error);
    // Return original image if watermarking fails
    return imageBuffer;
  }
}

/**
 * Add watermark to video using FFmpeg
 */
async function addVideoWatermark(videoBuffer, watermark, username, contentItem, user, vendorInfo) {
  return new Promise((resolve, reject) => {
    let ffmpegProcess = null;
    let timeoutId = null;
    
    try {
      // Check video size - if too large, return original with warning
      const maxSize = 100 * 1024 * 1024; // 100MB limit
      if (videoBuffer.length > maxSize) {
        console.warn('Video too large for watermarking, returning original');
        resolve(videoBuffer);
        return;
      }
      
      // Create temporary files for processing
      const tempDir = os.tmpdir();
      const inputPath = path.join(tempDir, `input_${Date.now()}.${getFileExtension(contentItem.type)}`);
      const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);
      
      // Write input buffer to temporary file
      fs.writeFileSync(inputPath, videoBuffer);
      
      // Create watermark text with profile links (escape special characters)
      const buyerProfileUrl = `vixter.com.br/profile/${user.username}`;
      const vendorProfileUrl = vendorInfo?.profileUrl || 'vixter.com.br';
      const watermarkText = escapeFFmpegText(`${watermark || username} - vixter.com.br`);
      const buyerText = escapeFFmpegText(`Comprador: ${buyerProfileUrl}`);
      const vendorText = escapeFFmpegText(`Vendedora: ${vendorProfileUrl}`);
      
      // Set timeout for video processing (5 minutes max)
      timeoutId = setTimeout(() => {
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGKILL');
        }
        cleanup();
        reject(new Error('Video processing timeout'));
      }, 300000); // 5 minutes
      
      // FFmpeg command to add watermark
      ffmpegProcess = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset ultrafast', // Fastest encoding for Cloud Functions
          '-crf 28', // Higher compression for faster processing
          '-movflags +faststart', // Optimize for streaming
          '-pix_fmt yuv420p', // Ensure compatibility
          '-tune zerolatency', // Optimize for low latency
          '-maxrate 2M', // Limit bitrate
          '-bufsize 4M' // Buffer size
        ])
        .complexFilter([
          // Main watermark with rotation
          `drawtext=text='${watermarkText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=20:fontcolor=white@0.5:x=(w-text_w)/2:y=(h-text_h)/2`,
          // Profile watermarks
          `drawtext=text='${buyerText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=12:fontcolor=white@0.4:x=15:y=25`,
          `drawtext=text='${vendorText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=12:fontcolor=white@0.4:x=15:y=45`,
          `drawtext=text='vixter.com.br':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=14:fontcolor=white@0.4:x=w-text_w-15:y=h-15`
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg process started:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('Video processing: ' + Math.round(progress.percent) + '% done');
          }
        })
        .on('end', () => {
          try {
            clearTimeout(timeoutId);
            
            // Read the watermarked video
            const watermarkedBuffer = fs.readFileSync(outputPath);
            
            cleanup();
            
            console.log('Video watermarking completed successfully');
            resolve(watermarkedBuffer);
          } catch (error) {
            console.error('Error reading watermarked video:', error);
            cleanup();
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('FFmpeg error:', error);
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
    
    function cleanup() {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp files:', cleanupError);
      }
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
    'video/m4v': 'm4v'
  };
  
  return extensions[mimeType] || 'mp4';
}
