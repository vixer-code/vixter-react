import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

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

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { packId, orderId, userId } = body;

    // Validate required fields
    if (!packId || !orderId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: packId, orderId, userId' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Verify user is requesting their own data
    if (user.uid !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User ID mismatch' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Get the Firebase ID token from the request
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1] || '';

    // Verify pack order exists and user has access
    const orderRef = db.collection('packOrders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return new Response(
        JSON.stringify({ error: 'Pack order not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    const orderData = orderSnap.data();
    if (!orderData) {
      return new Response(
        JSON.stringify({ error: 'Pack order data not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Verify order belongs to user and is for the correct pack
    if (orderData.buyerId !== userId || orderData.packId !== packId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Order does not belong to user or pack mismatch' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Verify order is completed/approved (not pending)
    if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
      return new Response(
        JSON.stringify({ error: 'Pack order not completed or approved yet' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Get pack data with full content
    const packRef = db.collection('packs').doc(packId);
    const packSnap = await packRef.get();

    if (!packSnap.exists) {
      return new Response(
        JSON.stringify({ error: 'Pack not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    const packData = packSnap.data();
    if (!packData) {
      return new Response(
        JSON.stringify({ error: 'Pack data not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Get vendor info for watermarking
    const vendorId = packData.authorId || packData.creatorId;
    let vendorInfo = {
      vendorId,
      vendorUsername: 'vendor'
    };

    if (vendorId) {
      try {
        const vendorRef = db.collection('users').doc(vendorId);
        const vendorSnap = await vendorRef.get();
        if (vendorSnap.exists) {
          const vendorData = vendorSnap.data();
          if (vendorData) {
            vendorInfo.vendorUsername = vendorData.username || 'vendor';
          }
        }
      } catch (error) {
        console.warn('Error loading vendor info:', error);
      }
    }

    // Generate secure URLs for each content item via Backend Proxy
    const backendUrl = 'https://vixter-react-llyd.vercel.app';
    const contentWithUrls = [];

    // Process packContent
    if (packData.packContent && Array.isArray(packData.packContent)) {
      for (const contentItem of packData.packContent) {
        if (contentItem.key) {
          const params = new URLSearchParams({
            packId,
            orderId,
            contentKey: contentItem.key,
            username: user.email?.split('@')[0] || 'user',
            token: token
          });
          
          contentWithUrls.push({
            ...contentItem,
            secureUrl: `${backendUrl}/api/pack-content/stream?${params.toString()}`
          });
        }
      }
    }

    // Process content (legacy field)
    if (packData.content && Array.isArray(packData.content)) {
      for (const contentItem of packData.content) {
        if (contentItem.key) {
          const params = new URLSearchParams({
            packId,
            orderId,
            contentKey: contentItem.key,
            username: user.email?.split('@')[0] || 'user',
            token: token
          });
          
          contentWithUrls.push({
            ...contentItem,
            secureUrl: `${backendUrl}/api/pack-content/stream?${params.toString()}`
          });
        }
      }
    }

    // Return secure pack data with pre-generated URLs
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: packId,
          title: packData.title || 'Pack',
          coverImage: packData.coverImage,
          description: packData.description,
          price: packData.price,
          category: packData.category,
          contentWithUrls, // Pre-generated secure URLs
          vendorInfo
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  } catch (error) {
    console.error('Error loading secure pack data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load secure pack data' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  }
});
