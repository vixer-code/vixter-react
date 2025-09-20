import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (getApps().length === 0) {
    // Check if we have the private key (it might be in FIREBASE_PROJECT_ID due to Vercel config)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    
    if (privateKey && clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
      const serviceAccount = {
        projectId: 'vixter-451b3',
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail: clientEmail,
      };

      initializeApp({
        credential: cert(serviceAccount),
        projectId: 'vixter-451b3',
      });
    } else {
      // Initialize with default credentials for build time
      try {
        initializeApp({
          projectId: 'vixter-451b3',
        });
      } catch (error) {
        console.warn('Firebase Admin SDK initialization failed:', error);
      }
    }
  }
};

// Initialize and export
initializeFirebaseAdmin();

export const auth = getAuth();
export const database = getDatabase();
export default auth;
