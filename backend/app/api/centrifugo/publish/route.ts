import { NextRequest, NextResponse } from 'next/server';
import { publishToChannel } from '../../../../backend/lib/centrifugo';

export async function POST(request: NextRequest) {
  try {
    const { channel, data } = await request.json();

    if (!channel || !data) {
      return NextResponse.json(
        { error: 'Channel and data are required' },
        { status: 400 }
      );
    }

    // Publish message to Centrifugo channel
    const result = await publishToChannel(channel, data);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error publishing to Centrifugo:', error);
    return NextResponse.json(
      { error: 'Failed to publish message' },
      { status: 500 }
    );
  }
}
