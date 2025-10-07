import { NextRequest, NextResponse } from 'next/server';
import { generateCloudflareSFUToken, getSFURoom, getRealtimeAuthToken } from '../../../../../lib/cloudflare-sfu.js';
import { publishToChannel } from '../../../../../lib/centrifugo.js';

export async function POST(request: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const { roomId } = params;
    console.log('🚪 Room join API called for room:', roomId);
    
    const { userId, conversationId, role = 'participant', accountType } = await request.json();
    console.log('🚪 Request data:', { userId, conversationId, role, accountType });

    // Get origin for CORS
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (!roomId || !userId || !conversationId) {
      console.error('❌ Missing required parameters');
      return NextResponse.json(
        { error: 'Missing required parameters: roomId, userId, conversationId' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Get or create room
    const room = await getSFURoom(roomId);
    console.log('🏠 Room info:', room);

    // Determine preset based on accountType
    // Provider = host, Client = participant
    const presetName = accountType === 'provider' ? 'group_call_host' : 'group_call_participant';
    console.log(`🎭 User preset: ${presetName} (accountType: ${accountType})`);

    // Generate authToken using the correct Realtime API flow
    console.log('🔑 Using Realtime API to get authToken...');
    const authTokenData = await getRealtimeAuthToken(userId, roomId, presetName);
    console.log('✅ Realtime authToken obtained successfully');

    // Prepare Centrifugo room metadata
    const roomMetadata = {
      roomId,
      role,
      publishPermissions: ['publish', 'subscribe'],
      participants: room.participants || [],
      createdAt: new Date().toISOString(),
      meetingId: authTokenData.meetingId
    };

    // Notify other participants about new user joining
    await publishToChannel(`room:${roomId}`, {
      type: 'participant-join',
      userId,
      role,
      timestamp: Date.now()
    });
    console.log('✅ Participant join notification sent');

    const response = {
      success: true,
      roomId,
      token: authTokenData.token,
      expires: authTokenData.expires,
      role,
      capabilities: ['publish', 'subscribe'],
      roomMetadata,
      meetingId: authTokenData.meetingId,
      // Realtime configuration
      realtimeConfig: {
        meetingId: authTokenData.meetingId,
        roomId: roomId,
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    };
    
    console.log('🚪 Returning response:', { 
      ...response, 
      token: '[REDACTED]',
      realtimeConfig: { ...response.realtimeConfig }
    });
    
    return NextResponse.json(response, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error joining room:', error);
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    return NextResponse.json(
      { error: 'Failed to join room', details: error instanceof Error ? error.message : 'Unknown error' },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
  const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
