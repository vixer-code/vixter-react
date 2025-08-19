import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyABjJMmPTnCUegUtAFd9P8L-qf2_OY30xs",
  authDomain: "vixter-451b3.firebaseapp.com",
  databaseURL: "https://vixter-451b3.firebaseio.com/",
  projectId: "vixter-451b3",
  storageBucket: "vixter-451b3.firebasestorage.app",
  messagingSenderId: "429636386363",
  appId: "1:429636386363:web:7f2ac94bca7961ba70a61e"
};

const email = process.env.MIGRATION_EMAIL;
const password = process.env.MIGRATION_PASSWORD;

(async () => {
  if (!email || !password) {
    console.error("Set MIGRATION_EMAIL and MIGRATION_PASSWORD env vars.");
    process.exit(1);
  }
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const functions = getFunctions(app, "us-east1");

  await signInWithEmailAndPassword(auth, email, password);

  const migrateAllUsers = httpsCallable(functions, "migrateAllUsers");
  const migrateAllLegacyData = httpsCallable(functions, "migrateAllLegacyData");

  console.log("Migrando users...");
  const usersRes = await migrateAllUsers({});
  console.log("Users:", usersRes.data);

  console.log("Migrando packs/services/followers...");
  const legacyRes = await migrateAllLegacyData({});
  console.log("Legacy:", legacyRes.data);

  console.log("Migração concluída.");
})();
