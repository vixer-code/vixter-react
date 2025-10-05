import { NextRequest, NextResponse } from 'next/server';
import { deleteSFURoom } from '../../../lib/cloudflare-sfu';
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

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: roomId, userId' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Notify all participants that call ended
    await publishToChannel(`call:${roomId}`, {
      type: 'call_ended',
      userId: userId,
      conversationId: conversationId,
      timestamp: Date.now()
    });

    // Delete SFU room
    await deleteSFURoom(roomId);

    return NextResponse.json({
      success: true,
      message: 'Call ended successfully'
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error ending call:', error);
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    return NextResponse.json(
      { error: 'Failed to end call', details: error instanceof Error ? error.message : 'Unknown error' },
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
