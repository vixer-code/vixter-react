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
  onWithdrawalStatusChanged,

  // Vixtip Processing
  processVixtip,
  processPendingVixtips,

  // Auto-completion of delivered services
  scheduledAutoCompleteServices,
} from './wallet-functions.js';

import {
  // KYC Management
  updateKycStatus,
  getKycDocument,
  listPendingKycDocuments,
  generateKycDownloadUrl,
  onKycStatusChange,
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
  onWithdrawalStatusChanged,

  // Vixtip Processing
  processVixtip,
  processPendingVixtips,

  // Auto-completion of delivered services
  scheduledAutoCompleteServices,

  // KYC Management
  updateKycStatus,
  getKycDocument,
  listPendingKycDocuments,
  generateKycDownloadUrl,
  onKycStatusChange,

  // Email Functions
  sendServiceStatusEmail,
};
