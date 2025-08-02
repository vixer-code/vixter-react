// Firebase configuration using v9+ SDK
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyABjJMmPTnCUegUtAFd9P8L-qf2_OY30xs",
  authDomain: "vixter-451b3.firebaseapp.com",
  databaseURL: "https://vixter-451b3-default-rtdb.firebaseio.com",
  projectId: "vixter-451b3",
  storageBucket: "vixter-451b3.firebasestorage.app",
  messagingSenderId: "429636386363",
  appId: "1:429636386363:web:7f2ac94bca7961ba70a61e",
  measurementId: "G-Z0FBX7E8RY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

// Development emulators (uncomment if you want to use them)
// if (import.meta.env.DEV) {
//   connectAuthEmulator(auth, "http://localhost:9099");
//   connectDatabaseEmulator(database, "localhost", 9000);
//   connectStorageEmulator(storage, "localhost", 9199);
// }

export default app;