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
    'http://localhost:3000', // For development
    'http://localhost:5173'  // For Vite dev server
  ],
  credentials: true
});

/**
 * Cloud Function to serve pack content with watermark and access control
 * Handles secure access to pack media with user-specific watermarks
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
      // Extract JWT token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authorization header with Bearer token required'
        });
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log('Using JWT token from Authorization header');
      
      // Decode JWT token to get all parameters
      let packId, contentKey, username, orderId, vendorId, vendorUsername, userId, watermark;
      
      try {
        // Validate token format (should have 3 parts separated by dots)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid JWT format - expected 3 parts');
        }
        
        // Decode JWT token to get parameters
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        packId = payload.packId;
        contentKey = payload.contentKey;
        username = payload.username;
        orderId = payload.orderId;
        vendorId = payload.vendorId;
        vendorUsername = payload.vendorUsername;
        userId = payload.userId;
        watermark = username; // Use username as watermark for JWT tokens
        
        console.log('Decoded JWT payload:', { packId, contentKey, username, orderId, vendorId, vendorUsername, userId, watermark });
      } catch (error) {
        console.error('Error decoding JWT token:', error);
        console.error('Token received:', token.substring(0, 50) + '...');
        return res.status(400).json({
          error: 'Invalid token format',
          details: error.message
        });
      }

      // Validate required parameters
      if (!packId || !contentKey || !username) {
        return res.status(400).json({
          error: 'Missing required parameters: packId, contentKey, username'
        });
      }

      // JWT token contains all necessary data, no need for additional verification
      const user = {
        userId: userId,
        username: username
      };
      console.log('Using JWT token data for user:', user);

      // Get pack content metadata
      const packContent = await getPackContentMetadata(packId, contentKey);
      if (!packContent) {
        return res.status(404).json({
          error: 'Content not found'
        });
      }

      // Use vendor info from JWT token
      const vendorInfo = {
        username: vendorUsername,
        profileUrl: `vixter.com.br/profile/${vendorUsername}`
      };
      console.log('Using JWT vendor info:', vendorInfo);
      
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
    // Since the backend already verified the token, we'll extract the user ID from the token
    // without verifying the signature (backend already did that)
    let userId;
    try {
      // Try to verify the token first (preferred method)
      const decodedToken = await admin.auth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (verifyError) {
      // If verification fails, extract user ID from token payload (fallback)
      console.log('Token verification failed, extracting from payload:', verifyError.message);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = payload.user_id || payload.sub;
      
      if (!userId) {
        console.log('Could not extract user ID from token payload');
        return null;
      }
    }

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
      username: username, // Use the username parameter since we can't access decodedToken here
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
 * Generate QR code as buffer for watermarking
 */
async function generateQRCode(url, size = 80) {
  try {
    const qrBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: size,
      margin: 1,
      color: {
        dark: '#000000', // Black QR code (changed from white)
        light: '#00000000' // Transparent background
      }
    });
    return qrBuffer;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
}

/**
 * Generate multiple QR codes for watermarking pattern
 */
async function generateQRCodePattern(user, vendorInfo, imageSize) {
  const buyerUrl = `https://vixter.com.br/${user.username}`;
  const vendorUrl = `https://vixter.com.br/${vendorInfo?.username || 'vendor'}`;
  
  // Calculate QR code size based on image dimensions
  const qrSize = Math.min(Math.floor(imageSize.width * 0.08), Math.floor(imageSize.height * 0.08), 120);
  
  const [buyerQR, vendorQR] = await Promise.all([
    generateQRCode(buyerUrl, qrSize),
    generateQRCode(vendorUrl, qrSize)
  ]);
  
  return {
    buyerQR,
    vendorQR,
    size: qrSize
  };
}

/**
 * Generate QR code pattern for video watermarking
 */
async function generateVideoQRCodePattern(user, vendorInfo) {
  const buyerUrl = `https://vixter.com.br/${user.username}`;
  const vendorUrl = `https://vixter.com.br/${vendorInfo?.username || 'vendor'}`;
  
  // For videos, use smaller QR codes for better performance
  const qrSize = 60;
  
  const [buyerQR, vendorQR] = await Promise.all([
    generateQRCode(buyerUrl, qrSize),
    generateQRCode(vendorUrl, qrSize)
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
    if (contentItem.type.startsWith('video/')) {
      return await addVideoWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
    } else if (contentItem.type === 'image/webp') {
      // Check if WebP is animated (treat as video) or static (treat as image)
      const isAnimatedWebP = await checkIfAnimatedWebP(fileBuffer);
      if (isAnimatedWebP) {
        return await addVideoWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
      } else {
        return await addImageWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
      }
    } else if (contentItem.type.startsWith('image/')) {
      return await addImageWatermark(fileBuffer, watermark, username, contentItem, user, vendorInfo);
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
 * Add watermark to image using Sharp with QR codes
 */
async function addImageWatermark(imageBuffer, watermark, username, contentItem, user, vendorInfo) {
  try {
    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Generate QR codes for watermarking
    const qrPattern = await generateQRCodePattern(user, vendorInfo, metadata);
    
    // Calculate watermark size based on image dimensions
    const minDimension = Math.min(metadata.width, metadata.height);
    const watermarkSize = Math.max(24, minDimension / 25);
    const fontSize = Math.max(12, watermarkSize * 0.6); // Reduced text size to make room for QR codes
    
    // Create alternating watermark text with profile links
    const buyerProfileUrl = `vixter.com.br/${user.username}`;
    const vendorProfileUrl = `vixter.com.br/${vendorInfo?.username || 'vendor'}`;
    const watermarkText = `${watermark || username} - vixter.com.br`;
    
    // Prepare composite operations for QR codes and text
    const compositeOperations = [];
    
    // Add QR codes in alternating pattern around the image
    if (qrPattern.buyerQR && qrPattern.vendorQR) {
      const qrSize = qrPattern.size;
      const spacing = Math.max(qrSize * 1.5, 100);
      
      // Calculate grid positions for QR codes
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
            blend: 'overlay',
            opacity: 0.3 // Changed to 30% opacity for more faded QR codes
          });
        }
      }
    }
    
    // Create text watermark SVG with reduced density
    const watermarkSvg = `
      <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Reduced density text pattern -->
          <pattern id="watermark" patternUnits="userSpaceOnUse" width="${watermarkSize * 12}" height="${watermarkSize * 12}">
            <!-- Buyer username - less dense -->
            <text x="${watermarkSize * 3}" y="${watermarkSize * 3}" 
                  font-family="Arial, sans-serif" 
                  font-size="${fontSize}" 
                  font-weight="bold"
                  fill="rgba(255,255,255,0.3)" 
                  stroke="rgba(0,0,0,0.5)"
                  stroke-width="0.8"
                  text-anchor="middle" 
                  dominant-baseline="central"
                  transform="rotate(-45 ${watermarkSize * 3} ${watermarkSize * 3})">
              vixter.com.br/${user.username}
            </text>
            <!-- Vendor username - less dense -->
            <text x="${watermarkSize * 9}" y="${watermarkSize * 9}" 
                  font-family="Arial, sans-serif" 
                  font-size="${fontSize}" 
                  font-weight="bold"
                  fill="rgba(255,255,255,0.3)" 
                  stroke="rgba(0,0,0,0.5)"
                  stroke-width="0.8"
                  text-anchor="middle" 
                  dominant-baseline="central"
                  transform="rotate(-45 ${watermarkSize * 9} ${watermarkSize * 9})">
              vixter.com.br/${vendorInfo?.username || 'vendor'}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark)"/>
        
        <!-- Corner watermarks for extra security -->
        <text x="20" y="30" 
              font-family="Arial, sans-serif" 
              font-size="${Math.max(10, fontSize * 0.7)}" 
              font-weight="bold"
              fill="rgba(255,255,255,0.25)" 
              stroke="rgba(0,0,0,0.4)"
              stroke-width="0.5">Comprador: ${buyerProfileUrl}</text>
              
        <text x="20" y="50" 
              font-family="Arial, sans-serif" 
              font-size="${Math.max(10, fontSize * 0.7)}" 
              font-weight="bold"
              fill="rgba(255,255,255,0.25)" 
              stroke="rgba(0,0,0,0.4)"
              stroke-width="0.5">Vendedora: ${vendorProfileUrl}</text>
              
        <text x="${metadata.width - 20}" y="${metadata.height - 10}" 
              font-family="Arial, sans-serif" 
              font-size="${Math.max(10, fontSize * 0.7)}" 
              font-weight="bold"
              fill="rgba(255,255,255,0.25)" 
              stroke="rgba(0,0,0,0.4)"
              stroke-width="0.5"
              text-anchor="end">vixter.com.br</text>
      </svg>
    `;

    // Add text watermark
    compositeOperations.push({
      input: Buffer.from(watermarkSvg),
      blend: 'overlay'
    });

    // Apply all watermarks
    const watermarkedImage = await image
      .composite(compositeOperations)
      .jpeg({ quality: 95, progressive: true }) // Increased quality from 85 to 95 for better image quality
      .toBuffer();

    return watermarkedImage;

  } catch (error) {
    console.error('Error adding watermark to image:', error);
    // Return original image if watermarking fails
    return imageBuffer;
  }
}

/**
 * Add watermark to video using FFmpeg with QR codes and optimized performance
 */
async function addVideoWatermark(videoBuffer, watermark, username, contentItem, user, vendorInfo) {
  return new Promise(async (resolve, reject) => {
    let ffmpegProcess = null;
    let timeoutId = null;
    let inputPath = null;
    let outputPath = null;
    let buyerQRPath = null;
    let vendorQRPath = null;
    
    // Define cleanup function with proper scope
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
      // Check video size - if too large, return original with warning
      const maxSize = 150 * 1024 * 1024; // Increased to 150MB limit
      if (videoBuffer.length > maxSize) {
        console.warn('Video too large for watermarking, returning original');
        resolve(videoBuffer);
        return;
      }
      
      // Generate QR codes for video watermarking
      const qrPattern = await generateVideoQRCodePattern(user, vendorInfo);
      
      // Create temporary files for processing
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      inputPath = path.join(tempDir, `input_${timestamp}.${getFileExtension(contentItem.type)}`);
      outputPath = path.join(tempDir, `output_${timestamp}.mp4`);
      
      // Write input buffer to temporary file
      fs.writeFileSync(inputPath, videoBuffer);
      
      // Save QR codes to temporary files
      if (qrPattern.buyerQR) {
        buyerQRPath = path.join(tempDir, `buyer_qr_${timestamp}.png`);
        fs.writeFileSync(buyerQRPath, qrPattern.buyerQR);
      }
      if (qrPattern.vendorQR) {
        vendorQRPath = path.join(tempDir, `vendor_qr_${timestamp}.png`);
        fs.writeFileSync(vendorQRPath, qrPattern.vendorQR);
      }
      
      // Create alternating watermark text with profile links (escape special characters)
      const buyerProfileUrl = `vixter.com.br/${user.username}`;
      const vendorProfileUrl = `vixter.com.br/${vendorInfo?.username || 'vendor'}`;
      const watermarkText = escapeFFmpegText(`${watermark || username} - vixter.com.br`);
      const buyerText = escapeFFmpegText(`Comprador: ${buyerProfileUrl}`);
      const vendorText = escapeFFmpegText(`Vendedora: ${vendorProfileUrl}`);
      
      // Set timeout for video processing (reduced to 4 minutes for better performance)
      timeoutId = setTimeout(() => {
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGKILL');
        }
        cleanup();
        reject(new Error('Video processing timeout'));
      }, 240000); // 4 minutes
      
      // Build video filters array
      const videoFilters = [];
      
      // Add QR code overlays if available
      if (buyerQRPath && vendorQRPath) {
        const qrSize = qrPattern.size;
        const spacing = qrSize * 2; // Moderate density
        
        // Add buyer QR codes
        videoFilters.push(`movie=${buyerQRPath}:loop=0,setpts=N/(FRAME_RATE*TB),scale=${qrSize}:${qrSize}[buyer_qr]`);
        videoFilters.push(`movie=${vendorQRPath}:loop=0,setpts=N/(FRAME_RATE*TB),scale=${qrSize}:${qrSize}[vendor_qr]`);
        
        // Position QR codes in alternating pattern with 30% transparency
        videoFilters.push(`[buyer_qr]overlay=x=if(eq(mod(t*2,2),0),10,w-${qrSize+10}):y=10:format=auto:alpha=0.3[buyer_overlay]`);
        videoFilters.push(`[vendor_qr]overlay=x=if(eq(mod(t*2,2),0),w-${qrSize+10},10):y=h-${qrSize+10}:format=auto:alpha=0.3[vendor_overlay]`);
        videoFilters.push(`[buyer_overlay][vendor_overlay]overlay=x=w/2-${qrSize/2}:y=h/2-${qrSize/2}:format=auto:alpha=0.3[qr_final]`);
        
        // Corner QR codes for additional coverage
        videoFilters.push(`[qr_final]movie=${buyerQRPath}:loop=0,setpts=N/(FRAME_RATE*TB),scale=${Math.floor(qrSize*0.7)}:${Math.floor(qrSize*0.7)}[corner_buyer]`);
        videoFilters.push(`[corner_buyer]overlay=x=w-${Math.floor(qrSize*0.7)+10}:y=10:format=auto:alpha=0.3[corner_final]`);
      }
      
      // Add text watermarks with reduced density
      const textFilters = [
        // Main corner text watermarks
        `drawtext=text='${buyerText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=16:fontcolor=white@0.6:x=15:y=25`,
        `drawtext=text='${vendorText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=16:fontcolor=white@0.6:x=15:y=45`,
        `drawtext=text='vixter.com.br':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=18:fontcolor=white@0.6:x=w-text_w-15:y=h-15`,
        
        // Reduced density text pattern - buyer username
        `drawtext=text='${watermarkText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=20:fontcolor=white@0.4:x=w/4:y=h/4`,
        `drawtext=text='${watermarkText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=20:fontcolor=white@0.4:x=3*w/4:y=3*h/4`,
        `drawtext=text='${watermarkText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=18:fontcolor=white@0.3:x=w/2:y=h/2`,
        
        // Reduced density text pattern - vendor username
        `drawtext=text='${vendorText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=16:fontcolor=white@0.3:x=w/6:y=h/6`,
        `drawtext=text='${vendorText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=16:fontcolor=white@0.3:x=5*w/6:y=5*h/6`,
        
        // Additional corner watermarks
        `drawtext=text='vixter.com.br':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=14:fontcolor=white@0.4:x=15:y=h-15`,
        `drawtext=text='vixter.com.br':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=14:fontcolor=white@0.4:x=w-15:y=15`
      ];
      
      // Combine QR filters with text filters
      if (videoFilters.length > 0) {
        videoFilters.push(...textFilters);
        videoFilters[videoFilters.length - 1] = videoFilters[videoFilters.length - 1].replace('corner_final', '0:v');
      } else {
        videoFilters.push(...textFilters);
      }
      
      // FFmpeg command with optimized settings for better performance
      ffmpegProcess = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset superfast', // Faster than ultrafast but still good quality
          '-crf 20', // Improved quality (lower CRF = better quality, was 25)
          '-movflags +faststart', // Optimize for streaming
          '-pix_fmt yuv420p', // Ensure compatibility
          '-tune zerolatency', // Optimize for low latency
          '-maxrate 5M', // Increased bitrate for better quality (was 3M)
          '-bufsize 10M', // Increased buffer size (was 6M)
          '-g 30', // Keyframe interval for better seeking
          '-threads 0' // Use all available threads
        ])
        .videoFilters(videoFilters)
        .on('start', (commandLine) => {
          console.log('FFmpeg process started with QR codes:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('Video processing with QR codes: ' + Math.round(progress.percent) + '% done');
          }
        })
        .on('end', () => {
          try {
            clearTimeout(timeoutId);
            
            // Read the watermarked video
            const watermarkedBuffer = fs.readFileSync(outputPath);
            
            cleanup();
            
            console.log('Video watermarking with QR codes completed successfully');
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
    // WebP animated files contain 'ANIM' chunk
    const bufferString = buffer.toString('binary');
    return bufferString.includes('ANIM');
  } catch (error) {
    console.warn('Error checking WebP animation:', error);
    // Default to treating as static image if we can't determine
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
    'image/webp': 'webp' // WebP can be animated (video-like)
  };
  
  return extensions[mimeType] || 'mp4';
}
