const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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
 * Cloud Function to generate signed upload URL for direct video upload to R2
 * This allows frontend to upload videos directly to R2 without going through Cloud Functions
 */
exports.generateVideoUploadUrl = onRequest({
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
      console.log('Generating upload URL for vendor:', vendorUsername);
      
      // Get request body
      const { packId, contentType, originalName, expiresIn = 3600 } = req.body;
      
      if (!packId || !contentType || !originalName) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'packId, contentType, and originalName are required'
        });
      }
      
      // Validate content type
      if (!contentType.startsWith('video/')) {
        return res.status(400).json({
          error: 'Invalid content type',
          details: 'Only video files are allowed'
        });
      }
      
      // Generate unique key for the video
      const timestamp = Date.now();
      const fileExtension = originalName.split('.').pop();
      const key = `packs/${packId}/videos/${timestamp}_${originalName}`;
      
      console.log('Generating upload URL for key:', key);
      
      // Create PutObject command
      const putObjectCommand = new PutObjectCommand({
        Bucket: PACK_CONTENT_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        Metadata: {
          'packId': packId,
          'vendorId': userId,
          'vendorUsername': vendorUsername,
          'originalName': originalName,
          'uploadedAt': new Date().toISOString()
        }
      });
      
      // Generate signed URL
      const uploadUrl = await getSignedUrl(r2Client, putObjectCommand, {
        expiresIn: expiresIn
      });
      
      console.log('Upload URL generated successfully');
      
      return res.status(200).json({
        success: true,
        data: {
          uploadUrl,
          key,
          publicUrl: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${PACK_CONTENT_BUCKET_NAME}/${key}`,
          contentType,
          originalName,
          expiresIn,
          packId
        }
      });
      
    } catch (error) {
      console.error('Error in generateVideoUploadUrl:', error);
      console.error('Error stack:', error.stack);
      
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});