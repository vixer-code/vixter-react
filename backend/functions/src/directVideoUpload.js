const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
});

/**
 * Cloud Function for direct video upload to R2
 * This function uploads videos directly to R2 and updates packContent
 * The reprocessing will happen automatically via the trigger function
 */
exports.directVideoUpload = onRequest({
  region: 'us-east1',
  cors: true,
  invoker: 'public',
  memory: '2GiB',
  timeoutSeconds: 300,
  maxInstances: 10,
  minInstances: 0
}, async (req, res) => {
  // Set CORS headers first
  const allowedOrigins = [
    'https://vixter-react.vercel.app',
    'https://vixter.com.br',
    'https://www.vixter.com.br',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  let inputPath = null;
  
  const cleanup = () => {
    try {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }
  };
  
  try {
    // Log request details for debugging
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Check for authentication header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header found');
      return res.status(401).json({
        error: 'Authorization header with Bearer token required',
        details: 'Please provide a valid Firebase ID token in the Authorization header'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verify Firebase token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verified successfully for user:', decodedToken.uid);
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({
        error: 'Invalid or expired token',
        details: error.message
      });
    }
    
    // Get user data
    const userId = decodedToken.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('User not found in database:', userId);
      return res.status(404).json({
        error: 'User not found',
        details: 'User account does not exist in the database'
      });
    }
    
    const vendorUsername = userDoc.data().username;
    console.log('Processing video for vendor:', vendorUsername);
    
    // Validate Content-Type for multipart
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({
        error: 'Invalid Content-Type',
        details: 'Request must be multipart/form-data for file upload'
      });
    }
    
    // Parse multipart form data
    const busboy = Busboy({ 
      headers: req.headers,
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB limit
        files: 1,
        fields: 10,
        fieldSize: 1024 * 1024 // 1MB for text fields
      }
    });
    
    const formData = {};
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
          inputPath = path.join(tempDir, `direct_upload_${timestamp}_${filename}`);
          
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
        console.error('Busboy error:', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
          reject(new Error('File too large: ' + error.message));
        } else {
          reject(error);
        }
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
    
    // Check file size (limit to 200MB)
    const fileStats = fs.statSync(inputPath);
    const maxSize = 200 * 1024 * 1024; // 200MB limit
    
    if (fileStats.size > maxSize) {
      cleanup();
      return res.status(413).json({
        error: 'File too large',
        details: `File size ${Math.round(fileStats.size / 1024 / 1024)}MB exceeds maximum allowed size of 200MB`
      });
    }
    
    if (fileStats.size === 0) {
      cleanup();
      return res.status(400).json({
        error: 'Empty file uploaded'
      });
    }
    
    console.log(`Video file size: ${Math.round(fileStats.size / 1024 / 1024)}MB`);
    
    // Read video file
    const videoBuffer = fs.readFileSync(inputPath);
    
    // Upload directly to R2
    console.log('Uploading video directly to R2:', key);
    const uploadResult = await uploadToR2(key, videoBuffer, videoContentType || 'video/mp4');
    
    // Update packContent with video reference
    await updatePackContentWithVideo(packId, key, {
      name: videoFilename,
      size: videoBuffer.length,
      type: videoContentType || 'video/mp4',
      processed: false, // Will be updated by the reprocessor
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      vendorId: userId
    });
    
    cleanup();
    
    console.log('Video uploaded successfully and packContent updated');
    
    return res.status(200).json({
      success: true,
      data: {
        key: uploadResult.key,
        size: videoBuffer.length,
        type: videoContentType || 'video/mp4',
        name: videoFilename,
        processed: false,
        message: 'Video uploaded successfully. Processing will happen automatically in the background.'
      }
    });
    
  } catch (error) {
    console.error('Error in directVideoUpload:', error);
    console.error('Error stack:', error.stack);
    console.error('Request headers:', req.headers);
    console.error('Request method:', req.method);
    console.error('Request URL:', req.url);
    
    cleanup();
    
    // Handle specific error types
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        details: 'The uploaded file exceeds the maximum allowed size of 200MB'
      });
    }
    
    if (error.message && error.message.includes('413')) {
      return res.status(413).json({
        error: 'Request entity too large',
        details: 'The request payload is too large for the server to process'
      });
    }
    
    if (error.message && error.message.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout',
        details: 'The request took too long to process'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

/**
 * Upload video to R2
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
 * Update packContent with video reference
 */
async function updatePackContentWithVideo(packId, key, videoData) {
  try {
    const packRef = db.collection('packContent').doc(packId);
    
    // Get current packContent
    const packDoc = await packRef.get();
    if (!packDoc.exists) {
      throw new Error('PackContent not found');
    }
    
    const packData = packDoc.data();
    const content = packData.content || [];
    
    // Find the video item by key and update it
    let videoUpdated = false;
    const updatedContent = content.map(item => {
      if (item.key === key) {
        videoUpdated = true;
        return {
          ...item,
          ...videoData,
          key: key
        };
      }
      return item;
    });
    
    // If video not found in content, add it
    if (!videoUpdated) {
      updatedContent.push({
        type: 'video',
        key: key,
        ...videoData
      });
    }
    
    // Update packContent
    await packRef.update({
      content: updatedContent,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('PackContent updated with video:', key);
    
  } catch (error) {
    console.error('Error updating packContent:', error);
    throw error;
  }
}