import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useElo, eloUtils } from '../hooks/useElo';
import { EloBadge, EloDetails, EloList } from '../components/EloBadge';
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
            <div className="elo-summary">
              <div className="current-elo">
                <EloBadge userId={userProfile.uid} size="large" showProgress={true} />
                <div className="elo-actions">
                  <button 
                    className="refresh-button"
                    onClick={handleRefreshElo}
                    disabled={configLoading}
                  >
                    {configLoading ? 'Atualizando...' : 'Atualizar Elo'}
                  </button>
                </div>
              </div>
            </div>
            
            <EloDetails userId={userProfile.uid} />
          </div>
        )}

        {activeTab === 'elo-list' && (
          <div className="elo-list-tab">
            <EloList />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="admin-tab">
            <EloAdminPanel />
          </div>
        )}
      </div>
    </div>
  );
};

const EloAdminPanel = () => {
  const { eloConfig, loading, error, initializeEloConfig, updateEloConfig } = useElo();
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState(null);

  const handleInitializeConfig = async () => {
    try {
      await initializeEloConfig();
    } catch (error) {
      console.error('Error initializing config:', error);
    }
  };

  const handleEditConfig = () => {
    setEditedConfig(JSON.parse(JSON.stringify(eloConfig)));
    setIsEditing(true);
  };

  const handleSaveConfig = async () => {
    try {
      await updateEloConfig(editedConfig);
      setIsEditing(false);
      setEditedConfig(null);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedConfig(null);
  };

  const updateEloRequirement = (eloKey, accountType, metric, value) => {
    setEditedConfig(prev => ({
      ...prev,
      [eloKey]: {
        ...prev[eloKey],
        requirements: {
          ...prev[eloKey].requirements,
          [accountType]: {
            ...prev[eloKey].requirements[accountType],
            [metric]: parseFloat(value) || 0
          }
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="admin-panel loading">
        <div className="loading-spinner"></div>
        <p>Carregando configurações...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-panel error">
        <p>Erro ao carregar configurações: {error}</p>
        <button onClick={handleInitializeConfig} className="init-button">
          Inicializar Configurações
        </button>
      </div>
    );
  }

  if (!eloConfig) {
    return (
      <div className="admin-panel">
        <h3>Configurações dos Elos</h3>
        <p>Nenhuma configuração encontrada.</p>
        <button onClick={handleInitializeConfig} className="init-button">
          Inicializar Configurações
        </button>
      </div>
    );
  }

  const config = isEditing ? editedConfig : eloConfig;

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h3>Configurações dos Elos</h3>
        <div className="admin-actions">
          {!isEditing ? (
            <button onClick={handleEditConfig} className="edit-button">
              Editar Configurações
            </button>
          ) : (
            <>
              <button onClick={handleSaveConfig} className="save-button">
                Salvar
              </button>
              <button onClick={handleCancelEdit} className="cancel-button">
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="config-grid">
        {Object.entries(config).sort((a, b) => a[1].order - b[1].order).map(([eloKey, eloData]) => (
          <div key={eloKey} className="config-elo-card">
            <div className="elo-card-header">
              <div 
                className="elo-icon" 
                style={{ backgroundColor: eloData.benefits.badgeColor }}
              >
                <img 
                  src={eloUtils.getEloImageUrl(eloKey, config)} 
                  alt={eloData.name}
                  className="elo-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <span className="elo-symbol" style={{ display: 'none' }}>{eloData.name.charAt(0)}</span>
              </div>
              <div className="elo-info">
                <h4>{eloData.name}</h4>
                <p>{eloData.benefits.description}</p>
              </div>
            </div>

            <div className="elo-requirements">
              <h5>Requisitos para Clientes</h5>
              <div className="requirement-grid">
                <div className="requirement-item">
                  <label>Total Gasto (VP)</label>
                  <input
                    type="number"
                    value={eloData.requirements.client.totalSpent}
                    onChange={(e) => updateEloRequirement(eloKey, 'client', 'totalSpent', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="requirement-item">
                  <label>Packs Comprados</label>
                  <input
                    type="number"
                    value={eloData.requirements.client.totalPacksBought}
                    onChange={(e) => updateEloRequirement(eloKey, 'client', 'totalPacksBought', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="requirement-item">
                  <label>Serviços Comprados</label>
                  <input
                    type="number"
                    value={eloData.requirements.client.totalServicesBought}
                    onChange={(e) => updateEloRequirement(eloKey, 'client', 'totalServicesBought', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="requirement-item">
                  <label>Gorjetas Enviadas (VP)</label>
                  <input
                    type="number"
                    value={eloData.requirements.client.totalVixtipsSentAmount}
                    onChange={(e) => updateEloRequirement(eloKey, 'client', 'totalVixtipsSentAmount', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <h5>Requisitos para Provedores</h5>
              <div className="requirement-grid">
                <div className="requirement-item">
                  <label>Packs Vendidos</label>
                  <input
                    type="number"
                    value={eloData.requirements.provider.totalPacksSold}
                    onChange={(e) => updateEloRequirement(eloKey, 'provider', 'totalPacksSold', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="requirement-item">
                  <label>Serviços Vendidos</label>
                  <input
                    type="number"
                    value={eloData.requirements.provider.totalServicesSold}
                    onChange={(e) => updateEloRequirement(eloKey, 'provider', 'totalServicesSold', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="requirement-item">
                  <label>Total de Vendas</label>
                  <input
                    type="number"
                    value={eloData.requirements.provider.totalSales}
                    onChange={(e) => updateEloRequirement(eloKey, 'provider', 'totalSales', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="requirement-item">
                  <label>Gorjetas Recebidas (VP)</label>
                  <input
                    type="number"
                    value={eloData.requirements.provider.totalVixtipsReceivedAmount}
                    onChange={(e) => updateEloRequirement(eloKey, 'provider', 'totalVixtipsReceivedAmount', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="requirement-item">
                  <label>VC Ganho</label>
                  <input
                    type="number"
                    value={eloData.requirements.provider.totalVcEarned}
                    onChange={(e) => updateEloRequirement(eloKey, 'provider', 'totalVcEarned', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EloSystem;
