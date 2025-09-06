import { NextRequest, NextResponse } from 'next/server';
const { publishToChannel } = require('../../../../lib/centrifugo');

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
