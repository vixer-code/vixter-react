const jwt = require('jsonwebtoken');

// Centrífugo configuration (opcional - para implementação futura)
const CENTRIFUGO_URL = process.env.CENTRIFUGO_URL || null;
const CENTRIFUGO_API_KEY = process.env.CENTRIFUGO_API_KEY || null;
const CENTRIFUGO_TOKEN_SECRET = process.env.CENTRIFUGO_TOKEN_SECRET || 'default-secret';

/**
 * Generate a Centrífugo token for a user
 * This token will be used by the frontend to connect to Centrífugo
 */
function generateCentrifugoToken(userId) {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
    iat: Math.floor(Date.now() / 1000),
  };

  // Sign JWT with the secret
  const token = jwt.sign(payload, CENTRIFUGO_TOKEN_SECRET);
  
  return {
    token,
    user: userId,
    expires: payload.exp * 1000, // Convert to milliseconds
  };
}

/**
 * Validate a Centrífugo token
 */
function validateCentrifugoToken(token) {
  try {
    const payload = jwt.verify(token, CENTRIFUGO_TOKEN_SECRET);
    
    return {
      valid: true,
      userId: payload.sub,
    };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Get Centrífugo connection info for frontend
 */
function getCentrifugoConnectionInfo(userId) {
  const tokenInfo = generateCentrifugoToken(userId);
  
  return {
    url: CENTRIFUGO_URL,
    token: tokenInfo.token,
    user: userId,
    expires: tokenInfo.expires,
  };
}

module.exports = {
  generateCentrifugoToken,
  validateCentrifugoToken,
  getCentrifugoConnectionInfo,
};
