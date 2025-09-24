/* eslint-env node */
import {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,
  claimDailyBonus,

  // Unified API for CRUD operations
  api,

  // Manual Withdrawals (PIX)
  processVCWithdrawal,
  calculateWithdrawalFee,
  processPixPayment,
  listPendingWithdrawals,
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

import {
  // Email Functions
  sendServiceStatusEmail,
} from './email-functions.js';

export {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,
  claimDailyBonus,

  // Unified API (substitui createPack, updatePack, deletePack, createService, updateService, deleteService, createPost, updatePost, deletePost)
  api,

  // Manual Withdrawals (PIX)
  processVCWithdrawal,
  calculateWithdrawalFee,
  processPixPayment,
  listPendingWithdrawals,
  sendPurchaseConfirmationEmail,

  // Vixtip Processing
  processVixtip,
  processPendingVixtips,

  // KYC Management
  updateKycStatus,
  getKycDocument,
  listPendingKycDocuments,
  generateKycDownloadUrl,

  // Email Functions
  sendServiceStatusEmail,
};
