import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useElo } from '../hooks/useElo';
import './EloSystem.css';

const EloSystem = () => {
  const { userProfile, userElo, updateUserElo } = useUser();
  const { eloConfig, loading: configLoading, error: configError } = useElo();
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

  const handleRefreshElo = async () => {
    try {
      await updateUserElo();
    } catch (error) {
      console.error('Error refreshing elo:', error);
    }
  };

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
      </div>

      <div className="elo-content">
        {activeTab === 'my-elo' && (
          <div className="my-elo-tab">
            <MyEloTab 
              userProfile={userProfile}
              userElo={userElo}
              eloConfig={eloConfig}
              onRefresh={handleRefreshElo}
              loading={configLoading}
            />
          </div>
        )}

        {activeTab === 'elo-list' && (
          <div className="elo-list-tab">
            <EloListTab eloConfig={eloConfig} />
          </div>
        )}
      </div>
    </div>
  );
};

const MyEloTab = ({ userProfile, userElo, eloConfig, onRefresh, loading }) => {
  if (!userElo || !eloConfig) {
    return (
      <div className="elo-loading">
        <div className="loading-spinner"></div>
        <p>Carregando informações do elo...</p>
      </div>
    );
  }

  const currentElo = userElo.elo;
  const currentXp = userProfile.stats?.xp || 0;
  
  // Encontrar próximo elo
  const eloEntries = Object.entries(eloConfig).sort((a, b) => a[1].order - b[1].order);
  const nextEloEntry = eloEntries.find(([_, data]) => data.order === currentElo.order + 1);
  const nextElo = nextEloEntry ? nextEloEntry[1] : null;
  
  // Calcular progresso
  let progressPercentage = 0;
  let xpNeeded = 0;
  
  if (nextElo) {
    const currentRequiredXp = currentElo.requirements?.xp || 0;
    const nextRequiredXp = nextElo.requirements?.xp || 0;
    xpNeeded = nextRequiredXp - currentXp;
    progressPercentage = Math.min(100, Math.max(0, 
      ((currentXp - currentRequiredXp) / (nextRequiredXp - currentRequiredXp)) * 100
    ));
  }

  return (
    <div className="my-elo-content">
      {/* Current Elo Card */}
      <div className="current-elo-card">
        <div className="elo-badge-large">
          <div 
            className="elo-icon-large"
            style={{ backgroundColor: currentElo.benefits?.badgeColor || '#8B4513' }}
          >
            <img 
              src={currentElo.benefits?.imageUrl || '/images/iron.png'} 
              alt={currentElo.name}
              className="elo-image-large"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <span className="elo-symbol-large" style={{ display: 'none' }}>
              {currentElo.name.charAt(0)}
            </span>
          </div>
          <div className="elo-info-large">
            <h2 className="elo-name-large">{currentElo.name}</h2>
            <p className="elo-description">{currentElo.benefits?.description}</p>
            <div className="elo-xp-info">
              <span className="current-xp">{currentXp.toLocaleString()} XP</span>
            </div>
          </div>
        </div>
        
        <button 
          className="refresh-elo-button"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Atualizando...' : 'Atualizar Elo'}
        </button>
      </div>

      {/* Progress Section */}
      {nextElo && (
        <div className="progress-section">
          <div className="progress-header">
            <h3>Progresso para o Próximo Elo</h3>
            <div className="next-elo-info">
              <span className="next-elo-name">{nextElo.name}</span>
              <span className="xp-needed">{xpNeeded.toLocaleString()} XP restantes</span>
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
                    src={nextElo.benefits?.imageUrl || '/images/bronze.png'} 
                    alt={nextElo.name}
                    className="progress-elo-image"
                  />
                </div>
              </div>
            </div>
            <div className="progress-stats">
              <div className="progress-stat">
                <span className="stat-label">XP Atual</span>
                <span className="stat-value">{currentXp.toLocaleString()}</span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Próximo Elo</span>
                <span className="stat-value">{(currentElo.requirements?.xp || 0) + (nextElo.requirements?.xp || 0)}</span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Progresso</span>
                <span className="stat-value">{Math.round(progressPercentage)}%</span>
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
              <p>12 XP por VP gasto</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">💰</div>
            <div className="xp-source-info">
              <h4>Vender Packs</h4>
              <p>25 XP por VC recebido</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">🎁</div>
            <div className="xp-source-info">
              <h4>Enviar Gorjetas</h4>
              <p>12 XP por VP gasto</p>
            </div>
          </div>
          <div className="xp-source-card">
            <div className="xp-source-icon">💎</div>
            <div className="xp-source-info">
              <h4>Receber Gorjetas</h4>
              <p>25 XP por VP recebido</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EloListTab = ({ eloConfig }) => {
  if (!eloConfig) {
    return (
      <div className="elo-loading">
        <div className="loading-spinner"></div>
        <p>Carregando lista de elos...</p>
      </div>
    );
  }

  const eloEntries = Object.entries(eloConfig).sort((a, b) => a[1].order - b[1].order);

  return (
    <div className="elo-list-content">
      <h3>Todos os Elos</h3>
      <div className="elo-list-grid">
        {eloEntries.map(([eloKey, eloData]) => (
          <div key={eloKey} className="elo-list-card">
            <div 
              className="elo-list-icon"
              style={{ backgroundColor: eloData.benefits.badgeColor }}
            >
              <img 
                src={eloData.benefits.imageUrl} 
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
              <p className="elo-list-description">{eloData.benefits.description}</p>
              <div className="elo-list-requirement">
                <span className="requirement-label">XP Necessário:</span>
                <span className="requirement-value">{eloData.requirements.xp.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EloSystem;