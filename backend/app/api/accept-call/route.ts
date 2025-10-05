import { NextRequest, NextResponse } from 'next/server';
import { generateCloudflareSFUToken, getSFURoom } from '../../../lib/cloudflare-sfu';
import { publishToChannel } from '../../../lib/centrifugo';

export async function POST(request: NextRequest) {
  try {
    const { roomId, userId, conversationId } = await request.json();

    // Get origin for CORS
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (!roomId || !userId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required parameters: roomId, userId, conversationId' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Check if room exists
    const room = await getSFURoom(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Call room not found or expired' },
        { 
          status: 404,
          headers: corsHeaders
        }
      );
    }

    // Generate JWT token for the user
    const userToken = generateCloudflareSFUToken(userId, roomId);

    // Notify caller that call was accepted
    await publishToChannel(`call:${roomId}`, {
      type: 'call_accepted',
      userId: userId,
      conversationId: conversationId,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      roomId,
      token: userToken.token,
      expires: userToken.expires
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error accepting call:', error);
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    return NextResponse.json(
      { error: 'Failed to accept call', details: error instanceof Error ? error.message : 'Unknown error' },
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
