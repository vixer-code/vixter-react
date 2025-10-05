import { NextRequest, NextResponse } from 'next/server';
import { generateCloudflareSFUToken, createSFURoom, generateCallRoomId } from '../../../lib/cloudflare-sfu';
import { publishToChannel } from '../../../lib/centrifugo';

export async function POST(request: NextRequest) {
  try {
    const { conversationId, callerId, calleeId } = await request.json();

    if (!conversationId || !callerId || !calleeId) {
      return NextResponse.json(
        { error: 'Missing required parameters: conversationId, callerId, calleeId' },
        { status: 400 }
      );
    }

    // Generate unique room ID for this call
    const roomId = generateCallRoomId(conversationId);
    
    // Create SFU room
    await createSFURoom(roomId, [callerId, calleeId]);

    // Generate JWT token for the caller
    const callerToken = generateCloudflareSFUToken(callerId, roomId);
    
    // Generate JWT token for the callee
    const calleeToken = generateCloudflareSFUToken(calleeId, roomId);

    // Send call invitation via Centrifugo
    await publishToChannel(`user:${calleeId}`, {
      type: 'call_invite',
      room: roomId,
      from: callerId,
      conversationId: conversationId,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      roomId,
      callerToken: callerToken.token,
      calleeToken: calleeToken.token,
      expires: callerToken.expires
    });

  } catch (error) {
    console.error('Error starting call:', error);
    return NextResponse.json(
      { error: 'Failed to start call', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
