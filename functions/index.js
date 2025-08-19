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

  // Unified API for CRUD operations
  api,

  // Post interactions (mantidos separados)
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

  // Unified API (substitui createPack, updatePack, deletePack, createService, updateService, deleteService, createPost, updatePost, deletePost)
  api,

  // Post interactions (mantidos separados pois não são CRUD básico)
  togglePostLike,
  addComment,
};
