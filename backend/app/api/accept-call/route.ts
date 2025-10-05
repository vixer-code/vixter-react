import { NextRequest, NextResponse } from 'next/server';
import { generateCloudflareSFUToken, getSFURoom } from '../../../lib/cloudflare-sfu';
import { publishToChannel } from '../../../lib/centrifugo';

export async function POST(request: NextRequest) {
  try {
    const { roomId, userId, conversationId } = await request.json();

    if (!roomId || !userId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required parameters: roomId, userId, conversationId' },
        { status: 400 }
      );
    }

    // Check if room exists
    const room = await getSFURoom(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Call room not found or expired' },
        { status: 404 }
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
    });

  } catch (error) {
    console.error('Error accepting call:', error);
    return NextResponse.json(
      { error: 'Failed to accept call', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
