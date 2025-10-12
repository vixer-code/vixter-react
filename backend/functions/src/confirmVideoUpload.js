const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const cors = require('cors');

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
 * Cloud Function to confirm video upload and update packContent
 * This function is called after the frontend uploads a video directly to R2
 */
exports.confirmVideoUpload = onRequest({
  region: 'us-east1',
  cors: true,
  invoker: 'public',
  memory: '512MiB',
  timeoutSeconds: 60,
  maxInstances: 10,
  minInstances: 0
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    // Set CORS headers manually as backup
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    try {
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
      console.log('Confirming video upload for vendor:', vendorUsername);
      
      // Get request body
      const { packId, key, originalName } = req.body;
      
      if (!packId || !key || !originalName) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'packId, key, and originalName are required'
        });
      }
      
      // Verify the file exists in R2
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: PACK_CONTENT_BUCKET_NAME,
          Key: key
        });
        
        const headResult = await r2Client.send(headCommand);
        console.log('Video file verified in R2:', key);
        
        // Get file metadata
        const fileSize = headResult.ContentLength || 0;
        const contentType = headResult.ContentType || 'video/mp4';
        const metadata = headResult.Metadata || {};
        
        // Update packContent with video reference
        await updatePackContentWithVideo(packId, key, {
          name: originalName,
          size: fileSize,
          type: contentType,
          processed: false, // Will be updated by the reprocessor
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          vendorId: userId,
          vendorUsername: vendorUsername
        });
        
        console.log('PackContent updated with video:', key);
        
        return res.status(200).json({
          success: true,
          data: {
            key,
            size: fileSize,
            type: contentType,
            name: originalName,
            processed: false,
            message: 'Video uploaded successfully. Processing will happen automatically in the background.'
          }
        });
        
      } catch (r2Error) {
        console.error('Error verifying file in R2:', r2Error);
        return res.status(404).json({
          error: 'File not found in R2',
          details: 'The uploaded file could not be verified in R2 storage'
        });
      }
      
    } catch (error) {
      console.error('Error in confirmVideoUpload:', error);
      console.error('Error stack:', error.stack);
      
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

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
    
    // Find the video item by key and update it, or add if not found
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