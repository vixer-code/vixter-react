import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    console.log('Stream endpoint called:', request.url);
    
    const { searchParams } = new URL(request.url);
    const packId = searchParams.get('packId');
    const orderId = searchParams.get('orderId');
    const contentKey = searchParams.get('contentKey');
    const username = searchParams.get('username');
    const token = searchParams.get('token');

    console.log('Parameters:', { packId, orderId, contentKey, username, token: token ? 'present' : 'missing' });

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
    
    // Ensure contentKey has the correct format for R2
    const formattedContentKey = contentKey.startsWith('pack-content/') 
      ? contentKey 
      : `pack-content/${contentKey}`;
    
    const params = new URLSearchParams({
      packId,
      orderId,
      contentKey: formattedContentKey,
      username,
      token
    });

    console.log('Calling Cloud Function:', `${cloudFunctionUrl}?${params.toString()}`);
    
    // For now, let's try without service-to-service auth since the function is public
    const cloudFunctionResponse = await fetch(`${cloudFunctionUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-Serverless-Authorization': `Bearer ${token}` // Pass user token for validation
      }
    });

    console.log('Cloud Function response status:', cloudFunctionResponse.status);

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
