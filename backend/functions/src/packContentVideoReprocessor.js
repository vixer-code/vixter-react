const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get R2 client instance (initialized on demand to access runtime env vars)
 */
function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Cloud Function triggered when pack documents are updated
 * Automatically reprocesses videos when they are inserted or modified in packContent field
 */
exports.packContentVideoReprocessor = onDocumentUpdated({
  document: 'packs/{packId}',
  region: 'us-east1',
  memory: '4GiB',
  timeoutSeconds: 540,
  maxInstances: 10,
  minInstances: 0
}, async (event) => {
  // Initialize R2 client within function execution context
  const r2Client = getR2Client();
  const PACK_CONTENT_BUCKET_NAME = process.env.R2_PACK_CONTENT_BUCKET_NAME || 'vixter-pack-content-private';
  
  // Log credentials for debugging (first 5 chars only)
  console.log('R2 Config:', {
    accountId: process.env.R2_ACCOUNT_ID?.substring(0, 5) + '...',
    hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
    bucket: PACK_CONTENT_BUCKET_NAME
  });
  const { before, after } = event.data;
  
  if (!before || !after) {
    console.log('No before/after data available');
    return;
  }

  const beforeData = before.data();
  const afterData = after.data();
  
  console.log('PackContent document updated:', event.params.packId);
  console.log('Before data:', beforeData);
  console.log('After data:', afterData);

  try {
    // Check if videos were added or modified
    const videoChanges = detectVideoChanges(beforeData, afterData);
    
    if (videoChanges.length === 0) {
      console.log('No video changes detected');
      return;
    }

    console.log(`Found ${videoChanges.length} video changes to process`);

    // Get vendor information (authorId is the vendor/seller ID)
    const vendorId = afterData.authorId;
    if (!vendorId) {
      console.log('No authorId found in pack document');
      return;
    }

    const vendorDoc = await db.collection('users').doc(vendorId).get();
    if (!vendorDoc.exists) {
      console.log('Vendor not found:', vendorId);
      return;
    }

    const vendorUsername = vendorDoc.data().username;
    console.log('Processing videos for vendor:', vendorUsername);

    // Process each video change asynchronously
    const processingPromises = videoChanges.map(change => 
      processVideoChange(change, vendorUsername, event.params.packId, r2Client, PACK_CONTENT_BUCKET_NAME)
    );

    // Wait for all processing to complete
    const results = await Promise.allSettled(processingPromises);
    
    // Log results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Video ${index + 1} processed successfully:`, result.value);
      } else {
        console.error(`Video ${index + 1} processing failed:`, result.reason);
      }
    });

    // Update packContent with processing status
    await updatePackContentStatus(event.params.packId, videoChanges, results);

  } catch (error) {
    console.error('Error in packContentVideoReprocessor:', error);
    console.error('Error stack:', error.stack);
  }
});

/**
 * Detect video changes between before and after data
 */
function detectVideoChanges(beforeData, afterData) {
  const changes = [];
  
  // Check if packContent array exists and has videos
  if (!afterData.packContent || !Array.isArray(afterData.packContent)) {
    return changes;
  }

  const beforeContent = beforeData.packContent || [];
  const afterContent = afterData.packContent || [];

  // Find new or modified videos
  afterContent.forEach((item, index) => {
    // Check if item is a video (supports both 'video' string and MIME types like 'video/mp4')
    const isVideo = item.type && (item.type === 'video' || item.type.startsWith('video/'));
    
    if (isVideo && item.key) {
      const beforeItem = beforeContent[index];
      
      // Check if it's a new video or modified
      const isNew = !beforeItem || beforeItem.key !== item.key;
      const isModified = beforeItem && (
        beforeItem.key !== item.key ||
        beforeItem.processed !== item.processed ||
        beforeItem.size !== item.size
      );

      if (isNew || isModified) {
        changes.push({
          index,
          item,
          type: isNew ? 'new' : 'modified',
          beforeItem
        });
      }
    }
  });

  return changes;
}

/**
 * Process a single video change
 */
async function processVideoChange(change, vendorUsername, packId, r2Client, bucketName) {
  const { item, index, type } = change;
  
  console.log(`Processing ${type} video at index ${index}:`, item.key);

  let inputPath = null;
  let outputPath = null;
  let vendorQRPath = null;

  const cleanup = () => {
    try {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (vendorQRPath && fs.existsSync(vendorQRPath)) fs.unlinkSync(vendorQRPath);
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }
  };

  try {
    // Download video from R2
    console.log('Downloading video from R2:', item.key);
    const videoBuffer = await downloadFromR2(item.key, r2Client, bucketName);
    
    if (!videoBuffer) {
      throw new Error('Failed to download video from R2');
    }

    // Save to temporary file
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    inputPath = path.join(tempDir, `reprocess_${timestamp}_${path.basename(item.key)}`);
    fs.writeFileSync(inputPath, videoBuffer);

    console.log(`Video downloaded and saved to: ${inputPath}`);

    // Get video dimensions
    const videoDimensions = await getVideoDimensions(inputPath);
    console.log(`Video dimensions: ${videoDimensions.width}x${videoDimensions.height}`);

    // Generate vendor QR code
    const qrPattern = await generateVideoQRCodePattern(vendorUsername, videoDimensions.width, videoDimensions.height);
    
    if (qrPattern.vendorQR) {
      vendorQRPath = path.join(tempDir, `vendor_qr_${timestamp}.png`);
      fs.writeFileSync(vendorQRPath, qrPattern.vendorQR);
      console.log(`Vendor QR code written to: ${vendorQRPath}`);
    }

    // Test ffmpeg availability
    const ffmpegAvailable = await testFFmpeg();
    if (!ffmpegAvailable) {
      console.warn('FFmpeg not available, skipping video processing');
      return {
        success: false,
        error: 'FFmpeg not available',
        key: item.key
      };
    }

    // Process video with vendor QR code
    outputPath = path.join(tempDir, `output_${timestamp}.mp4`);
    const vendorText = escapeFFmpegText(`vixter.com.br/${vendorUsername}`);

    await new Promise((resolve, reject) => {
      const videoFilters = [];
      
      // Build text overlay filter
      const textFilters = [
        `drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=20`
      ];
      videoFilters.push(textFilters.join(','));

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
      throw new Error('Failed to process video');
    }

    const processedVideoBuffer = fs.readFileSync(outputPath);
    console.log(`Processed video size: ${processedVideoBuffer.length} bytes`);

    // Upload processed video back to R2 with the same key
    const uploadResult = await uploadToR2(item.key, processedVideoBuffer, 'video/mp4', r2Client, bucketName);
    
    cleanup();

    console.log(`Video reprocessed successfully: ${item.key}`);

    return {
      success: true,
      key: item.key,
      size: processedVideoBuffer.length,
      processed: true,
      type: 'reprocessed'
    };

  } catch (error) {
    console.error(`Error processing video ${item.key}:`, error);
    cleanup();
    
    return {
      success: false,
      key: item.key,
      error: error.message,
      type: 'error'
    };
  }
}

/**
 * Download video from R2
 */
async function downloadFromR2(key, r2Client, bucketName) {
  try {
    console.log('Downloading from R2:', { key, bucket: bucketName });
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const response = await r2Client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error downloading from R2:', error);
    return null;
  }
}

/**
 * Upload processed video to R2
 */
async function uploadToR2(key, buffer, contentType, r2Client, bucketName) {
  console.log('Uploading to R2:', { key, bucket: bucketName, size: buffer.length, contentType });
  const command = new PutObjectCommand({
    Bucket: bucketName,
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
 * Update packContent with processing status
 */
async function updatePackContentStatus(packId, changes, results) {
  try {
    const updateData = {};
    
    results.forEach((result, index) => {
      const change = changes[index];
      const contentPath = `packContent.${change.index}`;
      
      if (result.status === 'fulfilled' && result.value.success) {
        updateData[`${contentPath}.processed`] = true;
        updateData[`${contentPath}.size`] = result.value.size;
        updateData[`${contentPath}.lastProcessed`] = admin.firestore.FieldValue.serverTimestamp();
      } else {
        updateData[`${contentPath}.processingError`] = result.reason?.message || 'Unknown error';
        updateData[`${contentPath}.lastProcessed`] = admin.firestore.FieldValue.serverTimestamp();
      }
    });

    if (Object.keys(updateData).length > 0) {
      await db.collection('packs').doc(packId).update(updateData);
      console.log('Pack packContent status updated:', updateData);
    }
  } catch (error) {
    console.error('Error updating pack packContent status:', error);
  }
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