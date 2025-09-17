import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { db } from '@/lib/firebase-admin';
import { doc, getDoc } from 'firebase/firestore';

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

    // Verify pack order exists and user has access
    const orderRef = doc(db, 'packOrders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return new Response(
        JSON.stringify({ error: 'Pack order not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    const orderData = orderSnap.data();

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
    const packRef = doc(db, 'packs', packId);
    const packSnap = await getDoc(packRef);

    if (!packSnap.exists()) {
      return new Response(
        JSON.stringify({ error: 'Pack not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    const packData = packSnap.data();

    // Get vendor info for watermarking
    const vendorId = packData.authorId || packData.creatorId;
    let vendorInfo = {
      vendorId,
      vendorUsername: 'vendor'
    };

    if (vendorId) {
      try {
        const vendorRef = doc(db, 'users', vendorId);
        const vendorSnap = await getDoc(vendorRef);
        if (vendorSnap.exists()) {
          const vendorData = vendorSnap.data();
          vendorInfo.vendorUsername = vendorData.username || 'vendor';
        }
      } catch (error) {
        console.warn('Error loading vendor info:', error);
      }
    }

    // Generate secure URLs for each content item via Cloud Function
    const cloudFunctionUrl = 'https://packcontentaccess-6twxbx5ima-ue.a.run.app';
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
            token: await user.getIdToken()
          });
          
          contentWithUrls.push({
            ...contentItem,
            secureUrl: `${cloudFunctionUrl}?${params.toString()}`
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
            token: await user.getIdToken()
          });
          
          contentWithUrls.push({
            ...contentItem,
            secureUrl: `${cloudFunctionUrl}?${params.toString()}`
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
