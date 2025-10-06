import { NextRequest, NextResponse } from 'next/server';
import { generateCloudflareSFUToken } from '../../../lib/cloudflare-sfu';

export async function POST(request: NextRequest) {
  try {
    console.log('🚪 Join call API called');
    const { roomId, userId, conversationId } = await request.json();
    console.log('🚪 Request data:', { roomId, userId, conversationId });

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

    // Generate JWT token for the user joining
    const userToken = generateCloudflareSFUToken(userId, roomId);
    console.log('✅ User token generated for joining');

    const response = {
      success: true,
      roomId,
      token: userToken.token,
      expires: userToken.expires
    };
    
    console.log('🚪 Returning response:', { ...response, token: '[REDACTED]' });
    return NextResponse.json(response, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error joining call:', error);
    const origin = request.headers.get('origin') || 'https://vixter-react.vercel.app';
    const allowedOrigins = ['https://vixter-react.vercel.app', 'https://vixter.com.br'];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://vixter-react.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    return NextResponse.json(
      { error: 'Failed to join call', details: error instanceof Error ? error.message : 'Unknown error' },
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
