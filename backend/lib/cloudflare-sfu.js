const jwt = require('jsonwebtoken');

// Cloudflare SFU configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_SFU_URL = process.env.CLOUDFLARE_SFU_URL || 'https://api.cloudflare.com/client/v4/accounts';

/**
 * Generate JWT token for Cloudflare SFU
 * This token allows users to join SFU rooms
 */
function generateCloudflareSFUToken(userId, roomId, capabilities = ['publish', 'subscribe']) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare SFU not configured. Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
  }

  const payload = {
    sub: userId,
    iss: CLOUDFLARE_ACCOUNT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
    iat: Math.floor(Date.now() / 1000),
    room: roomId,
    capabilities: capabilities
  };

  // For now, we'll use a simple secret. In production, you should use Cloudflare's key management
  const token = jwt.sign(payload, CLOUDFLARE_API_TOKEN);
  
  return {
    token,
    roomId,
    userId,
    expires: payload.exp * 1000,
    capabilities
  };
}

/**
 * Create a new SFU room
 */
async function createSFURoom(roomId, participants = []) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare SFU not configured');
  }

  try {
    const response = await fetch(`${CLOUDFLARE_SFU_URL}/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        room: roomId,
        participants: participants,
        // Configure for WebRTC
        protocol: 'webrtc',
        // Enable simulcast for better quality
        simulcast: true,
        // Enable recording if needed
        recording: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create SFU room: ${errorData.message || response.statusText}`);
    }

    const roomData = await response.json();
    return roomData;
  } catch (error) {
    console.error('Error creating SFU room:', error);
    throw error;
  }
}

/**
 * Get SFU room information
 */
async function getSFURoom(roomId) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare SFU not configured');
  }

  try {
    const response = await fetch(`${CLOUDFLARE_SFU_URL}/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${roomId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Room doesn't exist
      }
      throw new Error(`Failed to get SFU room: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting SFU room:', error);
    throw error;
  }
}

/**
 * Delete SFU room
 */
async function deleteSFURoom(roomId) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare SFU not configured');
  }

  try {
    const response = await fetch(`${CLOUDFLARE_SFU_URL}/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${roomId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
      }
    });

    if (!response.ok) {
      console.warn(`Failed to delete SFU room: ${response.statusText}`);
    }

    return response.ok;
  } catch (error) {
    console.error('Error deleting SFU room:', error);
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
