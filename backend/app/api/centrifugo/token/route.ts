import { NextRequest, NextResponse } from 'next/server';
const { getCentrifugoConnectionInfo } = require('../../../../lib/centrifugo');

export async function POST(request: NextRequest) {
  // Enable CORS
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers });
  }

  try {
    const { userId } = await request.json();

    if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400, headers }
    );
    }

    // Generate Centrifugo token for the user
    const connectionInfo = getCentrifugoConnectionInfo(userId);

    return NextResponse.json({
      token: connectionInfo.token,
      user: connectionInfo.user,
      expires: connectionInfo.expires,
    }, { headers });
  } catch (error) {
    console.error('Error generating Centrifugo token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500, headers }
    );
  }
}