import { NextRequest, NextResponse } from 'next/server';
const { getCentrifugoConnectionInfo } = require('../../../../lib/centrifugo');

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Generate Centrifugo token for the user
    const connectionInfo = getCentrifugoConnectionInfo(userId);

    return NextResponse.json({
      token: connectionInfo.token,
      user: connectionInfo.user,
      expires: connectionInfo.expires,
    });
  } catch (error) {
    console.error('Error generating Centrifugo token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}