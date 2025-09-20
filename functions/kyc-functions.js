import functions from 'firebase-functions';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();
const firestore = admin.firestore();
const storage = admin.storage();

/**
 * Update user KYC status (Admin only)
 * This function allows administrators to update the KYC status of users
 */
export const updateKycStatus = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, kycState, kyc } = data;

  // Validate required fields
  if (!userId || !kycState) {
    throw new functions.https.HttpsError('invalid-argument', 'userId and kycState are required');
  }

  // Validate kycState values
  const validStates = ['PENDING_UPLOAD', 'PENDING_VERIFICATION', 'VERIFIED'];
  if (!validStates.includes(kycState)) {
    throw new functions.https.HttpsError('invalid-argument', 'kycState must be one of: PENDING_UPLOAD, PENDING_VERIFICATION, VERIFIED');
  }

  try {
    // Update user document in Realtime Database
    const userRef = db.ref(`users/${userId}`);
    const updates = {
      kycState: kycState,
      updatedAt: Date.now()
    };

    // Update kyc field if provided
    if (kyc !== undefined) {
      updates.kyc = kyc;
    }

    // If verifying, also update verification status
    if (kycState === 'VERIFIED') {
      updates.kyc = true;
      updates['verification/verificationStatus'] = 'verified';
      updates['verification/verifiedAt'] = Date.now();
    }

    await userRef.update(updates);

    // Update KYC document in Firestore if it exists
    if (kycState === 'VERIFIED') {
      const kycRef = firestore.collection('kyc').doc(userId);
      await kycRef.update({
        status: 'VERIFIED',
        verifiedAt: Date.now(),
        verifiedBy: context.auth.uid
      });
    }

    return {
      success: true,
      message: `KYC status updated to ${kycState}`,
      userId: userId,
      kycState: kycState,
      kyc: kyc !== undefined ? kyc : (kycState === 'VERIFIED')
    };

  } catch (error) {
    console.error('Error updating KYC status:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update KYC status');
  }
});

/**
 * Get KYC document (Admin only)
 * This function allows administrators to retrieve KYC documents for verification
 */
export const getKycDocument = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId } = data;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  }

  try {
    // Get KYC document from Firestore
    const kycRef = firestore.collection('kyc').doc(userId);
    const kycDoc = await kycRef.get();

    if (!kycDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'KYC document not found');
    }

    const kycData = kycDoc.data();

    // Get user basic info from Realtime Database
    const userRef = db.ref(`users/${userId}`);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();

    return {
      success: true,
      data: {
        userId: userId,
        userInfo: {
          displayName: userData?.displayName,
          username: userData?.username,
          email: userData?.email
        },
        kycData: {
          fullName: kycData.fullName,
          cpf: kycData.cpf,
          documents: kycData.documents,
          submittedAt: kycData.submittedAt,
          status: kycData.status
        }
      }
    };

  } catch (error) {
    console.error('Error getting KYC document:', error);
    if (error.code) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to get KYC document');
  }
});

/**
 * List pending KYC documents (Admin only)
 * This function returns a list of all pending KYC documents for review
 */
export const listPendingKycDocuments = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    // Get all KYC documents with PENDING_VERIFICATION status
    const kycQuery = firestore.collection('kyc')
      .where('status', '==', 'PENDING_VERIFICATION')
      .orderBy('submittedAt', 'desc');

    const kycSnapshot = await kycQuery.get();
    const pendingDocuments = [];

    for (const doc of kycSnapshot.docs) {
      const kycData = doc.data();
      const userId = doc.id;

      // Get user basic info
      const userRef = db.ref(`users/${userId}`);
      const userSnapshot = await userRef.once('value');
      const userData = userSnapshot.val();

      pendingDocuments.push({
        userId: userId,
        userInfo: {
          displayName: userData?.displayName,
          username: userData?.username,
          email: userData?.email
        },
        kycData: {
          fullName: kycData.fullName,
          cpf: kycData.cpf,
          submittedAt: kycData.submittedAt
        }
      });
    }

    return {
      success: true,
      data: {
        pendingDocuments: pendingDocuments,
        count: pendingDocuments.length
      }
    };

  } catch (error) {
    console.error('Error listing pending KYC documents:', error);
    throw new functions.https.HttpsError('internal', 'Failed to list pending KYC documents');
  }
});

/**
 * Generate download URL for KYC document (Admin only)
 * This function generates a secure download URL for KYC documents
 */
export const generateKycDownloadUrl = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, documentType } = data;

  if (!userId || !documentType) {
    throw new functions.https.HttpsError('invalid-argument', 'userId and documentType are required');
  }

  const validDocumentTypes = ['front', 'back', 'selfie'];
  if (!validDocumentTypes.includes(documentType)) {
    throw new functions.https.HttpsError('invalid-argument', 'documentType must be one of: front, back, selfie');
  }

  try {
    // Get KYC document to find the document key
    const kycRef = firestore.collection('kyc').doc(userId);
    const kycDoc = await kycRef.get();

    if (!kycDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'KYC document not found');
    }

    const kycData = kycDoc.data();
    const documentKey = kycData.documents[documentType];

    if (!documentKey) {
      throw new functions.https.HttpsError('not-found', `${documentType} document not found`);
    }

    // Generate signed URL for the document
    const bucket = storage.bucket();
    const file = bucket.file(documentKey);
    
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return {
      success: true,
      data: {
        downloadUrl: signedUrl,
        documentType: documentType,
        expiresIn: 15 * 60 // 15 minutes in seconds
      }
    };

  } catch (error) {
    console.error('Error generating KYC download URL:', error);
    if (error.code) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to generate download URL');
  }
});
