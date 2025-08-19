// Firebase configuration using v9+ SDK
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyABjJMmPTnCUegUtAFd9P8L-qf2_OY30xs",
  authDomain: "vixter-451b3.firebaseapp.com",
  databaseURL: "https://vixter-451b3.firebaseio.com/",
  projectId: "vixter-451b3",
  storageBucket: "vixter-451b3.firebasestorage.app",
  messagingSenderId: "429636386363",
  appId: "1:429636386363:web:7f2ac94bca7961ba70a61e",
  measurementId: "G-Z0FBX7E8RY"
};

// Initialize Firebase with proper error handling
let app, auth, database, storage, firestore, functions;
// RTDB instances (new and legacy)
let databaseNew, databaseLegacy;

try {
  console.log("Initializing Firebase...");
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
  
  // Initialize Firebase services
  auth = getAuth(app);
  // Legacy RTDB (keep compatibility)
  databaseLegacy = getDatabase(app, "https://vixter-451b3-default-rtdb.firebaseio.com");
  // New RTDB (segregated)
  databaseNew = getDatabase(app, "https://vixter-451b3.firebaseio.com");
  // Current default export: new RTDB for real-time features only
  database = databaseNew;
  storage = getStorage(app);
  firestore = getFirestore(app);
  functions = getFunctions(app, 'us-east1'); // Updated to match deployed functions
  
  console.log("Firebase services initialized:", {
    auth: !!auth,
    database: !!database,
    databaseNew: !!databaseNew,
    databaseLegacy: !!databaseLegacy,
    storage: !!storage,
    firestore: !!firestore,
    functions: !!functions
  });
  
} catch (error) {
  console.error("Error initializing Firebase:", error);
  throw new Error(`Firebase initialization failed: ${error.message}`);
}

// Development emulators (uncomment if you want to use them)
// if (import.meta.env.DEV) {
//   connectAuthEmulator(auth, "http://localhost:9099");
//   connectDatabaseEmulator(database, "localhost", 9000);
//   connectStorageEmulator(storage, "localhost", 9199);
//   connectFirestoreEmulator(firestore, "localhost", 8080);
//   connectFunctionsEmulator(functions, "localhost", 5001);
// }

// Export db as alias for firestore to match the context usage
export {
  auth,
  // default (legacy for now)
  database,
  // explicit instances for staged migration
  databaseNew,
  databaseLegacy,
  storage,
  firestore,
  firestore as db,
  functions
};
export default app;
