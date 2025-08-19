import admin from "firebase-admin";

const PROJECT_ID = "vixter-451b3";
const RTDB_LEGACY_URL = "https://vixter-451b3-default-rtdb.firebaseio.com";
const RTDB_NEW_URL = "https://vixter-451b3.firebaseio.com/";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: RTDB_NEW_URL
});

const db = admin.firestore();
const rtdbLegacy = admin.app().database(RTDB_LEGACY_URL);

const toTs = (ms) => (ms ? admin.firestore.Timestamp.fromMillis(Number(ms)) : null);

async function migrateUsers() {
  const snap = await rtdbLegacy.ref("users").once("value");
  if (!snap.exists()) return { migrated: 0 };
  const users = snap.val();
  let migrated = 0;
  const batch = db.batch();

  for (const uid of Object.keys(users)) {
    const u = users[uid] || {};
    const ref = db.collection("users").doc(uid);
    batch.set(ref, {
      uid,
      email: u.email || "",
      displayName: u.displayName || "",
      username: u.username || "",
      name: u.name || "",
      bio: u.bio || "",
      aboutMe: u.aboutMe || "",
      location: u.location || "",
      languages: u.languages || "",
      hobbies: u.hobbies || "",
      interests: u.interests || "",
      profilePictureURL: u.profilePictureURL || null,
      coverPhotoURL: u.coverPhotoURL || null,
      accountType: u.accountType || "both",
      profileComplete: !!u.profileComplete,
      specialAssistance: !!u.specialAssistance,
      selectedStatus: u.selectedStatus || "online",
      communicationPreferences: u.communicationPreferences || {},
      createdAt: toTs(u.createdAt) || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastDailyBonus: toTs(u.lastDailyBonus),
      searchTerms: [ (u.displayName||"").toLowerCase(), (u.username||"").toLowerCase(), (u.location||"").toLowerCase() ].filter(Boolean),
      stats: { totalPosts: 0, totalServices: 0, totalPacks: 0, totalSales: 0 }
    }, { merge: true });
    migrated++;
    if (migrated % 400 === 0) { await batch.commit(); }
  }
  if (migrated % 400 !== 0) await batch.commit();
  return { migrated };
}

async function migratePacks() {
  const snap = await rtdbLegacy.ref("packs").once("value");
  if (!snap.exists()) return { migrated: 0 };
  const byUser = snap.val();
  let migrated = 0;

  for (const authorId of Object.keys(byUser)) {
    const items = byUser[authorId] || {};
    for (const id of Object.keys(items)) {
      const p = items[id] || {};
      const ref = db.collection("packs").doc();
      await ref.set({
        id: ref.id,
        authorId,
        title: String(p.title || `Pack ${id}`).slice(0,120),
        description: String(p.description || "").slice(0,2000),
        price: Math.max(0, Number(p.price || 0)),
        category: String(p.category || "geral"),
        tags: Array.isArray(p.tags) ? p.tags : [],
        mediaUrls: Array.isArray(p.mediaUrls) ? p.mediaUrls : [],
        isActive: p.isActive !== false,
        purchaseCount: Number(p.purchaseCount || 0),
        rating: Number(p.rating || 0),
        totalRating: Number(p.totalRating || 0),
        ratingCount: Number(p.ratingCount || 0),
        searchTerms: [ String(p.title||"").toLowerCase(), String(p.description||"").toLowerCase(), String(p.category||"geral").toLowerCase() ].filter(Boolean),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      migrated++;
    }
  }
  return { migrated };
}

async function migrateServices() {
  const snap = await rtdbLegacy.ref("services").once("value");
  if (!snap.exists()) return { migrated: 0 };
  const byUser = snap.val();
  let migrated = 0;

  for (const providerId of Object.keys(byUser)) {
    const items = byUser[providerId] || {};
    for (const id of Object.keys(items)) {
      const s = items[id] || {};
      const ref = db.collection("services").doc();
      await ref.set({
        id: ref.id,
        providerId,
        title: String(s.title || `Serviço ${id}`).slice(0,120),
        description: String(s.description || "").slice(0,2000),
        price: Math.max(0, Number(s.price || 0)),
        category: String(s.category || "geral"),
        tags: Array.isArray(s.tags) ? s.tags : [],
        deliveryTime: String(s.deliveryTime || "negociavel"),
        isActive: s.isActive !== false,
        orderCount: Number(s.orderCount || 0),
        rating: Number(s.rating || 0),
        totalRating: Number(s.totalRating || 0),
        ratingCount: Number(s.ratingCount || 0),
        searchTerms: [ String(s.title||"").toLowerCase(), String(s.description||"").toLowerCase(), String(s.category||"geral").toLowerCase() ].filter(Boolean),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      migrated++;
    }
  }
  return { migrated };
}

async function migrateFollowers() {
  const snap = await rtdbLegacy.ref("followers").once("value");
  if (!snap.exists()) return { migrated: 0 };
  const all = snap.val();
  const batch = db.batch();
  let migrated = 0;

  for (const targetUserId of Object.keys(all)) {
    const followers = all[targetUserId] || {};
    for (const followerId of Object.keys(followers)) {
      const ref = db.collection("users").doc(targetUserId).collection("followers").doc(followerId);
      batch.set(ref, {
        userId: targetUserId,
        followerId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      migrated++;
      if (migrated % 400 === 0) { await batch.commit(); }
    }
  }
  if (migrated % 400 !== 0) await batch.commit();
  return { migrated };
}

(async () => {
  console.log("Migrando users...");
  const u = await migrateUsers();      console.log("Users:", u);

  console.log("Migrando packs...");
  const p = await migratePacks();      console.log("Packs:", p);

  console.log("Migrando services...");
  const s = await migrateServices();   console.log("Services:", s);

  console.log("Migrando followers...");
  const f = await migrateFollowers();  console.log("Followers:", f);

  console.log("Migração concluída.");
  process.exit(0);
})();
