const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const ffmpeg = require('fluent-ffmpeg');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

// Define secrets from Secret Manager
const r2AccountId = defineSecret('R2_ACCOUNT_ID');
const r2AccessKeyId = defineSecret('R2_ACCESS_KEY_ID');
const r2SecretAccessKey = defineSecret('R2_SECRET_ACCESS_KEY');
const r2BucketName = defineSecret('R2_PACK_CONTENT_BUCKET_NAME');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// R2 client and bucket name are initialized inside the function with access to secrets

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
  minInstances: 0,
  secrets: [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName]
}, async (event) => {
  // Initialize R2 client and bucket name within function execution context using secrets
  let r2Client;
  let PACK_CONTENT_BUCKET_NAME;
  
  try {
    const accountId = r2AccountId.value();
    const accessKeyId = r2AccessKeyId.value();
    const secretAccessKey = r2SecretAccessKey.value();
    PACK_CONTENT_BUCKET_NAME = r2BucketName.value();
    
    console.log('✅ R2 Secrets loaded from Secret Manager');
    console.log('   Account ID:', accountId.substring(0, 5) + '...');
    console.log('   Bucket:', PACK_CONTENT_BUCKET_NAME);
    console.log('   Endpoint:', `https://${accountId}.r2.cloudflarestorage.com`);
    
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
    
    console.log('✅ R2 Client initialized successfully with Secret Manager credentials');
  } catch (error) {
    console.error('❌ Failed to initialize R2 client:', error.message);
    console.error('   Check if secrets are configured in Secret Manager:');
    console.error('   - R2_ACCOUNT_ID');
    console.error('   - R2_ACCESS_KEY_ID');
    console.error('   - R2_SECRET_ACCESS_KEY');
    console.error('   - R2_PACK_CONTENT_BUCKET_NAME');
    return;
  }
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
      console.log('No video changes detected - packContent array unchanged');
      return;
    }

    console.log(`Found ${videoChanges.length} video changes to process`);
    console.log('IMPORTANT: Processing videos in-place with same filenames. PackContent array will NOT be modified.');

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
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;
    
    console.log(`\n=== VIDEO PROCESSING SUMMARY ===`);
    console.log(`Total videos: ${results.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`PackContent array: UNCHANGED (videos processed in-place)`);
    console.log(`================================\n`);
    
    results.forEach((result, index) => {
      const change = videoChanges[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ Video ${index + 1} (${change.item.name}): Processed successfully`);
        console.log(`   Key: ${change.item.key}`);
        console.log(`   New size: ${result.value.size} bytes`);
      } else {
        console.error(`❌ Video ${index + 1} (${change.item.name}): Processing failed`);
        console.error(`   Key: ${change.item.key}`);
        console.error(`   Error: ${result.reason?.message || 'Unknown error'}`);
        console.error(`   IMPORTANT: Original video remains unchanged in R2`);
      }
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in packContentVideoReprocessor:', error);
    console.error('Error stack:', error.stack);
    console.error('IMPORTANT: If error occurred, packContent array should remain unchanged');
    // Don't throw - let the function complete gracefully without affecting the pack
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

  // Find new or modified videos ONLY
  afterContent.forEach((item, index) => {
    // Check if item is a video (supports both 'video' string and MIME types like 'video/mp4')
    const isVideo = item.type && (item.type === 'video' || item.type.startsWith('video/'));
    
    if (isVideo && item.key) {
      const beforeItem = beforeContent[index];
      
      // Only process if it's TRULY new (key doesn't exist in before state)
      // This prevents reprocessing the same video multiple times
      const isNew = !beforeItem || beforeItem.key !== item.key;
      
      // Mark as already processed if it has QR codes (to prevent reprocessing)
      const alreadyProcessed = item.name && (
        item.name.includes('_qr') || 
        item.name.includes('_processed') ||
        item.key.includes('_qr') ||
        item.key.includes('_processed')
      );

      if (isNew && !alreadyProcessed) {
        console.log(`New video detected: ${item.name} (${item.key})`);
        changes.push({
          index,
          item,
          type: 'new',
          beforeItem
        });
      } else if (alreadyProcessed) {
        console.log(`Skipping already processed video: ${item.name}`);
      } else {
        console.log(`Skipping unchanged video: ${item.name}`);
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

    // Add timeout for video processing
    let ffmpegTimeoutId = setTimeout(() => {
      console.error('Video processing timeout');
      throw new Error('Video processing timeout');
    }, 240000);

    try {
      await new Promise(async (resolve, reject) => {
        const videoFilters = [];
        
        // Try QR code GRID approach (only vendor QR since we don't know buyers yet)
        if (qrPattern.vendorQR) {
          console.log('Attempting QR code grid watermarking with vendor QR...');
          
          try {
            // Generate QR code grid for full video coverage (vendor QR only)
            const qrOverlays = await generateVideoQRGrid(qrPattern, videoDimensions.width, videoDimensions.height);
            
            if (qrOverlays.length > 0) {
              console.log(`Generated ${qrOverlays.length} vendor QR code overlays for grid coverage`);
              
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
              
              // Add text watermark at the end (only vendor for reprocessor)
              filterChain.push(`[final]drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=20[final_text]`);
              
              videoFilters.push(filterChain.join(','));
              console.log('QR code grid filters applied');
              
              // Store QR paths for cleanup
              qrOverlays.forEach(overlay => {
                if (overlay.path && fs.existsSync(overlay.path)) {
                  if (!vendorQRPath) vendorQRPath = overlay.path;
                }
              });
              
            } else {
              throw new Error('No QR overlays generated');
            }
          } catch (qrError) {
            console.warn('QR code grid watermarking failed, falling back to text only:', qrError);
            // Fallback to text only
            const textFilters = [
              `drawtext=text='${vendorText}':fontsize=12:fontcolor=white@0.3:x=20:y=20`
            ];
            videoFilters.push(textFilters.join(','));
          }
        } else {
          console.log('QR code files not available, using text watermarks only');
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
          .on('stderr', (stderrLine) => {
            console.log('FFmpeg stderr:', stderrLine);
          })
          .on('end', () => {
            console.log('Video processing completed');
            clearTimeout(ffmpegTimeoutId);
            resolve();
          })
          .on('error', (error) => {
            console.error('FFmpeg error:', error);
            clearTimeout(ffmpegTimeoutId);
            reject(error);
          })
          .save(outputPath);
      });
      
      clearTimeout(ffmpegTimeoutId);
    } catch (processingError) {
      clearTimeout(ffmpegTimeoutId);
      throw processingError;
    }

    // Verify output file
    if (!fs.existsSync(outputPath)) {
      throw new Error('Failed to process video');
    }

    const processedVideoBuffer = fs.readFileSync(outputPath);
    console.log(`Processed video size: ${processedVideoBuffer.length} bytes`);

    // Upload processed video back to R2 with the EXACT SAME KEY
    // This ensures the packContent array doesn't need to be updated
    // The video file is replaced in-place with the QR-coded version
    console.log(`Uploading processed video with SAME KEY: ${item.key}`);
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
    cleanup();
    
    console.error(`\n❌ ERROR PROCESSING VIDEO`);
    console.error(`   Index: ${index}`);
    console.error(`   Key: ${item.key}`);
    console.error(`   Name: ${item.name}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   ⚠️  IMPORTANT: Original video in R2 remains UNCHANGED`);
    console.error(`   ⚠️  IMPORTANT: packContent array remains UNCHANGED\n`);
    
    return {
      success: false,
      key: item.key,
      name: item.name,
      index: index,
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
 * REMOVED: updatePackContentStatus
 * 
 * We don't update the packContent array in Firestore because:
 * 1. Videos are processed in-place with the SAME key/filename
 * 2. The array structure remains unchanged
 * 3. Only the video file in R2 is updated with QR codes
 * 4. This prevents accidentally corrupting or deleting the array
 */

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
      
      // Use only vendor QR (buyer QR will be added by packContentAccess when accessed)
      const qrBuffer = qrPattern.vendorQR;
      
      if (qrBuffer) {
        const qrPath = path.join(os.tmpdir(), `qr_vendor_${row}_${col}_${Date.now()}.png`);
        fs.writeFileSync(qrPath, qrBuffer);
        
        qrOverlays.push({
          path: qrPath,
          x: Math.round(x),
          y: Math.round(y),
          isVendor: true
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
    'video/m4v': 'm4v'
  };
  
  return extensions[mimeType] || 'mp4';
}