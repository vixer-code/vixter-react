/* eslint-env node */
import {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,
  processPackSale,
  processServicePurchase,
  claimDailyBonus,
  autoReleaseServices,

  // Migrations
  migrateUserToFirestore,
  migrateAllUsers,
  migratePacksFromLegacy,
  migrateServicesFromLegacy,
  migrateFollowersFromLegacy,
  migrateAllLegacyData,

  // Packs CRUD
  createPack,
  updatePack,
  deletePack,

  // Services CRUD
  createService,
  updateService,
  deleteService,

  // Posts CRUD & interactions
  createPost,
  updatePost,
  deletePost,
  togglePostLike,
  addComment,
} from './wallet-functions.js';

export {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,
  processPackSale,
  processServicePurchase,
  claimDailyBonus,
  autoReleaseServices,

  // Migrations
  migrateUserToFirestore,
  migrateAllUsers,
  migratePacksFromLegacy,
  migrateServicesFromLegacy,
  migrateFollowersFromLegacy,
  migrateAllLegacyData,

  // Packs CRUD
  createPack,
  updatePack,
  deletePack,

  // Services CRUD
  createService,
  updateService,
  deleteService,

  // Posts CRUD & interactions
  createPost,
  updatePost,
  deletePost,
  togglePostLike,
  addComment,
};
