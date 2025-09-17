import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getFirestore()) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const packId = searchParams.get('packId');
    const orderId = searchParams.get('orderId');
    const contentKey = searchParams.get('contentKey');
    const username = searchParams.get('username');
    const token = searchParams.get('token');

    if (!packId || !orderId || !contentKey || !username || !token) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify user access
    const accessResult = await verifyUserAccess(token, packId, orderId, username);
    if (!accessResult) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Call Cloud Function to get watermarked content
    const cloudFunctionUrl = 'https://packcontentaccess-6twxbx5ima-ue.a.run.app';
    const params = new URLSearchParams({
      packId,
      orderId,
      contentKey,
      username,
      token
    });

    const cloudFunctionResponse = await fetch(`${cloudFunctionUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!cloudFunctionResponse.ok) {
      throw new Error(`Cloud Function error: ${cloudFunctionResponse.status}`);
    }

    // Get the content type and data
    const contentType = cloudFunctionResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLength = cloudFunctionResponse.headers.get('content-length');
    const contentData = await cloudFunctionResponse.arrayBuffer();

    // Determine if it's a video for proper streaming headers
    const isVideo = contentType.startsWith('video/');
    const isAudio = contentType.startsWith('audio/');
    const isImage = contentType.startsWith('image/');

    // Set appropriate headers based on content type
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Range'
    };

    // Add content length if available
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // Add video-specific headers for proper streaming
    if (isVideo) {
      headers['Accept-Ranges'] = 'bytes';
      headers['Content-Disposition'] = 'inline';
    }

    // Add audio-specific headers
    if (isAudio) {
      headers['Accept-Ranges'] = 'bytes';
      headers['Content-Disposition'] = 'inline';
    }

    // Add image-specific headers
    if (isImage) {
      headers['Content-Disposition'] = 'inline';
    }

    // Return the content with proper headers
    return new NextResponse(contentData, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error streaming pack content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function verifyUserAccess(token: string, packId: string, orderId: string, username: string) {
  try {
    // Verify Firebase ID token
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user has a valid pack order for this pack
    const packOrderQuery = db.collection('packOrders')
      .where('buyerId', '==', userId)
      .where('packId', '==', packId);

    const packOrders = await packOrderQuery.get();

    if (packOrders.empty) {
      return null;
    }

    // Check if any order has valid status
    const validOrders = packOrders.docs.filter(doc => {
      const status = doc.data().status;
      return ['COMPLETED', 'CONFIRMED', 'AUTO_RELEASED', 'APPROVED'].includes(status);
    });

    if (validOrders.length === 0) {
      return null;
    }

    return {
      userId,
      username: decodedToken.email?.split('@')[0] || username,
      packOrder: validOrders[0].id
    };

  } catch (error) {
    console.error('Error verifying user access:', error);
    return null;
  }
}
