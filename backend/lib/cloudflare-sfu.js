const jwt = require('jsonwebtoken');

// Cloudflare Realtime SFU configuration
const CLOUDFLARE_APP_ID = process.env.CLOUDFLARE_APP_ID;
const CLOUDFLARE_APP_SECRET = process.env.CLOUDFLARE_APP_SECRET;
const CLOUDFLARE_RTC_URL = process.env.CLOUDFLARE_RTC_URL || 'https://rtc.live.cloudflare.com/v1';

// Cloudflare Realtime API configuration
const CLOUDFLARE_REST_API_AUTH_HEADER = process.env.CLOUDFLARE_REST_API_AUTH_HEADER;
const REALTIME_API_BASE = 'https://api.realtime.cloudflare.com/v2';

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
 * Create a meeting using Cloudflare Realtime REST API
 * This is the correct way to create meetings according to the official docs
 */
async function createRealtimeMeeting(roomId) {
  if (!CLOUDFLARE_REST_API_AUTH_HEADER) {
    throw new Error('Cloudflare Realtime API not configured. Missing CLOUDFLARE_REST_API_AUTH_HEADER');
  }

  console.log(`🏠 Creating Realtime meeting for room: ${roomId}`);

  const response = await fetch(`${REALTIME_API_BASE}/meetings`, {
    method: 'POST',
    headers: {
      'Authorization': CLOUDFLARE_REST_API_AUTH_HEADER,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: roomId,
      // Omit preferred_region to use default
      persist_chat: true,
      summarize_on_end: false,
      record_on_start: false,
      live_stream_on_start: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Failed to create meeting: ${response.status} - ${errorText}`);
    throw new Error(`Failed to create meeting: ${response.status} - ${errorText}`);
  }

  const meeting = await response.json();
  console.log(`✅ Meeting created successfully:`, meeting);
  return meeting;
}

/**
 * Join a participant to an active session
 * @param {string} meetingId - The meeting ID
 * @param {string} userId - The user ID
 * @param {string} authToken - The participant's auth token
 */
async function joinParticipantToSession(meetingId, userId, authToken) {
  if (!CLOUDFLARE_REST_API_AUTH_HEADER) {
    throw new Error('Cloudflare Realtime API not configured. Missing CLOUDFLARE_REST_API_AUTH_HEADER');
  }

  console.log(`🎯 Joining participant ${userId} to active session of meeting ${meetingId}`);

  try {
    // Get active sessions for the meeting
    const sessionsResponse = await fetch(`${REALTIME_API_BASE}/meetings/${meetingId}/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': CLOUDFLARE_REST_API_AUTH_HEADER,
        'Content-Type': 'application/json'
      }
    });

    if (!sessionsResponse.ok) {
      const errorText = await sessionsResponse.text();
      console.error(`❌ Failed to get sessions: ${sessionsResponse.status} - ${errorText}`);
      throw new Error(`Failed to get sessions: ${sessionsResponse.status} - ${errorText}`);
    }

    const sessions = await sessionsResponse.json();
    console.log(`🔍 Available sessions:`, sessions);

    // Find active session
    let activeSession = sessions.data?.find(session => session.status === 'LIVE' || session.status === 'ACTIVE');
    
    if (!activeSession) {
      console.log(`⚠️ No active session found, creating new session...`);
      
      // Create a new session for the meeting
      const createSessionResponse = await fetch(`${REALTIME_API_BASE}/meetings/${meetingId}/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': CLOUDFLARE_REST_API_AUTH_HEADER,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Session for ${meetingId}`,
          // Add any session configuration here if needed
        })
      });

      if (!createSessionResponse.ok) {
        const errorText = await createSessionResponse.text();
        console.error(`❌ Failed to create session: ${createSessionResponse.status} - ${errorText}`);
        throw new Error(`Failed to create session: ${createSessionResponse.status} - ${errorText}`);
      }

      const newSession = await createSessionResponse.json();
      console.log(`✅ New session created: ${newSession.data?.id}`);
      
      // Use the newly created session
      activeSession = newSession.data;
    }

    console.log(`🎯 Found active session: ${activeSession.id}, joining participant...`);

    // Join the participant to the active session
    const joinResponse = await fetch(`${REALTIME_API_BASE}/meetings/${meetingId}/sessions/${activeSession.id}/participants`, {
      method: 'POST',
      headers: {
        'Authorization': CLOUDFLARE_REST_API_AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        participant_id: userId,
        auth_token: authToken
      })
    });

    if (!joinResponse.ok) {
      const errorText = await joinResponse.text();
      console.error(`❌ Failed to join session: ${joinResponse.status} - ${errorText}`);
      throw new Error(`Failed to join session: ${joinResponse.status} - ${errorText}`);
    }

    const joinResult = await joinResponse.json();
    console.log(`✅ Participant joined session successfully:`, joinResult);
    return joinResult;

  } catch (error) {
    console.error(`❌ Error joining participant to session:`, error);
    // Don't throw - this is not critical for the auth token flow
    console.log(`⚠️ Continuing without session join - participant will join when frontend connects`);
  }
}

/**
 * Add a participant to a meeting and get authToken
 * This returns the authToken needed for the frontend
 * 
 * @param {string} meetingId - The meeting ID
 * @param {string} userId - The user ID
 * @param {string} roomId - The room ID
 * @param {string} presetName - The preset name (group_call_host or group_call_participant)
 */
async function addParticipantToMeeting(meetingId, userId, roomId, presetName = 'group_call_participant') {
  if (!CLOUDFLARE_REST_API_AUTH_HEADER) {
    throw new Error('Cloudflare Realtime API not configured. Missing CLOUDFLARE_REST_API_AUTH_HEADER');
  }

  console.log(`👤 Adding participant ${userId} to meeting ${meetingId} with preset: ${presetName}`);

  const response = await fetch(`${REALTIME_API_BASE}/meetings/${meetingId}/participants`, {
    method: 'POST',
    headers: {
      'Authorization': CLOUDFLARE_REST_API_AUTH_HEADER,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      custom_participant_id: userId, // Use Firebase UID as custom participant ID
      preset_name: presetName
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Failed to add participant: ${response.status} - ${errorText}`);
    throw new Error(`Failed to add participant: ${response.status} - ${errorText}`);
  }

  const participant = await response.json();
  console.log(`✅ Participant added successfully:`, participant);
  return participant;
}

// Simple in-memory cache for active meetings
// In production, use Redis or database
const activeMeetings = new Map();

/**
 * Check if a meeting exists for the given roomId
 * @param {string} roomId - The room ID to check
 * @returns {Object|null} - Meeting data if exists, null otherwise
 */
async function checkExistingMeeting(roomId) {
  try {
    console.log(`🔍 Checking for existing meeting with roomId: ${roomId}`);
    
    // Check our cache first (for same server instance)
    const cachedMeeting = activeMeetings.get(roomId);
    if (cachedMeeting) {
      console.log(`🔍 Found cached meeting: ${cachedMeeting.id}`);
      return cachedMeeting;
    }
    
    // Also check Cloudflare API for existing meetings
    console.log(`🔍 Checking Cloudflare API for existing meetings...`);
    try {
      const meetingsResponse = await fetch(`${REALTIME_API_BASE}/meetings`, {
        method: 'GET',
        headers: {
          'Authorization': CLOUDFLARE_REST_API_AUTH_HEADER,
          'Content-Type': 'application/json'
        }
      });

      if (meetingsResponse.ok) {
        const meetings = await meetingsResponse.json();
        console.log(`🔍 Found ${meetings.data?.length || 0} meetings in Cloudflare`);
        
        // Look for meeting with matching title (roomId)
        const existingMeeting = meetings.data?.find(meeting => 
          meeting.title && meeting.title.includes(roomId)
        );
        
        if (existingMeeting) {
          console.log(`🔍 Found existing meeting in Cloudflare: ${existingMeeting.id}`);
          console.log(`🔍 Meeting title: ${existingMeeting.title}`);
          
          // Cache it for future requests
          cacheMeeting(roomId, existingMeeting.id);
          
          return {
            id: existingMeeting.id,
            roomId: roomId,
            title: existingMeeting.title,
            status: existingMeeting.status
          };
        }
      }
    } catch (apiError) {
      console.log(`🔍 Error checking Cloudflare API: ${apiError.message}`);
    }
    
    console.log(`🔍 No existing meeting found for roomId: ${roomId}`);
    return null;
  } catch (error) {
    console.log(`🔍 Error checking existing meeting: ${error.message}`);
    return null;
  }
}

/**
 * Cache a meeting for future lookups
 * @param {string} roomId - The room ID
 * @param {string} meetingId - The meeting ID
 */
function cacheMeeting(roomId, meetingId) {
  activeMeetings.set(roomId, {
    id: meetingId,
    roomId: roomId,
    createdAt: new Date().toISOString()
  });
  console.log(`💾 Cached meeting ${meetingId} for roomId: ${roomId}`);
}

/**
 * Get authToken using the correct Cloudflare Realtime API flow
 * Implements Meeting/Session concept:
 * - Meeting: Persistent container (created once per conversation)
 * - Session: Live instance (shared by all participants)
 * 
 * @param {string} userId - The user ID
 * @param {string} roomId - The room ID
 * @param {string} presetName - The preset name (group_call_host or group_call_participant)
 */
async function getRealtimeAuthToken(userId, roomId, presetName = 'group_call_participant') {
  try {
    console.log(`🔑 Getting Realtime authToken for user ${userId} in room ${roomId} with preset: ${presetName}`);

    // Step 1: Check for existing meeting (persistent container)
    let meetingId;
    let isNewMeeting = false;
    const existingMeeting = await checkExistingMeeting(roomId);
    
    if (existingMeeting) {
      console.log(`🔍 Found existing MEETING: ${existingMeeting.id}`);
      console.log(`🎯 User will join existing SESSION in this meeting`);
      meetingId = existingMeeting.id;
    } else {
      console.log(`🔍 No existing meeting found, creating new MEETING...`);
      console.log(`🎯 User will be the first participant in new SESSION`);
      
      // Step 2: Create meeting (persistent container)
      const meetingResponse = await createRealtimeMeeting(roomId);
      meetingId = meetingResponse.data.id;
      console.log(`🔑 New MEETING ID: ${meetingId}`);
      
      // Cache the new meeting
      cacheMeeting(roomId, meetingId);
      isNewMeeting = true;
    }
    
    // Step 3: Add participant to meeting (this grants access to join sessions)
    console.log(`👤 Adding participant to meeting ${meetingId}...`);
    const participant = await addParticipantToMeeting(meetingId, userId, roomId, presetName);
    
    console.log(`🔍 Participant response structure:`, JSON.stringify(participant, null, 2));
    
    // Step 4: Join the active session (this actually puts participant in the live session)
    console.log(`🎯 Joining participant to active session...`);
    await joinParticipantToSession(meetingId, userId, participant.data?.token || participant.token);
    
    // Step 3: Return the authToken
    // Note: The API returns 'token', not 'auth_token'
    const authToken = participant.data?.token || participant.token;
    
    console.log(`✅ AuthToken obtained successfully`);
    console.log(`🔑 AuthToken type: ${typeof authToken}`);
    console.log(`🔑 AuthToken value: ${authToken}`);
    console.log(`🔑 AuthToken length: ${authToken ? authToken.length : 'undefined'}`);
    console.log(`🔑 AuthToken preview: ${authToken ? authToken.substring(0, 50) + '...' : 'undefined'}`);
    
    if (!authToken) {
      console.error('❌ AuthToken is undefined or null!');
      console.error('❌ Participant data:', participant.data);
      console.error('❌ Participant token:', participant.token);
      throw new Error('Failed to extract authToken from participant response');
    }
    
    return {
      token: authToken,
      meetingId: meetingId,
      roomId,
      userId,
      expires: participant.data?.expires_at || participant.expires_at,
      type: 'realtime-api',
      // Meeting/Session info
      isNewMeeting: isNewMeeting,
      sessionType: isNewMeeting ? 'host' : 'participant'
    };
    
  } catch (error) {
    console.error('❌ Error getting Realtime authToken:', error);
    throw error;
  }
}

/**
 * Generate JWT token for Cloudflare Realtime SFU
 * Creates a proper token for Cloudflare Realtime API authentication
 * Based on official Cloudflare Realtime documentation
 */
function generateCloudflareSFUToken(userId, roomId, capabilities = ['publish', 'subscribe']) {
  if (!CLOUDFLARE_APP_ID || !CLOUDFLARE_APP_SECRET) {
    throw new Error('Cloudflare Realtime not configured. Missing CLOUDFLARE_APP_ID or CLOUDFLARE_APP_SECRET');
  }

  console.log(`🔑 Generating Cloudflare Realtime token for user ${userId} in room ${roomId}`);
  console.log(`🔑 Using APP_ID: ${CLOUDFLARE_APP_ID}`);
  console.log(`🔑 Using APP_SECRET length: ${CLOUDFLARE_APP_SECRET ? CLOUDFLARE_APP_SECRET.length : 'undefined'}`);
  
  const payload = {
    aud: 'realtime',
    iss: CLOUDFLARE_APP_ID,
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iat: Math.floor(Date.now() / 1000),
    // Add room and capabilities
    room: roomId,
    capabilities: capabilities
  };

  console.log(`🔑 JWT Payload:`, JSON.stringify(payload, null, 2));

  // Use the app secret as the signing key
  const token = jwt.sign(payload, CLOUDFLARE_APP_SECRET, { algorithm: 'HS256' });
  
  console.log(`🔑 Generated token length: ${token.length}`);
  console.log(`🔑 Token preview: ${token.substring(0, 50)}...`);
  
  return {
    token,
    roomId,
    userId,
    expires: payload.exp * 1000,
    capabilities,
    type: 'cloudflare-realtime'
  };
}

/**
 * Create a new Cloudflare Realtime room
 * Realtime manages rooms automatically when participants join
 */
async function createSFURoom(roomId, participants = []) {
  if (!CLOUDFLARE_APP_ID || !CLOUDFLARE_APP_SECRET) {
    throw new Error('Cloudflare Realtime not configured. Missing CLOUDFLARE_APP_ID or CLOUDFLARE_APP_SECRET');
  }

  console.log(`🏠 Creating Cloudflare Realtime room: ${roomId} with participants:`, participants);

  try {
    // Realtime creates rooms automatically when participants join
    // We just need to return room information
    console.log('✅ Cloudflare Realtime room ready for participants');
    
    return {
      id: roomId,
      roomId: roomId,
      participants: participants,
      status: 'ready',
      type: 'cloudflare-realtime',
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating Cloudflare Realtime room:', error);
    throw error;
  }
}

/**
 * Get Cloudflare Realtime room information
 * Realtime manages rooms automatically
 */
async function getSFURoom(roomId) {
  console.log(`🔍 Getting Cloudflare Realtime room: ${roomId}`);
  
  // Realtime manages rooms automatically
  // We'll return room info for compatibility
  
  return {
    id: roomId,
    roomId: roomId,
    status: 'active',
    type: 'cloudflare-realtime',
    participants: [],
    // Return room info for compatibility
    cloudflareData: {
      roomId: roomId,
      status: 'active'
    }
  };
}

/**
 * Delete Cloudflare Realtime room
 * Realtime rooms are cleaned up automatically when empty
 */
async function deleteSFURoom(roomId) {
  console.log(`🗑️ Deleting Cloudflare Realtime room: ${roomId}`);
  
  // Realtime rooms are automatically cleaned up when empty
  // We'll just log the deletion for now
  
  console.log('✅ Cloudflare Realtime room cleanup completed');
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
  // New Realtime API functions
  createRealtimeMeeting,
  addParticipantToMeeting,
  getRealtimeAuthToken,
  CLOUDFLARE_APP_ID,
  CLOUDFLARE_APP_SECRET
};
