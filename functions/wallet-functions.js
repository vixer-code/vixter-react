// wallet-functions.js - Sistema de Carteiras Vixter para React

/* eslint-env node */
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions";

import { defineSecret } from 'firebase-functions/params';


// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Stripe setup (use secrets correctly and avoid module-level client instantiation)
import Stripe from "stripe";
const STRIPE_SECRET = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Configurações globais
setGlobalOptions({
  region: "us-east1",
  maxInstances: 2,
});

const db = admin.firestore();

/**
 * Inicializa carteira do usuário
 */
export const initializeWallet = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = request.auth.uid;

  try {
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      const newWallet = {
        uid: userId,
        vp: 0,
        vc: 0,
        vbp: 0,
        vcPending: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await walletRef.set(newWallet);
      logger.info(`✅ Carteira criada para usuário ${userId}`);
      return { success: true, wallet: newWallet };
    }

    return { success: true, wallet: walletDoc.data() };
  } catch (error) {
    logger.error(`💥 Erro ao inicializar carteira para ${userId}:`, error);
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Cria sessão de pagamento Stripe
 */
export const createStripeSession = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
  secrets: [STRIPE_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { packageId } = request.data;
  if (!packageId) {
    throw new HttpsError("invalid-argument", "ID do pacote é obrigatório");
  }

  const userId = request.auth.uid;

  // Definir pacotes disponíveis
  const packages = {
    'pack-20': { amount: 2000, vpAmount: 30, vbpBonus: 0, name: 'Pacote Iniciante' },
    'pack-45': { amount: 4500, vpAmount: 66, vbpBonus: 0, name: 'Pacote Essencial' },
    'pack-60': { amount: 6000, vpAmount: 85, vbpBonus: 10, name: 'Pacote Bronze' },
    'pack-85': { amount: 8500, vpAmount: 120, vbpBonus: 22, name: 'Pacote Prata' },
    'pack-96': { amount: 9600, vpAmount: 138, vbpBonus: 36, name: 'Pacote Safira' },
    'pack-120': { amount: 12000, vpAmount: 168, vbpBonus: 50, name: 'Pacote Ouro' },
    'pack-150': { amount: 15000, vpAmount: 218, vbpBonus: 65, name: 'Pacote Platina' },
    'pack-200': { amount: 20000, vpAmount: 288, vbpBonus: 85, name: 'Pacote Diamante' },
    'pack-255': { amount: 25500, vpAmount: 370, vbpBonus: 110, name: 'Pacote Épico' },
    'pack-290': { amount: 29000, vpAmount: 415, vbpBonus: 135, name: 'Pacote Lendário' },
    'pack-320': { amount: 32000, vpAmount: 465, vbpBonus: 155, name: 'Pacote Mítico' }
  };

  const selectedPackage = packages[packageId];
  if (!selectedPackage) {
    throw new HttpsError("invalid-argument", "Pacote inválido");
  }

  try {
    // Instantiate Stripe client with secret at runtime
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2023-10-16',
      appInfo: {
        name: 'Vixter Platform',
        version: '1.0.0',
      },
    });
    // Criar sessão Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: request.auth.token.email,
      metadata: {
        userId: userId,
        packageId: packageId,
        vpAmount: selectedPackage.vpAmount.toString(),
        vbpBonus: selectedPackage.vbpBonus.toString()
      },
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: selectedPackage.name,
            description: `${selectedPackage.vpAmount} VP` + 
                        (selectedPackage.vbpBonus > 0 ? ` + ${selectedPackage.vbpBonus} VBP bônus` : ''),
            images: ['https://vixter-451b3.firebaseapp.com/images/logoFlorColorida.svg']
          },
          unit_amount: selectedPackage.amount
        },
        quantity: 1
      }],
      success_url: `${('https://vixter-react.vercel.app')}/wallet?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${('https://vixter-react.vercel.app')}/wallet?canceled=true`,
      // Enhanced metadata for better tracking
      payment_intent_data: {
        metadata: {
          platform: 'vixter',
          userId: userId,
          packageId: packageId
        }
      }
    });

    // Salvar informações da sessão
    await db.collection('stripePayments').doc(session.id).set({
      sessionId: session.id,
      userId: userId,
      amount: selectedPackage.amount,
      vpAmount: selectedPackage.vpAmount,
      vbpBonus: selectedPackage.vbpBonus,
      packageId: packageId,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ Sessão Stripe criada: ${session.id} para usuário ${userId}`);
    return { sessionId: session.id, url: session.url };

  } catch (error) {
    logger.error(`💥 Erro ao criar sessão Stripe:`, error);
    throw new HttpsError("internal", "Erro ao processar pagamento");
  }
});

/**
 * Webhook do Stripe para confirmar pagamentos
 */
export const stripeWebhook = onRequest({
  memory: "512MiB",
  timeoutSeconds: 60,
  cors: false, // Disable CORS for webhook (Stripe calls this server-to-server)
  secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
}, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = STRIPE_WEBHOOK_SECRET.value();

  if (!endpointSecret) {
    logger.error(`💥 STRIPE_WEBHOOK_SECRET not configured`);
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    // Get raw body for signature verification
    const body = req.rawBody || req.body;
    // Instantiate Stripe only for webhook verification and any API operations
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2023-10-16',
      appInfo: {
        name: 'Vixter Platform',
        version: '1.0.0',
      },
    });
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    logger.error(`💥 Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Use idempotency key to prevent duplicate processing
    const idempotencyKey = `${event.id}_${event.type}`;
    const processedRef = db.collection('webhookProcessed').doc(idempotencyKey);
    const processedDoc = await processedRef.get();

    if (processedDoc.exists) {
      logger.info(`🔄 Event already processed: ${idempotencyKey}`);
      return res.json({ received: true, status: 'already_processed' });
    }

    // Mark as being processed
    await processedRef.set({
      eventId: event.id,
      eventType: event.type,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processing'
    });

    switch (event.type) {
      case 'checkout.session.completed':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'checkout.session.expired':
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        // For subscription payments (future feature)
        logger.info(`📋 Invoice payment succeeded: ${event.data.object.id}`);
        break;
      case 'customer.subscription.updated':
        // For subscription updates (future feature)
        logger.info(`🔄 Subscription updated: ${event.data.object.id}`);
        break;
      default:
        logger.info(`🔔 Unhandled event type: ${event.type}`);
    }

    // Mark as successfully processed
    await processedRef.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ received: true, status: 'processed' });
  } catch (error) {
    logger.error(`💥 Erro no webhook Stripe:`, error);
    
    // Mark as failed for retry logic
    const idempotencyKey = `${event.id}_${event.type}`;
    await db.collection('webhookProcessed').doc(idempotencyKey).update({
      status: 'failed',
      error: error.message,
      failedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(500).send('Webhook Error');
  }
});

/**
 * Processa pagamento bem-sucedido
 */
async function handlePaymentSuccess(session) {
  const sessionId = session.id;
  const userId = session.metadata.userId;
  const vpAmount = parseInt(session.metadata.vpAmount);
  const vbpBonus = parseInt(session.metadata.vbpBonus);

  logger.info(`💰 Processando pagamento bem-sucedido: ${sessionId}`);

  // Usar transação Firestore para garantir consistência
  await db.runTransaction(async (transaction) => {
    // Buscar dados da sessão
    const paymentRef = db.collection('stripePayments').doc(sessionId);
    const paymentDoc = await transaction.get(paymentRef);

    if (!paymentDoc.exists) {
      throw new Error(`Sessão de pagamento não encontrada: ${sessionId}`);
    }

    const paymentData = paymentDoc.data();
    if (paymentData.status === 'completed') {
      logger.warn(`⚠️ Pagamento já processado: ${sessionId}`);
      return;
    }

    // Atualizar carteira
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await transaction.get(walletRef);

    let currentWallet;
    if (!walletDoc.exists) {
      // Criar carteira se não existir
      currentWallet = { uid: userId, vp: 0, vc: 0, vbp: 0 };
      transaction.set(walletRef, {
        ...currentWallet,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      currentWallet = walletDoc.data();
    }

    // Atualizar saldos
    const newVp = (currentWallet.vp || 0) + vpAmount;
    const newVbp = (currentWallet.vbp || 0) + vbpBonus;

    transaction.update(walletRef, {
      vp: newVp,
      vbp: newVbp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Criar transação
    const transactionRef = db.collection('transactions').doc();
    transaction.set(transactionRef, {
      id: transactionRef.id,
      userId: userId,
      type: 'BUY_VP',
      amounts: {
        vp: vpAmount,
        vbp: vbpBonus > 0 ? vbpBonus : null
      },
      ref: {
        stripeSessionId: sessionId
      },
      status: 'CONFIRMED',
      metadata: {
        description: `Compra de ${vpAmount} VP via Stripe`,
        currency: 'BRL',
        originalAmount: session.amount_total
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Marcar pagamento como completo
    transaction.update(paymentRef, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ VP creditado: ${vpAmount} VP + ${vbpBonus} VBP para ${userId}`);
  });
}

/**
 * Processa falha no pagamento
 */
async function handlePaymentFailure(session) {
  const sessionId = session.id;
  logger.info(`❌ Processando falha no pagamento: ${sessionId}`);

  try {
    const paymentRef = db.collection('stripePayments').doc(sessionId);
    await paymentRef.update({
      status: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`💥 Erro ao processar falha no pagamento:`, error);
  }
}

/**
 * Processa venda de pack (VC imediato)
 */
export const processPackSale = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { buyerId, sellerId, vpAmount, packId, packName } = request.data;

  // Validações
  if (!buyerId || !sellerId || !vpAmount || vpAmount <= 0 || !packId || !packName) {
    throw new HttpsError("invalid-argument", "Dados da venda inválidos");
  }

  if (buyerId === sellerId) {
    throw new HttpsError("invalid-argument", "Comprador e vendedor não podem ser o mesmo");
  }

  // Calcular VC do vendedor (1 VC = 1.5 VP)
  const vcAmount = Math.floor(vpAmount / 1.5);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar carteiras
      const buyerWalletRef = db.collection('wallets').doc(buyerId);
      const sellerWalletRef = db.collection('wallets').doc(sellerId);

      const [buyerDoc, sellerDoc] = await Promise.all([
        transaction.get(buyerWalletRef),
        transaction.get(sellerWalletRef)
      ]);

      // Verificar se carteiras existem
      if (!buyerDoc.exists || !sellerDoc.exists) {
        throw new Error("Carteira não encontrada");
      }

      const buyerWallet = buyerDoc.data();
      const sellerWallet = sellerDoc.data();

      // Verificar saldo do comprador
      if ((buyerWallet.vp || 0) < vpAmount) {
        throw new Error("Saldo insuficiente");
      }

      // Atualizar saldos
      const newBuyerVp = (buyerWallet.vp || 0) - vpAmount;
      const newSellerVc = (sellerWallet.vc || 0) + vcAmount;

      transaction.update(buyerWalletRef, {
        vp: newBuyerVp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(sellerWalletRef, {
        vc: newSellerVc,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transações
      const buyerTransactionRef = db.collection('transactions').doc();
      const sellerTransactionRef = db.collection('transactions').doc();

      // Transação do comprador (débito VP)
      transaction.set(buyerTransactionRef, {
        id: buyerTransactionRef.id,
        userId: buyerId,
        type: 'SALE_PACK',
        amounts: { vp: -vpAmount },
        ref: {
          packId: packId,
          targetUserId: sellerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Compra de Pack: ${packName}`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Transação do vendedor (crédito VC imediato)
      transaction.set(sellerTransactionRef, {
        id: sellerTransactionRef.id,
        userId: sellerId,
        type: 'SALE_PACK',
        amounts: { vc: vcAmount },
        ref: {
          packId: packId,
          targetUserId: buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Venda de Pack: ${packName}`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        vpDebited: vpAmount,
        vcCredited: vcAmount,
        conversionRate: 1.5
      };
    });

    logger.info(`✅ Venda processada: ${vpAmount} VP → ${vcAmount} VC`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao processar venda de pack:`, error.message);
    
    if (error.message === "Saldo insuficiente") {
      throw new HttpsError("failed-precondition", "Saldo insuficiente para realizar a compra");
    } else if (error.message === "Carteira não encontrada") {
      throw new HttpsError("not-found", "Carteira não encontrada");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Processa compra de serviço (VC vai para vcPending)
 */
export const processServicePurchase = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { buyerId, sellerId, vpAmount, serviceId, serviceName, serviceDescription } = request.data;

  // Validações
  if (!buyerId || !sellerId || !vpAmount || vpAmount <= 0 || !serviceId || !serviceName) {
    throw new HttpsError("invalid-argument", "Dados da compra inválidos");
  }

  if (buyerId === sellerId) {
    throw new HttpsError("invalid-argument", "Comprador e vendedor não podem ser o mesmo");
  }

  // Calcular VC do vendedor (1 VC = 1.5 VP)
  const vcAmount = Math.floor(vpAmount / 1.5);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar carteiras
      const buyerWalletRef = db.collection('wallets').doc(buyerId);
      const sellerWalletRef = db.collection('wallets').doc(sellerId);

      const [buyerDoc, sellerDoc] = await Promise.all([
        transaction.get(buyerWalletRef),
        transaction.get(sellerWalletRef)
      ]);

      // Verificar se carteiras existem
      if (!buyerDoc.exists || !sellerDoc.exists) {
        throw new Error("Carteira não encontrada");
      }

      const buyerWallet = buyerDoc.data();
      const sellerWallet = sellerDoc.data();

      // Verificar saldo do comprador
      if ((buyerWallet.vp || 0) < vpAmount) {
        throw new Error("Saldo insuficiente");
      }

      // Atualizar saldos
      const newBuyerVp = (buyerWallet.vp || 0) - vpAmount;
      const newSellerVcPending = (sellerWallet.vcPending || 0) + vcAmount;

      transaction.update(buyerWalletRef, {
        vp: newBuyerVp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(sellerWalletRef, {
        vcPending: newSellerVcPending,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar pedido de serviço
      const serviceOrderRef = db.collection('serviceOrders').doc();
      const autoReleaseTime = new Date(Date.now() + (48 * 60 * 60 * 1000)); // 48h para aceitar + entregar + confirmar

      transaction.set(serviceOrderRef, {
        id: serviceOrderRef.id,
        serviceId: serviceId,
        buyerId: buyerId,
        sellerId: sellerId,
        vpAmount: vpAmount,
        vcAmount: vcAmount,
        status: 'PENDING_ACCEPTANCE',
        metadata: {
          serviceName: serviceName,
          serviceDescription: serviceDescription || ''
        },
        timestamps: {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          autoReleaseAt: autoReleaseTime
        },
        transactionIds: {}
      });

      // Criar transações
      const buyerTransactionRef = db.collection('transactions').doc();
      const sellerTransactionRef = db.collection('transactions').doc();

      // Transação do comprador (débito VP)
      transaction.set(buyerTransactionRef, {
        id: buyerTransactionRef.id,
        userId: buyerId,
        type: 'SALE_SERVICE',
        amounts: { vp: -vpAmount },
        ref: {
          serviceId: serviceId,
          serviceOrderId: serviceOrderRef.id,
          targetUserId: sellerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Compra de Serviço: ${serviceName}`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Transação do vendedor (VC pendente)
      transaction.set(sellerTransactionRef, {
        id: sellerTransactionRef.id,
        userId: sellerId,
        type: 'SALE_SERVICE',
        amounts: { vcPending: vcAmount },
        ref: {
          serviceId: serviceId,
          serviceOrderId: serviceOrderRef.id,
          targetUserId: buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Venda de Serviço: ${serviceName} (Pendente)`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar pedido com IDs das transações
      transaction.update(serviceOrderRef, {
        'transactionIds.purchaseId': buyerTransactionRef.id
      });

      return {
        vpDebited: vpAmount,
        vcPending: vcAmount,
        serviceOrderId: serviceOrderRef.id,
        conversionRate: 1.5
      };
    });

    logger.info(`✅ Compra de serviço processada: ${vpAmount} VP → ${vcAmount} VC pendente`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao processar compra de serviço:`, error.message);
    
    if (error.message === "Saldo insuficiente") {
      throw new HttpsError("failed-precondition", "Saldo insuficiente para realizar a compra");
    } else if (error.message === "Carteira não encontrada") {
      throw new HttpsError("not-found", "Carteira não encontrada");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Concede bônus diário VBP
 */
export const claimDailyBonus = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = request.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Verificar último bônus
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);

      if (userDoc.exists) {
        const userData = userDoc.data();
        const lastBonus = userData.lastDailyBonus;
        
        if (lastBonus) {
          const lastBonusDate = new Date(lastBonus.toDate()).toDateString();
          const today = new Date().toDateString();
          
          if (lastBonusDate === today) {
            throw new Error("Bônus já coletado hoje");
          }
        }
      }

      // Gerar bônus aleatório
      const bonusAmount = Math.floor(Math.random() * 201) + 50; // 50-250 VBP

      // Atualizar carteira
      const walletRef = db.collection('wallets').doc(userId);
      const walletDoc = await transaction.get(walletRef);

      if (!walletDoc.exists) {
        throw new Error("Carteira não encontrada");
      }

      const wallet = walletDoc.data();
      const newVbp = (wallet.vbp || 0) + bonusAmount;

      transaction.update(walletRef, {
        vbp: newVbp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Marcar bônus como coletado
      transaction.update(userRef, {
        lastDailyBonus: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação
      const transactionRef = db.collection('transactions').doc();
      transaction.set(transactionRef, {
        id: transactionRef.id,
        userId: userId,
        type: 'BONUS',
        amounts: { vbp: bonusAmount },
        status: 'CONFIRMED',
        metadata: {
          description: 'Bônus Diário'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { bonusAmount };
    });

    logger.info(`✅ Bônus diário concedido: ${result.bonusAmount} VBP para ${userId}`);
    return { success: true, bonusAmount: result.bonusAmount };

  } catch (error) {
    if (error.message === "Bônus já coletado hoje") {
      throw new HttpsError("already-exists", "Bônus diário já foi coletado hoje");
    } else if (error.message === "Carteira não encontrada") {
      throw new HttpsError("not-found", "Carteira não encontrada");
    }

    logger.error(`💥 Erro ao conceder bônus diário:`, error);
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Confirma entrega de serviço e libera VC pendente
 */
export const confirmServiceDelivery = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { serviceOrderId, feedback } = request.data;
  if (!serviceOrderId) {
    throw new HttpsError("invalid-argument", "ID do pedido é obrigatório");
  }

  const userId = request.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar pedido de serviço
      const orderRef = db.collection('serviceOrders').doc(serviceOrderId);
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("Pedido não encontrado");
      }

      const order = orderDoc.data();

      // Verificar se o usuário é o comprador
      if (order.buyerId !== userId) {
        throw new Error("Não autorizado");
      }

      // Verificar se o pedido está entregue
      if (order.status !== 'DELIVERED') {
        throw new Error("Pedido não está marcado como entregue");
      }

      // Atualizar carteira do vendedor (VC pendente → VC real)
      const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
      const sellerWalletDoc = await transaction.get(sellerWalletRef);

      if (!sellerWalletDoc.exists) {
        throw new Error("Carteira do vendedor não encontrada");
      }

      const sellerWallet = sellerWalletDoc.data();
      const newVc = (sellerWallet.vc || 0) + order.vcAmount;
      const newVcPending = Math.max(0, (sellerWallet.vcPending || 0) - order.vcAmount);

      // Atualizar carteira
      transaction.update(sellerWalletRef, {
        vc: newVc,
        vcPending: newVcPending,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar status do pedido
      transaction.update(orderRef, {
        status: 'CONFIRMED',
        'metadata.buyerFeedback': feedback || '',
        'timestamps.confirmedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de confirmação
      const transactionRef = db.collection('transactions').doc();
      transaction.set(transactionRef, {
        id: transactionRef.id,
        userId: order.sellerId,
        type: 'SERVICE_CONFIRM',
        amounts: { 
          vc: order.vcAmount,
          vcPending: -order.vcAmount
        },
        ref: {
          serviceId: order.serviceId,
          serviceOrderId: serviceOrderId,
          targetUserId: order.buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Serviço Confirmado: ${order.metadata.serviceName}`,
          buyerFeedback: feedback || ''
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar pedido com ID da transação
      transaction.update(orderRef, {
        'transactionIds.confirmationId': transactionRef.id
      });

      return {
        vcReleased: order.vcAmount,
        orderId: serviceOrderId
      };
    });

    logger.info(`✅ Serviço confirmado: ${serviceOrderId} - ${result.vcReleased} VC liberado`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao confirmar serviço:`, error.message);
    
    if (error.message === "Pedido não encontrado") {
      throw new HttpsError("not-found", "Pedido não encontrado");
    } else if (error.message === "Não autorizado") {
      throw new HttpsError("permission-denied", "Você não tem permissão para confirmar este pedido");
    } else if (error.message === "Pedido não está marcado como entregue") {
      throw new HttpsError("failed-precondition", "O pedido precisa estar marcado como entregue primeiro");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Rejeita pedido de serviço e reembolsa VP ao comprador
 */
export const rejectServiceOrder = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { serviceOrderId, reason } = request.data;
  if (!serviceOrderId) {
    throw new HttpsError("invalid-argument", "ID do pedido é obrigatório");
  }

  const userId = request.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar pedido de serviço
      const orderRef = db.collection('serviceOrders').doc(serviceOrderId);
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("Pedido não encontrado");
      }

      const order = orderDoc.data();

      // Verificar se o usuário é o comprador
      if (order.buyerId !== userId) {
        throw new Error("Não autorizado");
      }

      // Verificar se o pedido pode ser rejeitado
      if (!['PENDING_ACCEPTANCE', 'ACCEPTED'].includes(order.status)) {
        throw new Error("Pedido não pode ser rejeitado neste estado");
      }

      // Reembolsar VP ao comprador
      const buyerWalletRef = db.collection('wallets').doc(order.buyerId);
      const buyerWalletDoc = await transaction.get(buyerWalletRef);

      if (!buyerWalletDoc.exists) {
        throw new Error("Carteira do comprador não encontrada");
      }

      const buyerWallet = buyerWalletDoc.data();
      const newVp = (buyerWallet.vp || 0) + order.vpAmount;

      // Atualizar carteira do comprador
      transaction.update(buyerWalletRef, {
        vp: newVp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Remover VC pendente do vendedor
      const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
      const sellerWalletDoc = await transaction.get(sellerWalletRef);

      if (sellerWalletDoc.exists) {
        const sellerWallet = sellerWalletDoc.data();
        const newVcPending = Math.max(0, (sellerWallet.vcPending || 0) - order.vcAmount);

        transaction.update(sellerWalletRef, {
          vcPending: newVcPending,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Atualizar status do pedido
      transaction.update(orderRef, {
        status: 'REJECTED',
        'metadata.rejectionReason': reason || 'Rejeitado pelo comprador',
        'timestamps.rejectedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de reembolso para o comprador
      const refundTransactionRef = db.collection('transactions').doc();
      transaction.set(refundTransactionRef, {
        id: refundTransactionRef.id,
        userId: order.buyerId,
        type: 'SERVICE_REFUND',
        amounts: { vp: order.vpAmount },
        ref: {
          serviceId: order.serviceId,
          serviceOrderId: serviceOrderId,
          targetUserId: order.sellerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Reembolso: ${order.metadata.serviceName}`,
          rejectionReason: reason || 'Rejeitado pelo comprador'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de cancelamento para o vendedor
      const cancelTransactionRef = db.collection('transactions').doc();
      transaction.set(cancelTransactionRef, {
        id: cancelTransactionRef.id,
        userId: order.sellerId,
        type: 'SERVICE_CANCEL',
        amounts: { vcPending: -order.vcAmount },
        ref: {
          serviceId: order.serviceId,
          serviceOrderId: serviceOrderId,
          targetUserId: order.buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Serviço Cancelado: ${order.metadata.serviceName}`,
          rejectionReason: reason || 'Rejeitado pelo comprador'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        vpRefunded: order.vpAmount,
        orderId: serviceOrderId
      };
    });

    logger.info(`✅ Serviço rejeitado: ${serviceOrderId} - ${result.vpRefunded} VP reembolsado`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao rejeitar serviço:`, error.message);
    
    if (error.message === "Pedido não encontrado") {
      throw new HttpsError("not-found", "Pedido não encontrado");
    } else if (error.message === "Não autorizado") {
      throw new HttpsError("permission-denied", "Você não tem permissão para rejeitar este pedido");
    } else if (error.message === "Pedido não pode ser rejeitado neste estado") {
      throw new HttpsError("failed-precondition", "Este pedido não pode mais ser rejeitado");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Função agendada para liberar automaticamente VC pendente após 24h
 */
export const autoReleaseServices = onSchedule({
  schedule: "*/30 * * * *", // A cada 30 minutos
  timeZone: "America/Sao_Paulo",
  memory: "64MiB",
  timeoutSeconds: 540,
}, async () => {
  try {
    logger.info("🕐 Iniciando liberação automática de serviços...");

    const now = admin.firestore.Timestamp.now();
    
    // Buscar pedidos entregues que passaram do prazo
    const expiredOrdersQuery = db.collection('serviceOrders')
      .where('status', '==', 'DELIVERED')
      .where('timestamps.autoReleaseAt', '<=', now)
      .limit(50); // Processar em lotes

    const expiredOrdersSnapshot = await expiredOrdersQuery.get();

    if (expiredOrdersSnapshot.empty) {
      logger.info("✅ Nenhum serviço para liberar automaticamente");
      return { processed: 0 };
    }

    let processedCount = 0;
    const batch = db.batch();

    for (const orderDoc of expiredOrdersSnapshot.docs) {
      const order = orderDoc.data();
      const orderRef = orderDoc.ref;

      try {
        // Liberar VC pendente para VC real
        const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
        const sellerWalletDoc = await sellerWalletRef.get();

        if (!sellerWalletDoc.exists) {
          logger.warn(`⚠️ Carteira não encontrada para vendedor: ${order.sellerId}`);
          continue;
        }

        const sellerWallet = sellerWalletDoc.data();
        const newVc = (sellerWallet.vc || 0) + order.vcAmount;
        const newVcPending = Math.max(0, (sellerWallet.vcPending || 0) - order.vcAmount);

        // Atualizar carteira
        batch.update(sellerWalletRef, {
          vc: newVc,
          vcPending: newVcPending,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Atualizar status do pedido
        batch.update(orderRef, {
          status: 'AUTO_RELEASED',
          'timestamps.confirmedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        // Criar transação de liberação automática
        const transactionRef = db.collection('transactions').doc();
        batch.set(transactionRef, {
          id: transactionRef.id,
          userId: order.sellerId,
          type: 'SERVICE_AUTO_RELEASE',
          amounts: { 
            vc: order.vcAmount,
            vcPending: -order.vcAmount
          },
          ref: {
            serviceId: order.serviceId,
            serviceOrderId: orderDoc.id,
            targetUserId: order.buyerId
          },
          status: 'CONFIRMED',
          metadata: {
            description: `Serviço Auto-Liberado: ${order.metadata.serviceName}`,
            reason: 'Comprador não confirmou em 24h'
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Atualizar pedido com ID da transação
        batch.update(orderRef, {
          'transactionIds.confirmationId': transactionRef.id
        });

        processedCount++;
        logger.info(`✅ Serviço auto-liberado: ${orderDoc.id} - ${order.vcAmount} VC`);

      } catch (error) {
        logger.error(`💥 Erro ao processar pedido ${orderDoc.id}:`, error);
      }
    }

    if (processedCount > 0) {
      await batch.commit();
      logger.info(`✅ ${processedCount} serviços liberados automaticamente`);
    }

    return { processed: processedCount };

  } catch (error) {
    logger.error("💥 Erro na liberação automática:", error);
    throw error;
  }
});
