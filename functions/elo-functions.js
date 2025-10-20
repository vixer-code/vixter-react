import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Configurações padrão dos elos
 */
const DEFAULT_ELO_CONFIG = {
  ferro: {
    name: 'Ferro',
    order: 1,
    requirements: {
      client: {
        totalSpent: 0,
        totalPacksBought: 0,
        totalServicesBought: 0,
        totalVixtipsSentAmount: 0
      },
      provider: {
        totalPacksSold: 0,
        totalServicesSold: 0,
        totalSales: 0,
        totalVixtipsReceivedAmount: 0,
        totalVcEarned: 0
      }
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
      client: {
        totalSpent: 1000,
        totalPacksBought: 1,
        totalServicesBought: 0,
        totalVixtipsSentAmount: 0
      },
      provider: {
        totalPacksSold: 1,
        totalServicesSold: 0,
        totalSales: 1,
        totalVixtipsReceivedAmount: 0,
        totalVcEarned: 10
      }
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
      client: {
        totalSpent: 5000,
        totalPacksBought: 3,
        totalServicesBought: 2,
        totalVixtipsSentAmount: 100
      },
      provider: {
        totalPacksSold: 5,
        totalServicesSold: 3,
        totalSales: 8,
        totalVixtipsReceivedAmount: 200,
        totalVcEarned: 100
      }
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
      client: {
        totalSpent: 15000,
        totalPacksBought: 8,
        totalServicesBought: 5,
        totalVixtipsSentAmount: 500
      },
      provider: {
        totalPacksSold: 15,
        totalServicesSold: 10,
        totalSales: 25,
        totalVixtipsReceivedAmount: 1000,
        totalVcEarned: 500
      }
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
      client: {
        totalSpent: 35000,
        totalPacksBought: 20,
        totalServicesBought: 15,
        totalVixtipsSentAmount: 1500
      },
      provider: {
        totalPacksSold: 40,
        totalServicesSold: 25,
        totalSales: 65,
        totalVixtipsReceivedAmount: 3000,
        totalVcEarned: 1500
      }
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
      client: {
        totalSpent: 75000,
        totalPacksBought: 50,
        totalServicesBought: 35,
        totalVixtipsSentAmount: 4000
      },
      provider: {
        totalPacksSold: 100,
        totalServicesSold: 60,
        totalSales: 160,
        totalVixtipsReceivedAmount: 8000,
        totalVcEarned: 4000
      }
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
      client: {
        totalSpent: 150000,
        totalPacksBought: 100,
        totalServicesBought: 75,
        totalVixtipsSentAmount: 10000
      },
      provider: {
        totalPacksSold: 250,
        totalServicesSold: 150,
        totalSales: 400,
        totalVixtipsReceivedAmount: 20000,
        totalVcEarned: 10000
      }
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
      client: {
        totalSpent: 300000,
        totalPacksBought: 200,
        totalServicesBought: 150,
        totalVixtipsSentAmount: 25000
      },
      provider: {
        totalPacksSold: 500,
        totalServicesSold: 300,
        totalSales: 800,
        totalVixtipsReceivedAmount: 50000,
        totalVcEarned: 25000
      }
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
    
    // Determinar elo baseado nas métricas
    let currentElo = 'ferro';
    let currentEloData = eloConfig.ferro;
    
    // Ordenar elos por ordem (maior para menor)
    const eloEntries = Object.entries(eloConfig).sort((a, b) => b[1].order - a[1].order);
    
    for (const [eloKey, eloData] of eloEntries) {
      const requirements = eloData.requirements[accountType];
      if (!requirements) continue;
      
      let meetsRequirements = true;
      
      // Verificar cada requisito
      for (const [metric, requiredValue] of Object.entries(requirements)) {
        const currentValue = stats[metric] || 0;
        if (currentValue < requiredValue) {
          meetsRequirements = false;
          break;
        }
      }
      
      if (meetsRequirements) {
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
      
      const nextRequirements = nextEloData.requirements[accountType];
      if (nextRequirements) {
        const progressData = {};
        
        for (const [metric, requiredValue] of Object.entries(nextRequirements)) {
          const currentValue = stats[metric] || 0;
          const currentEloValue = currentEloData.requirements[accountType][metric] || 0;
          
          if (requiredValue > currentEloValue) {
            const progressValue = Math.min(100, Math.max(0, 
              ((currentValue - currentEloValue) / (requiredValue - currentEloValue)) * 100
            ));
            progressData[metric] = {
              current: currentValue,
              required: requiredValue,
              progress: Math.round(progressValue)
            };
          }
        }
        
        progress = progressData;
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

export {
  initializeEloConfig,
  updateEloConfig,
  getEloConfig,
  calculateUserElo,
  updateUserElo,
  getUserElo
};
