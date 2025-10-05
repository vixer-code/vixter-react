import { NextRequest, NextResponse } from 'next/server';
import { deleteSFURoom } from '../../../lib/cloudflare-sfu';
import { publishToChannel } from '../../../lib/centrifugo';

export async function POST(request: NextRequest) {
  try {
    const { roomId, userId, conversationId } = await request.json();

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: roomId, userId' },
        { status: 400 }
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
    });

  } catch (error) {
    console.error('Error ending call:', error);
    return NextResponse.json(
      { error: 'Failed to end call', details: error.message },
      { status: 500 }
    );
  }
}
