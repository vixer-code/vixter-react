import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

/**
 * Hook para gerenciar elos dos usuários
 */
export const useElo = () => {
  const [eloConfig, setEloConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Funções para gerenciar configurações dos elos
  const initializeEloConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const initializeConfig = httpsCallable(functions, 'initializeEloConfig');
      const result = await initializeConfig();
      
      if (result.data.success) {
        setEloConfig(result.data.config);
        return result.data;
      }
      
      throw new Error(result.data.message || 'Erro ao inicializar configurações');
    } catch (err) {
      console.error('Error initializing elo config:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEloConfig = useCallback(async (newConfig) => {
    try {
      setLoading(true);
      setError(null);
      
      const updateConfig = httpsCallable(functions, 'updateEloConfig');
      const result = await updateConfig({ newConfig });
      
      if (result.data.success) {
        setEloConfig(newConfig);
        return result.data;
      }
      
      throw new Error(result.data.message || 'Erro ao atualizar configurações');
    } catch (err) {
      console.error('Error updating elo config:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEloConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const getConfig = httpsCallable(functions, 'getEloConfig');
      const result = await getConfig();
      
      if (result.data.success) {
        setEloConfig(result.data.config);
        return result.data;
      }
      
      throw new Error(result.data.message || 'Erro ao obter configurações');
    } catch (err) {
      console.error('Error getting elo config:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncAllUsersXpAndElo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const syncFunction = httpsCallable(functions, 'syncAllUsersXpAndElo');
      const result = await syncFunction();
      
      if (result.data.success) {
        return result.data;
      }
      
      throw new Error(result.data.message || 'Erro ao sincronizar XP e elos');
    } catch (err) {
      console.error('Error syncing all users XP and elo:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar configurações na inicialização
  useEffect(() => {
    if (!eloConfig) {
      getEloConfig().catch(() => {
        // Se falhar, tentar inicializar com configuração padrão
        initializeEloConfig().catch(console.error);
      });
    }
  }, [eloConfig, getEloConfig, initializeEloConfig]);

  return {
    eloConfig,
    loading,
    error,
    initializeEloConfig,
    updateEloConfig,
    getEloConfig,
    syncAllUsersXpAndElo
  };
};

/**
 * Hook para calcular e obter elo de um usuário específico
 */
export const useUserElo = (userId) => {
  const [userElo, setUserElo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculateUserElo = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return null;

    try {
      setLoading(true);
      setError(null);
      
      const calculateElo = httpsCallable(functions, 'calculateUserElo');
      const result = await calculateElo({ userId: targetUserId });
      
      if (result.data.success) {
        setUserElo(result.data);
        return result.data;
      }
      
      throw new Error(result.data.message || 'Erro ao calcular elo');
    } catch (err) {
      console.error('Error calculating user elo:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updateUserElo = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return null;

    try {
      setLoading(true);
      setError(null);
      
      const updateElo = httpsCallable(functions, 'updateUserElo');
      const result = await updateElo({ userId: targetUserId });
      
      if (result.data.success) {
        setUserElo(prev => ({
          ...prev,
          elo: result.data.elo
        }));
        return result.data;
      }
      
      throw new Error(result.data.message || 'Erro ao atualizar elo');
    } catch (err) {
      console.error('Error updating user elo:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const getUserElo = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return null;

    try {
      setLoading(true);
      setError(null);
      
      const getElo = httpsCallable(functions, 'getUserElo');
      const result = await getElo({ userId: targetUserId });
      
      if (result.data.success) {
        setUserElo(result.data);
        return result.data;
      }
      
      throw new Error(result.data.message || 'Erro ao obter elo');
    } catch (err) {
      console.error('Error getting user elo:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Carregar elo na inicialização
  useEffect(() => {
    if (userId) {
      getUserElo().catch(console.error);
    }
  }, [userId, getUserElo]);

  return {
    userElo,
    loading,
    error,
    calculateUserElo,
    updateUserElo,
    getUserElo
  };
};

/**
 * Utilitários para elos
 */
export const eloUtils = {
  /**
   * Obtém informações de um elo específico
   */
  getEloInfo: (eloKey, eloConfig) => {
    if (!eloConfig || !eloConfig[eloKey]) {
      return {
        name: 'Ferro',
        order: 1,
        benefits: {
          badgeColor: '#8B4513',
          description: 'Início da jornada'
        }
      };
    }
    
    return eloConfig[eloKey];
  },

  /**
   * Obtém a cor do elo
   */
  getEloColor: (eloKey, eloConfig) => {
    const eloInfo = eloUtils.getEloInfo(eloKey, eloConfig);
    return eloInfo.benefits?.badgeColor || '#8B4513';
  },

  /**
   * Obtém o nome do elo
   */
  getEloName: (eloKey, eloConfig) => {
    const eloInfo = eloUtils.getEloInfo(eloKey, eloConfig);
    return eloInfo.name || 'Ferro';
  },

  /**
   * Obtém a URL da imagem do elo
   */
  getEloImageUrl: (eloKey, eloConfig) => {
    const eloInfo = eloUtils.getEloInfo(eloKey, eloConfig);
    return eloInfo.benefits?.imageUrl || '/images/iron.png';
  },

  /**
   * Calcula o progresso para o próximo elo
   */
  calculateProgress: (currentStats, currentElo, nextElo, accountType) => {
    if (!nextElo || !currentElo) return null;

    const progress = {};
    
    for (const [metric, requiredValue] of Object.entries(nextElo.requirements[accountType])) {
      const currentValue = currentStats[metric] || 0;
      const currentEloValue = currentElo.requirements[accountType][metric] || 0;
      
      if (requiredValue > currentEloValue) {
        const progressValue = Math.min(100, Math.max(0, 
          ((currentValue - currentEloValue) / (requiredValue - currentEloValue)) * 100
        ));
        
        progress[metric] = {
          current: currentValue,
          required: requiredValue,
          progress: Math.round(progressValue)
        };
      }
    }
    
    return progress;
  }
};
