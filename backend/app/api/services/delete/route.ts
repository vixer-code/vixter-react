import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { renameMedia } from '@/lib/r2';
import admin from '@/lib/firebase-admin';

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const DELETE = async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { serviceId } = body;
    const userId = request.headers.get('X-User-Id');

    // Validate required fields
    if (!serviceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: serviceId' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
        }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user ID' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
        }
      );
    }

    // Get service data to access media files
    const serviceRef = admin.firestore().collection('services').doc(serviceId);
    const serviceDoc = await serviceRef.get();

    if (!serviceDoc.exists) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
        }
      );
    }

    const serviceData = serviceDoc.data();
    
    // Check if user owns the service
    if (serviceData.providerId !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to delete this service' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
        }
      );
    }

    // Rename media files to servicesDeleted/ prefix
    const renamePromises = [];

    // Rename cover image
    if (serviceData.coverImage?.key) {
      const oldKey = serviceData.coverImage.key;
      const newKey = `servicesDeleted/${serviceId}/${oldKey.split('/').pop()}`;
      renamePromises.push(renameMedia(oldKey, newKey));
    }

    // Rename sample images
    if (serviceData.sampleImages && Array.isArray(serviceData.sampleImages)) {
      for (const image of serviceData.sampleImages) {
        if (image.key) {
          const oldKey = image.key;
          const newKey = `servicesDeleted/${serviceId}/${oldKey.split('/').pop()}`;
          renamePromises.push(renameMedia(oldKey, newKey));
        }
      }
    }

    // Rename sample videos
    if (serviceData.sampleVideos && Array.isArray(serviceData.sampleVideos)) {
      for (const video of serviceData.sampleVideos) {
        if (video.key) {
          const oldKey = video.key;
          const newKey = `servicesDeleted/${serviceId}/${oldKey.split('/').pop()}`;
          renamePromises.push(renameMedia(oldKey, newKey));
        }
      }
    }

    // Rename showcase photos
    if (serviceData.showcasePhotosURLs && Array.isArray(serviceData.showcasePhotosURLs)) {
      for (const photo of serviceData.showcasePhotosURLs) {
        if (photo.key) {
          const oldKey = photo.key;
          const newKey = `servicesDeleted/${serviceId}/${oldKey.split('/').pop()}`;
          renamePromises.push(renameMedia(oldKey, newKey));
        }
      }
    }

    // Rename showcase videos
    if (serviceData.showcaseVideosURLs && Array.isArray(serviceData.showcaseVideosURLs)) {
      for (const video of serviceData.showcaseVideosURLs) {
        if (video.key) {
          const oldKey = video.key;
          const newKey = `servicesDeleted/${serviceId}/${oldKey.split('/').pop()}`;
          renamePromises.push(renameMedia(oldKey, newKey));
        }
      }
    }

    // Execute all rename operations
    const renameResults = await Promise.allSettled(renamePromises);
    
    // Check if any rename operations failed
    const failedRenames = renameResults.filter(result => result.status === 'rejected');
    if (failedRenames.length > 0) {
      console.warn(`Failed to rename ${failedRenames.length} media files for service ${serviceId}`);
    }

    // Delete the service document from Firestore
    await serviceRef.delete();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          serviceId,
          deleted: true,
          renamedFiles: renamePromises.length,
          failedRenames: failedRenames.length
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      }
    );
  } catch (error) {
    console.error('Error deleting service:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete service' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      }
    );
  }
});
