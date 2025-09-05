import { requireAuth, getCorsHeaders, handleCors } from '../../lib/auth';
import { deleteMedia } from '../../lib/r2';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { key } = req.body;

    // Validate required fields
    if (!key) {
      return res.status(400).json({ 
        error: 'Missing required field: key' 
      });
    }

    // Delete media from R2
    const success = await deleteMedia(key);

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete media' });
    }

    res.status(200).json({
      success: true,
      data: {
        key,
        deleted: true,
      }
    });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
}
