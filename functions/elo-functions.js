import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Configurações padrão dos elos baseadas em XP
 */
const DEFAULT_ELO_CONFIG = {
  ferro: {
    name: 'Ferro',
    order: 1,
    requirements: {
      xp: 0
    },
    benefits: {
      badgeColor: '#8B4513',
      description: 'Início da jornada',
      imageUrl: '/images/iron.png'
    }
  },
  bronze: {
    name: 'Bronze',
    order: 2,
    requirements: {
      xp: 1250
    },
    benefits: {
      badgeColor: '#CD7F32',
      description: 'Primeiros passos',
      imageUrl: '/images/bronze.png'
    }
  },
  prata: {
    name: 'Prata',
    order: 3,
    requirements: {
      xp: 5450  // 1250 + 4200
    },
    benefits: {
      badgeColor: '#C0C0C0',
      description: 'Crescimento constante',
      imageUrl: '/images/silver.png'
    }
  },
  ouro: {
    name: 'Ouro',
    order: 4,
    requirements: {
      xp: 13950  // 1250 + 4200 + 8500
    },
    benefits: {
      badgeColor: '#FFD700',
      description: 'Excelência em atividade',
      imageUrl: '/images/gold.png'
    }
  },
  platina: {
    name: 'Platina',
    order: 5,
    requirements: {
      xp: 29300  // 1250 + 4200 + 8500 + 15350
    },
    benefits: {
      badgeColor: '#E5E4E2',
      description: 'Dedicação exemplar',
      imageUrl: '/images/platinum.png'
    }
  },
  esmeralda: {
    name: 'Esmeralda',
    order: 6,
    requirements: {
      xp: 48100  // 1250 + 4200 + 8500 + 15350 + 18800
    },
    benefits: {
      badgeColor: '#50C878',
      description: 'Maestria em engajamento',
      imageUrl: '/images/emerald.png'
    }
  },
  diamante: {
    name: 'Diamante',
    order: 7,
    requirements: {
      xp: 70400  // 1250 + 4200 + 8500 + 15350 + 18800 + 22300
    },
    benefits: {
      badgeColor: '#B9F2FF',
      description: 'Elite da plataforma',
      imageUrl: '/images/diamond.png'
    }
  },
  mestre: {
    name: 'Mestre',
    order: 8,
    requirements: {
      xp: 98600  // 1250 + 4200 + 8500 + 15350 + 18800 + 22300 + 28200
    },
    benefits: {
      badgeColor: '#800080',
      description: 'Lenda da comunidade',
      imageUrl: '/images/master.png'
    }
  }
};

/**
 * Inicializa as configurações dos elos no banco de dados
 */
const initializeEloConfig = onCall({
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    logger.info('🔄 Inicializando configurações dos elos...');
    
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    
    await eloConfigRef.set({
      config: DEFAULT_ELO_CONFIG,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0.0'
    }, { merge: true });
    
    logger.info('✅ Configurações dos elos inicializadas com sucesso');
    
    return {
      success: true,
      message: 'Configurações dos elos inicializadas com sucesso',
      config: DEFAULT_ELO_CONFIG
    };
    
  } catch (error) {
    logger.error('❌ Erro ao inicializar configurações dos elos:', error);
    throw new HttpsError("internal", "Erro interno ao inicializar configurações dos elos");
  }
});

/**
 * Atualiza as configurações dos elos
 */
const updateEloConfig = onCall({
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { newConfig } = request.data;
  
  if (!newConfig) {
    throw new HttpsError("invalid-argument", "Configuração é obrigatória");
  }

  try {
    logger.info('🔄 Atualizando configurações dos elos...');
    
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    
    await eloConfigRef.set({
      config: newConfig,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0.1'
    }, { merge: true });
    
    logger.info('✅ Configurações dos elos atualizadas com sucesso');
    
    return {
      success: true,
      message: 'Configurações dos elos atualizadas com sucesso'
    };
    
  } catch (error) {
    logger.error('❌ Erro ao atualizar configurações dos elos:', error);
    throw new HttpsError("internal", "Erro interno ao atualizar configurações dos elos");
  }
});

/**
 * Obtém as configurações dos elos
 */
const getEloConfig = onCall({
  memory: "64MiB",
  timeoutSeconds: 15,
}, async (request) => {
  try {
    logger.info('🔄 Obtendo configurações dos elos...');
    
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    const eloConfigSnap = await eloConfigRef.get();
    
    if (!eloConfigSnap.exists) {
      // Se não existir, retorna configuração padrão
      return {
        success: true,
        config: DEFAULT_ELO_CONFIG,
        isDefault: true
      };
    }
    
    const eloConfig = eloConfigSnap.data();
    
    logger.info('✅ Configurações dos elos obtidas com sucesso');
    
    return {
      success: true,
      config: eloConfig.config,
      lastUpdated: eloConfig.lastUpdated,
      version: eloConfig.version
    };
    
  } catch (error) {
    logger.error('❌ Erro ao obter configurações dos elos:', error);
    throw new HttpsError("internal", "Erro interno ao obter configurações dos elos");
  }
});

/**
 * Calcula o elo atual do usuário baseado nas métricas
 */
const calculateUserElo = onCall({
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId } = request.data;
  const targetUserId = userId || request.auth.uid;

  try {
    logger.info(`🔄 Calculando elo para usuário: ${targetUserId}`);
    
    // Obter configurações dos elos
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    const eloConfigSnap = await eloConfigRef.get();
    
    const eloConfig = eloConfigSnap.exists ? eloConfigSnap.data().config : DEFAULT_ELO_CONFIG;
    
    // Obter dados do usuário
    const userRef = db.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "Usuário não encontrado");
    }
    
    const userData = userSnap.data();
    const accountType = userData.accountType || 'client';
    const stats = userData.stats || {};
    const currentXp = stats.xp || 0;
    
    // Determinar elo baseado no XP
    let currentElo = 'ferro';
    let currentEloData = eloConfig.ferro;
    
    // Ordenar elos por ordem (maior para menor)
    const eloEntries = Object.entries(eloConfig).sort((a, b) => b[1].order - a[1].order);
    
    for (const [eloKey, eloData] of eloEntries) {
      const requiredXp = eloData.requirements.xp || 0;
      
      if (currentXp >= requiredXp) {
        currentElo = eloKey;
        currentEloData = eloData;
        break;
      }
    }
    
    // Calcular progresso para o próximo elo
    let nextElo = null;
    let progress = null;
    
    const currentEloOrder = currentEloData.order;
    const nextEloEntry = eloEntries.find(([_, data]) => data.order === currentEloOrder + 1);
    
    if (nextEloEntry) {
      const [nextEloKey, nextEloData] = nextEloEntry;
      nextElo = nextEloKey;
      
      const nextRequiredXp = nextEloData.requirements.xp || 0;
      const currentRequiredXp = currentEloData.requirements.xp || 0;
      
      if (nextRequiredXp > currentRequiredXp) {
        const progressValue = Math.min(100, Math.max(0, 
          ((currentXp - currentRequiredXp) / (nextRequiredXp - currentRequiredXp)) * 100
        ));
        
        progress = {
          xp: {
            current: currentXp,
            required: nextRequiredXp,
            progress: Math.round(progressValue)
          }
        };
      }
    }
    
    logger.info(`✅ Elo calculado para ${targetUserId}: ${currentElo}`);
    
    return {
      success: true,
      elo: {
        current: currentElo,
        name: currentEloData.name,
        order: currentEloData.order,
        benefits: currentEloData.benefits,
        nextElo: nextElo,
        progress: progress
      },
      stats: stats,
      accountType: accountType
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao calcular elo para ${targetUserId}:`, error);
    throw new HttpsError("internal", "Erro interno ao calcular elo do usuário");
  }
});

/**
 * Atualiza o elo do usuário no documento do usuário
 */
const updateUserElo = onCall({
  memory: "64MiB",
  timeoutSeconds: 15,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId } = request.data;
  const targetUserId = userId || request.auth.uid;

  try {
    logger.info(`🔄 Atualizando elo para usuário: ${targetUserId}`);
    
    // Calcular elo atual
    const eloResult = await calculateUserElo({ data: { userId: targetUserId }, auth: request.auth });
    
    if (!eloResult.success) {
      throw new HttpsError("internal", "Erro ao calcular elo do usuário");
    }
    
    const { elo } = eloResult;
    
    // Atualizar documento do usuário
    const userRef = db.collection('users').doc(targetUserId);
    await userRef.update({
      elo: {
        current: elo.current,
        name: elo.name,
        order: elo.order,
        benefits: elo.benefits,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info(`✅ Elo atualizado para ${targetUserId}: ${elo.current}`);
    
    return {
      success: true,
      elo: elo,
      message: `Elo atualizado para ${elo.name}`
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao atualizar elo para ${targetUserId}:`, error);
    throw new HttpsError("internal", "Erro interno ao atualizar elo do usuário");
  }
});

/**
 * Obtém informações do elo de um usuário
 */
const getUserElo = onCall({
  memory: "64MiB",
  timeoutSeconds: 15,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId } = request.data;
  const targetUserId = userId || request.auth.uid;

  try {
    logger.info(`🔄 Obtendo elo para usuário: ${targetUserId}`);
    
    // Obter dados do usuário
    const userRef = db.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "Usuário não encontrado");
    }
    
    const userData = userSnap.data();
    const elo = userData.elo || null;
    
    logger.info(`✅ Elo obtido para ${targetUserId}: ${elo?.current || 'ferro'}`);
    
    return {
      success: true,
      elo: elo,
      userId: targetUserId
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao obter elo para ${targetUserId}:`, error);
    throw new HttpsError("internal", "Erro interno ao obter elo do usuário");
  }
});

/**
 * Calcula XP baseado na nova fórmula: (x*0.67)*2y=z
 * x = valor em VP do produto
 * y = tipo do produto (1 = vixtips, 1.5 = packs, 2 = serviços)
 * z = valor total de XP
 */
const calculateXpFromTransaction = (transactionType, vpAmount, productType = null) => {
  // Determinar o tipo de produto (y) baseado na transação
  let productMultiplier = 1; // Default para vixtips
  
  if (productType) {
    // Se o tipo do produto foi especificado, usar ele
    productMultiplier = productType;
  } else {
    // Determinar baseado no tipo de transação
    switch (transactionType) {
      case 'PACK_SALE':
      case 'PACK_PURCHASE':
        productMultiplier = 1.5; // Packs
        break;
      case 'SERVICE_SALE':
      case 'SERVICE_PURCHASE':
        productMultiplier = 2; // Serviços
        break;
      case 'VIXTIP_SENT':
      case 'VIXTIP_RECEIVED':
        productMultiplier = 1; // Vixtips
        break;
      default:
        productMultiplier = 1; // Default para vixtips
    }
  }
  
  // Aplicar fórmula: (x*0.67)*2y = z
  // x = vpAmount (valor em VP)
  // y = productMultiplier (tipo do produto)
  const xp = Math.floor((vpAmount * 0.67) * (2 * productMultiplier));
  
  return xp;
};

/**
 * Adiciona XP ao usuário e atualiza o elo
 */
const addXpToUser = onCall({
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId, xpAmount, transactionType, transactionId } = request.data;

  try {
    logger.info(`🔄 Adicionando ${xpAmount} XP para usuário: ${userId}`);
    
    // Atualizar XP do usuário
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "Usuário não encontrado");
    }
    
    const userData = userSnap.data();
    const currentXp = userData.stats?.xp || 0;
    const newXp = currentXp + xpAmount;
    
    // Atualizar stats do usuário
    await userRef.update({
      'stats.xp': newXp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Registrar transação de XP
    await db.collection('xpTransactions').add({
      userId: userId,
      xpAmount: xpAmount,
      transactionType: transactionType,
      transactionId: transactionId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Recalcular elo do usuário
    const eloResult = await calculateUserElo({ 
      data: { userId: userId }, 
      auth: request.auth 
    });
    
    if (eloResult.success) {
      const { elo } = eloResult;
      
      // Atualizar elo no documento do usuário
      await userRef.update({
        elo: {
          current: elo.current,
          name: elo.name,
          order: elo.order,
          benefits: elo.benefits,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
      });
    }
    
    logger.info(`✅ ${xpAmount} XP adicionado para ${userId}. Total: ${newXp}`);
    
    return {
      success: true,
      newXp: newXp,
      xpAdded: xpAmount
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao adicionar XP para ${userId}:`, error);
    throw new HttpsError("internal", "Erro interno ao adicionar XP");
  }
});

export {
  initializeEloConfig,
  updateEloConfig,
  getEloConfig,
  calculateUserElo,
  updateUserElo,
  getUserElo,
  calculateXpFromTransaction,
  addXpToUser
};
