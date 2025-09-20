/* eslint-env node */
import {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,

  // Unified API for CRUD operations
  api,

  // Stripe Connect
  createStripeConnectAccount,
  getStripeConnectStatus,
  getStripeConnectDetailedStatus,
  refreshStripeConnectStatus,
  checkAndEnablePayouts,
  getStripeConnectLoginLink,
  processVCWithdrawal,
  calculateWithdrawalFee,
  checkStripeConnectConfig,
  checkEnvironment,
  sendPurchaseConfirmationEmail,

  // Vixtip Processing
  processVixtip,
  processPendingVixtips,
} from './wallet-functions.js';

import {
  // KYC Management
  updateKycStatus,
  getKycDocument,
  listPendingKycDocuments,
  generateKycDownloadUrl,
} from './kyc-functions.js';

export {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,

  // Unified API (substitui createPack, updatePack, deletePack, createService, updateService, deleteService, createPost, updatePost, deletePost)
  api,

  // Stripe Connect
  createStripeConnectAccount,
  getStripeConnectStatus,
  getStripeConnectDetailedStatus,
  refreshStripeConnectStatus,
  checkAndEnablePayouts,
  getStripeConnectLoginLink,
  processVCWithdrawal,
  calculateWithdrawalFee,
  checkStripeConnectConfig,
  checkEnvironment,
  sendPurchaseConfirmationEmail,

  // Vixtip Processing
  processVixtip,
  processPendingVixtips,

  // KYC Management
  updateKycStatus,
  getKycDocument,
  listPendingKycDocuments,
  generateKycDownloadUrl,
};
