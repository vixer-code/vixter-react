# Wallet System Integration Guide

## Phase 1 Implementation - COMPLETED ✅

### 1. Firestore Schema (Implemented)
- `wallets` collection with VP, VC, VBP, and vcPending fields
- `transactions` collection with detailed transaction tracking
- `serviceOrders` collection for service workflow management
- `stripePayments` collection for payment reconciliation

### 2. Firebase Security Rules (Implemented)
- Wallet data is read-only for users (only Cloud Functions can modify)
- Users can only read their own transactions and wallet data
- Service orders are accessible to both buyer and seller
- Admin users have full access to all collections

### 3. Cloud Functions (Implemented)
- `initializeWallet` - Creates user wallet on first access
- `createStripeSession` - Creates Stripe Checkout sessions for VP purchases
- `stripeWebhook` - Processes Stripe payment confirmations
- `processPackSale` - Handles pack sales (immediate VC release)
- `processServicePurchase` - Handles service purchases (VC goes to pending)
- `claimDailyBonus` - Processes daily VBP bonuses
- `autoReleaseServices` - Scheduled function to auto-release VC after 24h

### 4. React Context & Hook (Implemented)
- `WalletProvider` context with complete wallet state management
- `useWallet` hook exposing all wallet functionality
- Real-time wallet balance updates via Firestore listeners
- Transaction history with filtering and pagination support

### 5. Stripe Integration (Implemented)
- Client-side Stripe integration with `@stripe/stripe-js`
- Secure server-side payment processing
- Payment status handling with URL parameter checking
- Success/failure redirect handling

## Currency System

### Currency Types
- **VP (Vixter Points)** - For purchasing services and packs (clients buy these)
- **VC (Vixter Credits)** - Earnings from sales, can be withdrawn (1 VC = R$ 1.00)
- **VBP (Vixter Bonus Points)** - Platform activity rewards (non-transferable)
- **VC Pending** - VC held in escrow until service confirmation

### Conversion Rate
- **1 VC = 1.5 VP** (1 VP = R$ 0.67, 1 VC = R$ 1.00)
- All conversions round down to prevent fractional currencies
- Example: 150 VP purchase → 100 VC earned by seller

## Transaction Flow Examples

### 1. VP Purchase via Stripe
```js
User selects package → createStripeSession → Stripe Checkout → 
stripeWebhook → VP + VBP credited to wallet → Transaction recorded
```

### 2. Pack Sale (Immediate VC)
```js
Buyer purchases pack → processPackSale → VP debited from buyer →
VC credited to seller immediately → Transactions recorded for both users
```

### 3. Service Purchase (VC Pending)
```js
Buyer purchases service → processServicePurchase → VP debited from buyer →
VC goes to seller's vcPending → ServiceOrder created → 
Seller delivers → Buyer confirms → VC released to seller
```

### 4. Service Auto-Release
```js
24h after delivery without buyer confirmation → autoReleaseServices →
VC automatically released from pending to available
```

## Integration Checklist

### Frontend Setup ✅
- [x] Add Stripe dependency: `@stripe/stripe-js`
- [x] Configure Firebase with Firestore
- [x] Add WalletProvider to App.jsx
- [x] Use useWallet hook in Wallet component
- [x] Handle payment redirects and status

### Backend Setup ✅
- [x] Deploy Cloud Functions with wallet functions
- [x] Configure Stripe webhook endpoint
- [x] Set up environment variables (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- [x] Deploy Firestore security rules
- [x] Create Firestore indexes

### Required Environment Variables
```bash
# Firebase Functions
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
FRONTEND_URL=https://vixter-react.vercel.app

# Frontend (in .env or Vercel)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### Testing Checklist
- [x] Wallet initialization for new users
- [x] VP package purchase flow
- [x] Daily bonus claiming
- [x] Transaction history display
- [x] Real-time balance updates
- [x] Payment success/failure handling

## Next Steps (Phase 2)

### Service Management Integration
1. Integrate with service creation/management system
2. Connect pack sales to actual pack/service listings
3. Implement service order management UI
4. Add service confirmation workflow

### Advanced Features
1. VC withdrawal system (bank account integration)
2. Referral bonus system
3. Enhanced transaction filtering and export
4. Admin dashboard for wallet management
5. Fraud detection and prevention

### Performance Optimizations
1. Transaction pagination optimization
2. Wallet balance caching strategies
3. Batch processing for bulk operations
4. Background sync for offline capabilities

## Rollback Plan

If issues arise, you can:
1. Disable new wallet features via feature flags
2. Fallback to vanilla JS wallet system temporarily
3. Migrate data between systems using batch operations
4. Roll back Cloud Functions to previous versions

## Points of Failure & Monitoring

### Critical Points
1. **Stripe Webhook Reliability** - Monitor webhook delivery and processing
2. **Transaction Atomicity** - Ensure Firestore transactions complete successfully
3. **Balance Consistency** - Regular audits of wallet vs transaction totals
4. **Auto-Release Timing** - Monitor scheduled function execution

### Monitoring Setup
1. Cloud Function logs and error reporting
2. Stripe webhook monitoring
3. Firestore transaction failure alerts
4. Balance discrepancy detection

## Support for Legacy System

The new React wallet system is designed to coexist with the existing vanilla JS system:
- Same Firestore collections and data structure
- Compatible Cloud Functions
- Gradual migration path available
- Shared security rules and business logic
