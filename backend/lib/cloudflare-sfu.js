const jwt = require('jsonwebtoken');

// Cloudflare Realtime SFU configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_REALTIME_URL = process.env.CLOUDFLARE_REALTIME_URL || 'https://api.cloudflare.com/client/v4/accounts';

/**
 * Generate JWT token for Cloudflare Realtime SFU
 * This creates a proper token for Realtime SFU sessions
 */
function generateCloudflareSFUToken(userId, roomId, capabilities = ['publish', 'subscribe']) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare Realtime SFU not configured. Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
  }

  console.log(`🔑 Generating Realtime SFU token for user ${userId} in session ${roomId}`);
  
  const payload = {
    sub: userId,
    iss: CLOUDFLARE_ACCOUNT_ID,
    sessionId: roomId,
    capabilities: capabilities,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
    iat: Math.floor(Date.now() / 1000),
    // Realtime SFU specific claims
    aud: 'realtime-sfu',
    type: 'realtime-sfu-token'
  };

  // Use the API token as the signing key for Realtime SFU
  const token = jwt.sign(payload, CLOUDFLARE_API_TOKEN);
  
  return {
    token,
    roomId,
    userId,
    expires: payload.exp * 1000,
    capabilities,
    type: 'realtime-sfu'
  };
}

/**
 * Create a new Realtime SFU session
 * Uses Cloudflare Realtime SFU API to create a session for WebRTC calls
 */
async function createSFURoom(roomId, participants = []) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare Realtime SFU not configured. Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
  }

  console.log(`🏠 Creating Realtime SFU session: ${roomId} with participants:`, participants);

  try {
    // Create a new session using Cloudflare Realtime SFU API
    const response = await fetch(`${CLOUDFLARE_REALTIME_URL}/${CLOUDFLARE_ACCOUNT_ID}/realtime/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: roomId,
        participants: participants,
        // Configure for WebRTC
        capabilities: {
          publish: true,
          subscribe: true,
          simulcast: true
        },
        // Session configuration
        maxParticipants: 10, // Adjust as needed
        recording: false,
        // Enable simulcast for better quality
        simulcast: {
          enabled: true,
          layers: ['low', 'medium', 'high']
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudflare Realtime SFU API Error:', errorData);
      throw new Error(`Failed to create Realtime SFU session: ${errorData.message || response.statusText}`);
    }

    const sessionData = await response.json();
    console.log('✅ Realtime SFU session created:', sessionData);
    
    return {
      id: roomId,
      sessionId: sessionData.sessionId,
      participants: participants,
      status: 'created',
      type: 'realtime_sfu',
      createdAt: new Date().toISOString(),
      cloudflareData: sessionData
    };
  } catch (error) {
    console.error('Error creating Realtime SFU session:', error);
    throw error;
  }
}

/**
 * Get Realtime SFU session information
 * Uses Cloudflare Realtime SFU API to get session details
 */
async function getSFURoom(roomId) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare Realtime SFU not configured');
  }

  console.log(`🔍 Getting Realtime SFU session: ${roomId}`);

  try {
    const response = await fetch(`${CLOUDFLARE_REALTIME_URL}/${CLOUDFLARE_ACCOUNT_ID}/realtime/sessions/${roomId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Session ${roomId} not found`);
        return null; // Session doesn't exist
      }
      const errorData = await response.json();
      throw new Error(`Failed to get Realtime SFU session: ${errorData.message || response.statusText}`);
    }

    const sessionData = await response.json();
    console.log('✅ Realtime SFU session found:', sessionData);
    
    return {
      id: roomId,
      sessionId: sessionData.sessionId,
      status: sessionData.status || 'active',
      type: 'realtime_sfu',
      participants: sessionData.participants || [],
      cloudflareData: sessionData
    };
  } catch (error) {
    console.error('Error getting Realtime SFU session:', error);
    throw error;
  }
}

/**
 * Delete Realtime SFU session
 * Uses Cloudflare Realtime SFU API to delete the session
 */
async function deleteSFURoom(roomId) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare Realtime SFU not configured');
  }

  console.log(`🗑️ Deleting Realtime SFU session: ${roomId}`);

  try {
    const response = await fetch(`${CLOUDFLARE_REALTIME_URL}/${CLOUDFLARE_ACCOUNT_ID}/realtime/sessions/${roomId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.warn(`Failed to delete Realtime SFU session: ${errorData.message || response.statusText}`);
      return false;
    }

    console.log('✅ Realtime SFU session deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting Realtime SFU session:', error);
    return false;
  }
}

/**
 * Generate room ID for call
 */
function generateCallRoomId(conversationId) {
  return `call_${conversationId}_${Date.now()}`;
}

module.exports = {
  generateCloudflareSFUToken,
  createSFURoom,
  getSFURoom,
  deleteSFURoom,
  generateCallRoomId,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN
};
