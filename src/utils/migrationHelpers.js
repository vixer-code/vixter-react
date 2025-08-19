// Migration helpers for transitioning from RTDB to Firestore
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

/**
 * Migrates current user data from RTDB to Firestore
 */
export const migrateCurrentUser = async () => {
  try {
    const migrateUser = httpsCallable(functions, 'migrateUserToFirestore');
    const result = await migrateUser();
    
    if (result.data.success) {
      console.log('✅ User migrated successfully:', result.data.message);
      return { success: true, userData: result.data.userData };
    } else {
      console.error('❌ Migration failed:', result.data.message);
      return { success: false, error: result.data.message };
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Checks migration status for current user
 */
export const checkMigrationStatus = async (currentUser, db) => {
  if (!currentUser) return { migrated: false, reason: 'No user authenticated' };
  
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return { 
        migrated: true, 
        userData,
        reason: 'User exists in Firestore'
      };
    } else {
      return { 
        migrated: false, 
        reason: 'User not found in Firestore' 
      };
    }
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { 
      migrated: false, 
      reason: `Error: ${error.message}` 
    };
  }
};

/**
 * Data structure mapping from RTDB to Firestore
 */
export const MIGRATION_MAPPINGS = {
  // Users collection structure
  users: {
    source: 'users/{uid}',
    target: 'users/{uid}',
    fields: {
      // Basic profile
      'email': 'email',
      'displayName': 'displayName', 
      'username': 'username',
      'name': 'name',
      
      // Detailed profile
      'bio': 'bio',
      'aboutMe': 'aboutMe',
      'location': 'location',
      'languages': 'languages',
      'hobbies': 'hobbies',
      'interests': 'interests',
      
      // Media URLs
      'profilePictureURL': 'profilePictureURL',
      'coverPhotoURL': 'coverPhotoURL',
      
      // Account settings
      'accountType': 'accountType',
      'profileComplete': 'profileComplete', 
      'specialAssistance': 'specialAssistance',
      'selectedStatus': 'selectedStatus',
      'communicationPreferences': 'communicationPreferences',
      
      // Timestamps (converted to Firestore Timestamp)
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'lastDailyBonus': 'lastDailyBonus'
    },
    transforms: {
      // Convert milliseconds to Firestore Timestamp
      'createdAt': (value) => value ? admin.firestore.Timestamp.fromMillis(value) : null,
      'updatedAt': (value) => value ? admin.firestore.Timestamp.fromMillis(value) : null,
      'lastDailyBonus': (value) => value ? admin.firestore.Timestamp.fromMillis(value) : null,
      
      // Generate search terms for queries
      'searchTerms': (userData) => [
        (userData.displayName || '').toLowerCase(),
        (userData.username || '').toLowerCase(), 
        (userData.location || '').toLowerCase()
      ].filter(term => term.length > 0)
    },
    newFields: {
      // Add new Firestore-specific fields
      'stats': {
        totalPosts: 0,
        totalServices: 0, 
        totalPacks: 0,
        totalSales: 0
      }
    }
  },

  // Wallet data (already migrated)
  wallets: {
    source: 'users/{uid}/(vpBalance,vbpBalance,vcBalance,vcPendingBalance)',
    target: 'wallets/{uid}',
    note: 'Already implemented in Cloud Functions'
  },

  // What stays in RTDB (real-time features)
  rtdbOnly: {
    'status/{uid}': 'User presence (online/offline)',
    'chats/{chatId}/messages': 'Real-time messaging',
    'calls/{callId}/signal': 'WebRTC signaling'
  }
};

/**
 * Validates migration data
 */
export const validateMigrationData = (rtdbData, firestoreData) => {
  const issues = [];
  
  // Check required fields
  const requiredFields = ['uid', 'email', 'displayName'];
  requiredFields.forEach(field => {
    if (!firestoreData[field] && !rtdbData[field]) {
      issues.push(`Missing required field: ${field}`);
    }
  });
  
  // Check data consistency
  if (rtdbData.email && firestoreData.email && rtdbData.email !== firestoreData.email) {
    issues.push('Email mismatch between RTDB and Firestore');
  }
  
  // Check timestamp formats
  if (firestoreData.createdAt && typeof firestoreData.createdAt !== 'object') {
    issues.push('CreatedAt should be Firestore Timestamp object');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

/**
 * Progress tracking for migrations
 */
export class MigrationProgress {
  constructor() {
    this.total = 0;
    this.completed = 0;
    this.failed = 0;
    this.errors = [];
  }
  
  setTotal(count) {
    this.total = count;
  }
  
  addSuccess() {
    this.completed++;
  }
  
  addFailure(error) {
    this.failed++;
    this.errors.push(error);
  }
  
  getProgress() {
    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      percentage: this.total > 0 ? Math.round((this.completed / this.total) * 100) : 0,
      errors: this.errors
    };
  }
  
  log() {
    const progress = this.getProgress();
    console.log(`📊 Migration Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
    if (progress.failed > 0) {
      console.warn(`⚠️ ${progress.failed} failures`);
      progress.errors.forEach(error => console.error('❌', error));
    }
  }
}

export default {
  migrateCurrentUser,
  checkMigrationStatus,
  MIGRATION_MAPPINGS,
  validateMigrationData,
  MigrationProgress
};
