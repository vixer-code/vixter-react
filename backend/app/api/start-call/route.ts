import { NextRequest, NextResponse } from 'next/server';
import { generateCloudflareSFUToken, createSFURoom, generateCallRoomId } from '../../../lib/cloudflare-sfu';
import { publishToChannel } from '../../../lib/centrifugo';

export async function POST(request: NextRequest) {
  try {
    console.log('📞 Start call API called');
    const { conversationId, callerId, calleeId, callType = 'video' } = await request.json();
    console.log('📞 Request data:', { conversationId, callerId, calleeId, callType });

    // Get origin for CORS
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (!conversationId || !callerId || !calleeId) {
      console.error('❌ Missing required parameters');
      return NextResponse.json(
        { error: 'Missing required parameters: conversationId, callerId, calleeId' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Generate unique room ID for this call
    const roomId = generateCallRoomId(conversationId);
    console.log('📞 Generated room ID:', roomId);
    
    // Create SFU room
    console.log('📞 Creating SFU room...');
    await createSFURoom(roomId, [callerId, calleeId]);
    console.log('✅ SFU room created');

    // Generate JWT token for the caller
    const callerToken = generateCloudflareSFUToken(callerId, roomId);
    console.log('✅ Caller token generated');
    
    // Generate JWT token for the callee
    const calleeToken = generateCloudflareSFUToken(calleeId, roomId);
    console.log('✅ Callee token generated');

    // Send call invitation via Centrifugo
    console.log('📞 Sending invitation via Centrifugo...');
    await publishToChannel(`user:${calleeId}`, {
      type: 'call_invite',
      room: roomId,
      from: callerId,
      conversationId: conversationId,
      callType: callType,
      timestamp: Date.now()
    });
    console.log('✅ Invitation sent');

    const response = {
      success: true,
      roomId,
      callerToken: callerToken.token,
      calleeToken: calleeToken.token,
      expires: callerToken.expires,
      callType
    };
    
    console.log('📞 Returning response:', { ...response, callerToken: '[REDACTED]', calleeToken: '[REDACTED]' });
    return NextResponse.json(response, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error starting call:', error);
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    return NextResponse.json(
      { error: 'Failed to start call', details: error instanceof Error ? error.message : 'Unknown error' },
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
