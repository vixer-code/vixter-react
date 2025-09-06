const jwt = require('jsonwebtoken');

// Centrifugo configuration
const CENTRIFUGO_URL = process.env.CENTRIFUGO_URL || 'https://vixter-centrifugo.fly.dev';
const CENTRIFUGO_API_KEY = process.env.CENTRIFUGO_API_KEY || null;
const CENTRIFUGO_TOKEN_SECRET = process.env.CENTRIFUGO_TOKEN_SECRET || 'default-secret';
const CENTRIFUGO_WS_URL = process.env.CENTRIFUGO_WS_URL || 'wss://vixter-centrifugo.fly.dev/connection/websocket';

/**
 * Generate a Centrifugo token for a user
 * This token will be used by the frontend to connect to Centrifugo
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
 * Validate a Centrifugo token
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
 * Get Centrifugo connection info for frontend
 */
function getCentrifugoConnectionInfo(userId) {
  const tokenInfo = generateCentrifugoToken(userId);
  
  return {
    url: CENTRIFUGO_WS_URL,
    token: tokenInfo.token,
    user: userId,
    expires: tokenInfo.expires,
  };
}

/**
 * Publish message to Centrifugo channel
 */
async function publishToChannel(channel, data) {
  if (!CENTRIFUGO_API_KEY) {
    throw new Error('Centrifugo API key not configured');
  }

  const response = await fetch(`${CENTRIFUGO_URL}/api/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `apikey ${CENTRIFUGO_API_KEY}`
    },
    body: JSON.stringify({
      channel: channel,
      data: data
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to publish message: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get channel name for conversation
 */
function getConversationChannel(conversationId) {
  return `conversation:${conversationId}`;
}

/**
 * Get channel name for user presence
 */
function getUserPresenceChannel(userId) {
  return `user:${userId}`;
}

module.exports = {
  generateCentrifugoToken,
  validateCentrifugoToken,
  getCentrifugoConnectionInfo,
  publishToChannel,
  getConversationChannel,
  getUserPresenceChannel,
  CENTRIFUGO_URL,
  CENTRIFUGO_WS_URL,
  CENTRIFUGO_API_KEY,
  CENTRIFUGO_TOKEN_SECRET
};
