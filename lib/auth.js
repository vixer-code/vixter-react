const { auth } = require('./firebase-admin');

/**
 * Verify Firebase ID token from request headers
 */
async function verifyFirebaseToken(req) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return null;
    }

    // Verify the token with Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 */
function requireAuth(handler) {
  return async (req, res) => {
    const user = await verifyFirebaseToken(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Add user to request object
    req.user = user;
    return handler(req, res);
  };
}

/**
 * CORS headers for API responses
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://vixter-react.vercel.app',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight requests
 */
function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json(null);
  }
  
  return null;
}

module.exports = {
  verifyFirebaseToken,
  requireAuth,
  getCorsHeaders,
  handleCors,
};
