const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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
 * Cloud Function to get video processing status
 * Returns the current status of video processing for a pack
 */
exports.getVideoProcessingStatus = onRequest({
  region: 'us-east1',
  cors: true,
  invoker: 'public',
  memory: '512MiB',
  timeoutSeconds: 60,
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
    
    // Get packId from query parameters
    const { packId } = req.query;
    
    if (!packId) {
      return res.status(400).json({
        error: 'Missing required parameter: packId'
      });
    }
    
    // Get packContent
    const packDoc = await db.collection('packContent').doc(packId).get();
    
    if (!packDoc.exists) {
      return res.status(404).json({
        error: 'Pack not found'
      });
    }
    
    const packData = packDoc.data();
    const content = packData.content || [];
    
    // Filter videos and get their processing status
    const videos = content.filter(item => item.type === 'video');
    
    const videoStatuses = videos.map(video => ({
      key: video.key,
      name: video.name,
      size: video.size,
      type: video.type,
      processed: video.processed || false,
      processingError: video.processingError || null,
      uploadedAt: video.uploadedAt,
      lastProcessed: video.lastProcessed,
      status: getVideoStatus(video)
    }));
    
    // Calculate overall processing status
    const totalVideos = videos.length;
    const processedVideos = videos.filter(v => v.processed).length;
    const errorVideos = videos.filter(v => v.processingError).length;
    const pendingVideos = totalVideos - processedVideos - errorVideos;
    
    const overallStatus = {
      total: totalVideos,
      processed: processedVideos,
      pending: pendingVideos,
      errors: errorVideos,
      isComplete: errorVideos === 0 && pendingVideos === 0,
      progress: totalVideos > 0 ? Math.round((processedVideos / totalVideos) * 100) : 100
    };
    
    return res.status(200).json({
      success: true,
      data: {
        packId,
        overallStatus,
        videos: videoStatuses,
        lastUpdated: packData.lastUpdated
      }
    });
    
  } catch (error) {
    console.error('Error in getVideoProcessingStatus:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Determine video processing status
 */
function getVideoStatus(video) {
  if (video.processed) {
    return 'completed';
  } else if (video.processingError) {
    return 'error';
  } else if (video.uploadedAt) {
    return 'processing';
  } else {
    return 'pending';
  }
}