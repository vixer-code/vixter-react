import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useElo } from '../hooks/useElo';
import './EloSystem.css';

const EloSystem = () => {
  const { userProfile, userElo } = useUser();
  const { eloConfig, loading: configLoading, error: configError, syncAllUsersXpAndElo, recalculateAllElos } = useElo();
  const [activeTab, setActiveTab] = useState('my-elo');

  if (!userProfile) {
    return (
      <div className="elo-system">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Carregando informações do usuário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="elo-system">
      <div className="elo-header">
        <h1>Sistema de Elos</h1>
        <p className="elo-subtitle">
          Seu nível de engajamento e atividade na plataforma
        </p>
      </div>

      <div className="elo-tabs">
        <button 
          className={`tab-button ${activeTab === 'my-elo' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-elo')}
        >
          Meu Elo
        </button>
        <button 
          className={`tab-button ${activeTab === 'elo-list' ? 'active' : ''}`}
          onClick={() => setActiveTab('elo-list')}
        >
          Todos os Elos
        </button>
        <button 
          className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          Administração
        </button>
      </div>

      <div className="elo-content">
        {activeTab === 'my-elo' && (
          <div className="my-elo-tab">
            <MyEloTab 
              userProfile={userProfile}
              userElo={userElo}
              eloConfig={eloConfig}
            />
          </div>
        )}

        {activeTab === 'elo-list' && (
          <div className="elo-list-tab">
            <EloListTab eloConfig={eloConfig} />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="admin-tab">
            <AdminTab 
              syncAllUsersXpAndElo={syncAllUsersXpAndElo}
              loading={configLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const MyEloTab = ({ userProfile, userElo, eloConfig }) => {
  // Se não temos dados básicos, mostrar loading
  if (!userProfile) {
    return (
      <div className="elo-loading">
        <div className="loading-spinner"></div>
        <p>Carregando informações do elo...</p>
      </div>
    );
  }

  // Configuração dos elos chumbada no código
  const ELO_CONFIG = {
    ferro: { name: 'Ferro', order: 1, xp: 0, color: '#8B4513', image: '/images/iron.png', description: 'Início da jornada' },
    bronze: { name: 'Bronze', order: 2, xp: 1250, color: '#CD7F32', image: '/images/bronze.png', description: 'Primeiros passos' },
    prata: { name: 'Prata', order: 3, xp: 4200, color: '#C0C0C0', image: '/images/silver.png', description: 'Crescimento constante' },
    ouro: { name: 'Ouro', order: 4, xp: 8500, color: '#FFD700', image: '/images/gold.png', description: 'Excelência em atividade' },
    platina: { name: 'Platina', order: 5, xp: 15350, color: '#E5E4E2', image: '/images/platinum.png', description: 'Dedicação exemplar' },
    esmeralda: { name: 'Esmeralda', order: 6, xp: 18800, color: '#50C878', image: '/images/emerald.png', description: 'Maestria em engajamento' },
    diamante: { name: 'Diamante', order: 7, xp: 22300, color: '#B9F2FF', image: '/images/diamond.png', description: 'Elite da plataforma' },
    mestre: { name: 'Mestre', order: 8, xp: 28200, color: '#800080', image: '/images/master.png', description: 'Lenda da comunidade' }
  };

  const currentXp = userProfile?.stats?.xp || 0;
  
  // Calcular elo atual baseado no XP automaticamente
  const calculateCurrentElo = (xp) => {
    const eloEntries = Object.entries(ELO_CONFIG).sort((a, b) => b[1].xp - a[1].xp);
    
    for (const [eloKey, eloData] of eloEntries) {
      if (xp >= eloData.xp) {
        return {
          current: eloKey,
          name: eloData.name,
          order: eloData.order,
          benefits: {
            badgeColor: eloData.color,
            description: eloData.description,
            imageUrl: eloData.image
          }
        };
      }
    }
    
    // Fallback para ferro
    return {
      current: 'ferro',
      name: 'Ferro',
      order: 1,
      benefits: {
        badgeColor: '#8B4513',
        description: 'Início da jornada',
        imageUrl: '/images/iron.png'
      }
    };
  };

  // Calcular elo atual automaticamente baseado no XP
  const currentElo = calculateCurrentElo(currentXp);
  
  // Encontrar próximo elo
  const eloEntries = Object.entries(ELO_CONFIG).sort((a, b) => a[1].order - b[1].order);
  const nextEloEntry = eloEntries.find(([_, data]) => data.order === currentElo.order + 1);
  const nextElo = nextEloEntry ? nextEloEntry[1] : null;
  
  // Calcular progresso
  let progressPercentage = 0;
  let xpNeeded = 0;
  
  if (nextElo) {
    const currentRequiredXp = ELO_CONFIG[currentElo.current]?.xp || 0;
    const nextRequiredXp = nextElo.xp || 0;
    xpNeeded = nextRequiredXp - currentXp;
    
    if (nextRequiredXp > currentRequiredXp) {
      progressPercentage = Math.min(100, Math.max(0, 
        ((currentXp - currentRequiredXp) / (nextRequiredXp - currentRequiredXp)) * 100
      ));
    }
  }

  return (
    <div className="my-elo-content">
      {/* Current Elo Card */}
      <div className="current-elo-card">
        <div className="elo-badge-large">
          <div 
            className="elo-icon-large">
            <img 
              src={currentElo.benefits?.imageUrl || '/images/iron.png'} 
              alt={currentElo.name || 'Elo'}
              className="elo-image-large"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <span className="elo-symbol-large" style={{ display: 'none' }}>
              {(currentElo.name || 'Elo').charAt(0)}
            </span>
          </div>
          <div className="elo-info-large">
            <h2 className="elo-name-large">{currentElo.name || 'Elo'}</h2>
            <p className="elo-description">{currentElo.benefits?.description || 'Carregando...'}</p>
            <div className="elo-xp-info">
              <span className="current-xp">{(currentXp || 0).toLocaleString()} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {nextElo && (
        <div className="progress-section">
          <div className="progress-header">
            <h3>Progresso para o Próximo Elo</h3>
            <div className="next-elo-info">
              <span className="next-elo-name">{nextElo.name}</span>
              <span className="xp-needed">{(xpNeeded || 0).toLocaleString()} XP restantes</span>
            </div>
          </div>
          
          <div className="progress-container">
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="progress-icons">
                <div className="current-elo-icon">
                  <img 
                    src={currentElo.benefits?.imageUrl || '/images/iron.png'} 
                    alt={currentElo.name}
                    className="progress-elo-image"
                  />
                </div>
                <div className="next-elo-icon">
                  <img 
                    src={nextElo.image || '/images/bronze.png'} 
                    alt={nextElo.name}
                    className="progress-elo-image"
                  />
                </div>
              </div>
            </div>
            <div className="progress-stats">
              <div className="progress-stat">
                <span className="stat-label">XP Atual</span>
                <span className="stat-value">{(currentXp || 0).toLocaleString()}</span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Próximo Elo</span>
                <span className="stat-value">{(nextElo?.xp || 0).toLocaleString()}</span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Progresso</span>
                <span className="stat-value">{Math.round(progressPercentage || 0)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XP Sources */}
      <div className="xp-sources-section">
        <h3>Como Ganhar XP</h3>
        <div className="xp-sources-grid">
          <div className="xp-source-card">
            <div className="xp-source-icon">🛒</div>
            <div className="xp-source-info">
              <h4>Comprar Packs</h4>
              <p>Ganhe XP ao comprar packs</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">💰</div>
            <div className="xp-source-info">
              <h4>Vender Packs</h4>
              <p>Ganhe XP ao vender packs</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">🎁</div>
            <div className="xp-source-info">
              <h4>Enviar Gorjetas</h4>
              <p>Ganhe XP ao enviar gorjetas</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">💎</div>
            <div className="xp-source-info">
              <h4>Receber Gorjetas</h4>
              <p>Ganhe XP ao receber gorjetas</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">⚙️</div>
            <div className="xp-source-info">
              <h4>Comprar Serviços</h4>
              <p>Ganhe XP ao comprar serviços</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">🔧</div>
            <div className="xp-source-info">
              <h4>Vender Serviços</h4>
              <p>Ganhe XP ao vender serviços</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EloListTab = ({ eloConfig }) => {
  // Configuração dos elos chumbada no código
  const ELO_CONFIG = {
    ferro: { name: 'Ferro', order: 1, xp: 0, color: '#8B4513', image: '/images/iron.png', description: 'Início da jornada' },
    bronze: { name: 'Bronze', order: 2, xp: 1250, color: '#CD7F32', image: '/images/bronze.png', description: 'Primeiros passos' },
    prata: { name: 'Prata', order: 3, xp: 4200, color: '#C0C0C0', image: '/images/silver.png', description: 'Crescimento constante' },
    ouro: { name: 'Ouro', order: 4, xp: 8500, color: '#FFD700', image: '/images/gold.png', description: 'Excelência em atividade' },
    platina: { name: 'Platina', order: 5, xp: 15350, color: '#E5E4E2', image: '/images/platinum.png', description: 'Dedicação exemplar' },
    esmeralda: { name: 'Esmeralda', order: 6, xp: 18800, color: '#50C878', image: '/images/emerald.png', description: 'Maestria em engajamento' },
    diamante: { name: 'Diamante', order: 7, xp: 22300, color: '#B9F2FF', image: '/images/diamond.png', description: 'Elite da plataforma' },
    mestre: { name: 'Mestre', order: 8, xp: 28200, color: '#800080', image: '/images/master.png', description: 'Lenda da comunidade' }
  };

  const eloEntries = Object.entries(ELO_CONFIG).sort((a, b) => a[1].order - b[1].order);

  return (
    <div className="elo-list-content">
      <h3>Todos os Elos</h3>
      <div className="elo-list-grid">
        {eloEntries.map(([eloKey, eloData]) => (
          <div key={eloKey} className="elo-list-card">
            <div 
              className="elo-list-icon">
              <img 
                src={eloData.image} 
                alt={eloData.name}
                className="elo-list-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <span className="elo-list-symbol" style={{ display: 'none' }}>
                {eloData.name.charAt(0)}
              </span>
            </div>
            <div className="elo-list-info">
              <h4 className="elo-list-name">{eloData.name}</h4>
              <p className="elo-list-description">{eloData.description}</p>
              <div className="elo-list-requirement">
                <span className="requirement-label">XP Necessário:</span>
                <span className="requirement-value">{eloData.xp.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminTab = ({ syncAllUsersXpAndElo, loading }) => {
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const handleSync = async () => {
    try {
      setSyncLoading(true);
      setSyncError(null);
      setSyncResult(null);
      
      const result = await syncAllUsersXpAndElo();
      setSyncResult(result);
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleRecalculateElos = async () => {
    try {
      setSyncLoading(true);
      setSyncError(null);
      setSyncResult(null);
      
      // Usar a nova função específica para recalcular elos
      const result = await recalculateAllElos();
      setSyncResult(result);
    } catch (error) {
      setSyncError(error.message);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="admin-content">
      <h3>Administração do Sistema de Elos</h3>
      
      <div className="admin-section">
        <h4>Sincronização de XP e Elos</h4>
        <p className="admin-description">
          Esta função recalcula o XP e elo de todos os usuários baseado nas transações existentes.
          <br />
          <strong>Atenção:</strong> Esta operação pode demorar alguns minutos e deve ser executada apenas quando necessário.
        </p>
        
        <div className="sync-controls">
          <button 
            className={`sync-button ${syncLoading ? 'loading' : ''}`}
            onClick={handleSync}
            disabled={syncLoading || loading}
          >
            {syncLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Sincronizando...
              </>
            ) : (
              <>
                🔄 Sincronizar Todos os Usuários
              </>
            )}
          </button>
        </div>

        {syncError && (
          <div className="sync-error">
            <h5>❌ Erro na Sincronização</h5>
            <p>{syncError}</p>
          </div>
        )}

        {syncResult && (
          <div className="sync-success">
            <h5>✅ Sincronização Concluída</h5>
            <div className="sync-stats">
              <div className="stat-item">
                <span className="stat-label">Usuários Processados:</span>
                <span className="stat-value">{syncResult.processed || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total de Usuários:</span>
                <span className="stat-value">{syncResult.totalUsers || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Erros:</span>
                <span className="stat-value">{syncResult.errors || 0}</span>
              </div>
            </div>
            {syncResult.errorDetails && syncResult.errorDetails.length > 0 && (
              <div className="error-details">
                <h6>Detalhes dos Erros:</h6>
                <ul>
                  {syncResult.errorDetails.slice(0, 5).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {syncResult.errorDetails.length > 5 && (
                    <li>... e mais {syncResult.errorDetails.length - 5} erros</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="admin-section">
        <h4>Sincronização de Elos</h4>
        <p className="admin-description">
          Esta função recalcula e atualiza o elo de todos os usuários baseado no XP atual.
          <br />
          <strong>Nota:</strong> Esta operação atualiza o campo 'elo' no documento do usuário.
        </p>
        
        <div className="sync-controls">
          <button 
            className={`sync-button ${syncLoading ? 'loading' : ''}`}
            onClick={handleRecalculateElos}
            disabled={syncLoading || loading}
          >
            {syncLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Recalculando Elos...
              </>
            ) : (
              <>
                🔄 Recalcular Elos de Todos os Usuários
              </>
            )}
          </button>
        </div>
        
        <div className="admin-section">
          <h4>Sincronização Individual</h4>
          <p className="admin-description">
            Sincroniza o elo do usuário atual com base no XP atual.
            <br />
            <strong>Útil para:</strong> Testar o sistema ou corrigir elo individual.
          </p>
          
          <div className="sync-controls">
            <button 
              className={`sync-button ${syncLoading ? 'loading' : ''}`}
              onClick={handleSync}
              disabled={syncLoading || loading}
            >
              {syncLoading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Sincronizando...
                </>
              ) : (
                <>
                  🔄 Sincronizar Meu Elo
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-info">
        <h4>Informações Importantes</h4>
        <ul>
          <li>• A sincronização processa usuários em lotes de 50 para otimizar performance</li>
          <li>• Usuários que já possuem XP calculado terão apenas o elo recalculado</li>
          <li>• Usuários sem XP terão o valor calculado baseado nas transações existentes</li>
          <li>• A operação pode levar até 9 minutos para ser concluída</li>
          <li>• Recomenda-se executar esta função após mudanças no sistema de XP</li>
        </ul>
      </div>
    </div>
  );
};

export default EloSystem;