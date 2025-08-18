# Firestore Schema Documentation

## Collections Overview

### `wallets` Collection
Stores user wallet information with different currencies.

```js
// Document ID: {userId}
{
  uid: string,              // User ID
  vp: number,              // Vixter Points (for purchasing services)
  vc: number,              // Vixter Credits (earnings from services - can be withdrawn)
  vbp: number,             // Vixter Bonus Points (earned through platform activities)
  vcPending: number,       // VC pending confirmation from service delivery
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Example:**
```js
{
  uid: "user123",
  vp: 1500,
  vc: 750,
  vbp: 200,
  vcPending: 100,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `transactions` Collection
Records all wallet transactions with detailed metadata.

```js
// Document ID: auto-generated
{
  id: string,              // Transaction ID
  userId: string,          // User ID (owner of the transaction)
  type: string,           // Transaction type: BUY_VP, SALE_PACK, SALE_SERVICE, BONUS, etc.
  amounts: {              // Currency amounts affected
    vp?: number,          // VP amount (positive for credit, negative for debit)
    vc?: number,          // VC amount
    vbp?: number,         // VBP amount
    vcPending?: number    // VC pending amount
  },
  ref?: {                 // Reference to related entities
    stripeSessionId?: string,      // For Stripe payments
    packId?: string,              // For pack transactions
    serviceId?: string,           // For service transactions
    serviceOrderId?: string,      // For service orders
    targetUserId?: string         // For transfers
  },
  status: string,         // CONFIRMED, PENDING, FAILED
  metadata: {
    description: string,   // Human-readable description
    conversionRate?: number, // For VP to VC conversions (1.5)
    originalAmount?: number, // Original amount before conversion
    [key: string]: any    // Additional metadata
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Example Transactions:**

1. **VP Purchase via Stripe:**
```js
{
  id: "tx_001",
  userId: "user123",
  type: "BUY_VP",
  amounts: {
    vp: 120,
    vbp: 22
  },
  ref: {
    stripeSessionId: "cs_123456"
  },
  status: "CONFIRMED",
  metadata: {
    description: "Compra de 120 VP via Stripe",
    currency: "BRL",
    originalAmount: 8500
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

2. **Pack Sale (Immediate VC):**
```js
{
  id: "tx_002",
  userId: "seller456",
  type: "SALE_PACK",
  amounts: {
    vc: 80  // 120 VP / 1.5 = 80 VC
  },
  ref: {
    packId: "pack_789",
    targetUserId: "buyer123"
  },
  status: "CONFIRMED",
  metadata: {
    description: "Venda de Pack: Design Logo Premium",
    conversionRate: 1.5,
    originalAmount: 120
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

3. **Service Purchase (VC goes to pending):**
```js
{
  id: "tx_003",
  userId: "seller456",
  type: "SALE_SERVICE",
  amounts: {
    vcPending: 100  // 150 VP / 1.5 = 100 VC pending
  },
  ref: {
    serviceId: "service_456",
    serviceOrderId: "order_789",
    targetUserId: "buyer123"
  },
  status: "CONFIRMED",
  metadata: {
    description: "Venda de Serviço: Consultoria de Marketing (Pendente)",
    conversionRate: 1.5,
    originalAmount: 150
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

4. **Daily Bonus:**
```js
{
  id: "tx_004",
  userId: "user123",
  type: "BONUS",
  amounts: {
    vbp: 150
  },
  status: "CONFIRMED",
  metadata: {
    description: "Bônus Diário"
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `serviceOrders` Collection
Manages service orders with status tracking and payment flow.

```js
// Document ID: auto-generated
{
  id: string,              // Order ID
  serviceId: string,       // Service ID
  buyerId: string,         // Buyer user ID
  sellerId: string,        // Seller user ID
  vpAmount: number,        // VP amount paid by buyer
  vcAmount: number,        // VC amount to be earned by seller (vpAmount / 1.5)
  status: string,          // PENDING_ACCEPTANCE, ACCEPTED, DELIVERED, CONFIRMED, AUTO_RELEASED
  metadata: {
    serviceName: string,
    serviceDescription?: string,
    deliveryNotes?: string,
    buyerFeedback?: string
  },
  timestamps: {
    createdAt: Timestamp,
    acceptedAt?: Timestamp,
    deliveredAt?: Timestamp,
    confirmedAt?: Timestamp,
    autoReleaseAt?: Timestamp
  },
  transactionIds: {
    purchaseId?: string,    // Buyer's transaction ID
    acceptanceId?: string,  // Acceptance transaction ID
    deliveryId?: string,    // Delivery transaction ID
    confirmationId?: string // Confirmation transaction ID
  }
}
```

**Service Order Status Flow:**
1. `PENDING_ACCEPTANCE` - Service purchased, waiting for seller acceptance
2. `ACCEPTED` - Seller accepted the service order
3. `DELIVERED` - Seller marked service as delivered
4. `CONFIRMED` - Buyer confirmed receipt (VC released to seller)
5. `AUTO_RELEASED` - Auto-released after 24h without buyer confirmation

### `stripePayments` Collection
Tracks Stripe payment sessions for audit and reconciliation.

```js
// Document ID: {sessionId}
{
  sessionId: string,       // Stripe session ID
  userId: string,          // User ID
  amount: number,          // Amount in cents (BRL)
  vpAmount: number,        // VP amount to be credited
  vbpBonus: number,        // VBP bonus amount
  packageId: string,       // Package ID purchased
  status: string,          // pending, completed, failed
  createdAt: Timestamp,
  completedAt?: Timestamp
}
```

## Currency Conversion Rules

### VP to VC Conversion
- **Rate:** 1 VC = 1.5 VP
- **Formula:** `vcAmount = Math.floor(vpAmount / 1.5)`
- **Rounding:** Always round down to prevent fractional currencies

**Examples:**
- 150 VP → 100 VC
- 120 VP → 80 VC  
- 100 VP → 66 VC (66.67 rounded down)
- 1 VP → 0 VC (minimum conversion threshold)

### Currency Purposes
- **VP (Vixter Points):** For purchasing services and packs
- **VC (Vixter Credits):** Earnings that can be withdrawn to real money (1 VC = R$ 1.00)
- **VBP (Vixter Bonus Points):** Bonus currency for platform activities (non-transferable)
- **VC Pending:** VC held in escrow until service confirmation

## Transaction Types

### Purchase Transactions
- `BUY_VP` - VP purchased via Stripe
- `SALE_PACK` - Pack purchased (immediate VC release)
- `SALE_SERVICE` - Service purchased (VC goes to pending)

### Service Workflow Transactions
- `SERVICE_ACCEPT` - Seller accepts service order
- `SERVICE_DELIVER` - Seller delivers service
- `SERVICE_CONFIRM` - Buyer confirms service (releases VC)
- `SERVICE_AUTO_RELEASE` - Auto-release after 24h

### Bonus Transactions
- `BONUS` - Daily bonus, referrals, challenges
- `MANUAL` - Manual adjustments (admin only)

## Security Considerations

1. **Transactional Consistency:** All balance updates must use Firestore transactions
2. **Server-side Validation:** All financial operations handled by Cloud Functions
3. **Read-only Client Access:** Clients can only read their own wallet/transaction data
4. **Audit Trail:** Every balance change creates a corresponding transaction record
5. **Idempotency:** Operations designed to handle duplicate requests safely
