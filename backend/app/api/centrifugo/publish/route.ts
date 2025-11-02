import { NextRequest, NextResponse } from 'next/server';
const { publishToChannel } = require('../../../../lib/centrifugo');

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://vixter.com.br',
    'https://www.vixter.com.br',
    'https://vixter-react.vercel.app',
    'https://vixter-react-llyd.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowedOrigins.includes(origin || '') ? (origin || '*') : '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  return new NextResponse(null, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  // Add CORS headers to response
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://vixter.com.br',
    'https://www.vixter.com.br',
    'https://vixter-react.vercel.app',
    'https://vixter-react-llyd.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowedOrigins.includes(origin || '') ? (origin || '*') : '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');

  try {
    const { channel, data } = await request.json();

    if (!channel || !data) {
    return NextResponse.json(
      { error: 'Channel and data are required' },
      { status: 400, headers }
    );
    }

    // Publish message to Centrifugo channel
    const result = await publishToChannel(channel, data);

    return NextResponse.json({
      success: true,
      result,
    }, { headers });
  } catch (error) {
    console.error('Error publishing to Centrifugo:', error);
    return NextResponse.json(
      { error: 'Failed to publish message' },
      { status: 500, headers }
    );
  }
}
