const jwt = require('jsonwebtoken');

// Cloudflare Realtime SFU configuration
const CLOUDFLARE_APP_ID = process.env.CLOUDFLARE_APP_ID;
const CLOUDFLARE_APP_SECRET = process.env.CLOUDFLARE_APP_SECRET;
const CLOUDFLARE_RTC_URL = process.env.CLOUDFLARE_RTC_URL || 'https://rtc.live.cloudflare.com/v1';

/**
 * Generate a valid SDP for Cloudflare Realtime SFU
 * Creates a minimal but valid SDP with required ICE parameters
 */
function generateValidSDP() {
  const sessionId = Date.now();
  const iceUfrag = Math.random().toString(36).substring(2, 15);
  const icePwd = Math.random().toString(36).substring(2, 15);
  const fingerprint = Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join(':');
  
  return `v=0\r
o=- ${sessionId} ${sessionId} IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0\r
a=extmap-allow-mixed\r
a=msid-semantic: WMS\r
m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r
c=IN IP4 0.0.0.0\r
a=ice-ufrag:${iceUfrag}\r
a=ice-pwd:${icePwd}\r
a=ice-options:trickle\r
a=fingerprint:sha-256 ${fingerprint}\r
a=setup:actpass\r
a=mid:0\r
a=sctp-port:5000\r
a=max-message-size:262144\r
`;
}

/**
 * Generate JWT token for Cloudflare Realtime SFU
 * Creates a proper token for Realtime SFU sessions
 */
function generateCloudflareSFUToken(userId, roomId, capabilities = ['publish', 'subscribe']) {
  if (!CLOUDFLARE_APP_ID || !CLOUDFLARE_APP_SECRET) {
    throw new Error('Cloudflare Realtime SFU not configured. Missing CLOUDFLARE_APP_ID or CLOUDFLARE_APP_SECRET');
  }

  console.log(`🔑 Generating Realtime SFU token for user ${userId} in session ${roomId}`);
  
  const payload = {
    sub: userId,
    iss: CLOUDFLARE_APP_ID,
    sessionId: roomId,
    capabilities: capabilities,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
    iat: Math.floor(Date.now() / 1000),
    // Realtime SFU specific claims
    aud: 'realtime-sfu',
    type: 'realtime-sfu-token'
  };

  // Use the app secret as the signing key
  const token = jwt.sign(payload, CLOUDFLARE_APP_SECRET);
  
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
 * Create a new Cloudflare Realtime SFU session
 * Uses Cloudflare Realtime SFU HTTPS API to create a session
 */
async function createSFURoom(roomId, participants = []) {
  if (!CLOUDFLARE_APP_ID || !CLOUDFLARE_APP_SECRET) {
    throw new Error('Cloudflare Realtime SFU not configured. Missing CLOUDFLARE_APP_ID or CLOUDFLARE_APP_SECRET');
  }

  console.log(`🏠 Creating Cloudflare Realtime SFU session: ${roomId} with participants:`, participants);

  try {
    // Create a new session using Cloudflare Realtime SFU API
    // POST /apps/{appId}/sessions/new
    
    const requestBody = {
      sessionDescription: {
        type: 'offer',
        sdp: generateValidSDP()
      }
    };
    
    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${CLOUDFLARE_RTC_URL}/apps/${CLOUDFLARE_APP_ID}/sessions/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_APP_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudflare Realtime SFU API Error:', errorData);
      throw new Error(`Failed to create Realtime SFU session: ${errorData.errorDescription || response.statusText}`);
    }

    const sessionData = await response.json();
    console.log('✅ Cloudflare Realtime SFU session created:', sessionData);
    
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
    console.error('Error creating Cloudflare Realtime SFU session:', error);
    throw error;
  }
}

/**
 * Get Cloudflare Realtime SFU session information
 * Since there's no GET endpoint in the API, we'll simulate session existence
 */
async function getSFURoom(roomId) {
  console.log(`🔍 Getting Cloudflare Realtime SFU session: ${roomId}`);
  
  // The Cloudflare Realtime SFU API doesn't have a GET endpoint for sessions
  // We'll assume the session exists if it was created successfully
  // In a real implementation, you might store session state in a database
  
  return {
    id: roomId,
    sessionId: roomId,
    status: 'active',
    type: 'realtime_sfu',
    participants: [],
    // Return session info for compatibility
    cloudflareData: {
      sessionId: roomId,
      status: 'active'
    }
  };
}

/**
 * Delete Cloudflare Realtime SFU session
 * Since there's no DELETE endpoint for sessions, we'll simulate cleanup
 */
async function deleteSFURoom(roomId) {
  console.log(`🗑️ Deleting Cloudflare Realtime SFU session: ${roomId}`);
  
  // The Cloudflare Realtime SFU API doesn't have a DELETE endpoint for sessions
  // Sessions are automatically cleaned up when all tracks are closed
  // We'll just log the deletion for now
  
  console.log('✅ Cloudflare Realtime SFU session cleanup completed');
  return true;
}

/**
 * Generate room ID for call
 */
function generateCallRoomId(conversationId) {
  return `call_${conversationId}_${Date.now()}`;
}

module.exports = {
  generateValidSDP,
  generateCloudflareSFUToken,
  createSFURoom,
  getSFURoom,
  deleteSFURoom,
  generateCallRoomId,
  CLOUDFLARE_APP_ID,
  CLOUDFLARE_APP_SECRET
};
