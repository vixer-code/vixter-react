import React from 'react';
import { useUserElo, eloUtils } from '../hooks/useElo';
import './EloBadge.css';

/**
 * Componente para exibir o elo do usuário
 */
const EloBadge = ({ 
  userId, 
  showProgress = false, 
  size = 'medium',
  className = '',
  onClick = null 
}) => {
  const { userElo, loading, error } = useUserElo(userId);

  if (loading) {
    return (
      <div className={`elo-badge loading ${size} ${className}`}>
        <div className="elo-badge-skeleton"></div>
      </div>
    );
  }

  if (error || !userElo?.elo) {
    return (
      <div className={`elo-badge error ${size} ${className}`}>
        <span className="elo-name">Ferro</span>
      </div>
    );
  }

  const { elo, stats, accountType } = userElo;
  const eloColor = eloUtils.getEloColor(elo.current, null);
  const eloName = elo.name;
  const eloDescription = elo.benefits?.description || '';
  const eloImageUrl = eloUtils.getEloImageUrl(elo.current, null);

  return (
    <div 
      className={`elo-badge ${size} ${className} ${onClick ? 'clickable' : ''}`}
      style={{ '--elo-color': eloColor }}
      onClick={onClick}
      title={eloDescription}
    >
      <div className="elo-badge-content">
        <div className="elo-icon" style={{ backgroundColor: eloColor }}>
          <img 
            src={eloImageUrl} 
            alt={eloName}
            className="elo-image"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <span className="elo-symbol" style={{ display: 'none' }}>{eloName.charAt(0)}</span>
        </div>
        <div className="elo-info">
          <span className="elo-name">{eloName}</span>
          {showProgress && elo.nextElo && (
            <div className="elo-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${Object.values(elo.progress || {}).reduce((acc, curr) => acc + curr.progress, 0) / Object.keys(elo.progress || {}).length || 0}%` 
                  }}
                ></div>
              </div>
              <span className="progress-text">
                Próximo: {eloUtils.getEloName(elo.nextElo, null)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Componente para exibir informações detalhadas do elo
 */
const EloDetails = ({ userId, className = '' }) => {
  const { userElo, loading, error } = useUserElo(userId);

  if (loading) {
    return (
      <div className={`elo-details loading ${className}`}>
        <div className="elo-details-skeleton"></div>
      </div>
    );
  }

  if (error || !userElo?.elo) {
    return (
      <div className={`elo-details error ${className}`}>
        <p>Erro ao carregar informações do elo</p>
      </div>
    );
  }

  const { elo, stats, accountType } = userElo;

  return (
    <div className={`elo-details ${className}`}>
      <div className="elo-header">
        <EloBadge userId={userId} size="large" />
        <div className="elo-description">
          <h3>{elo.name}</h3>
          <p>{elo.benefits?.description}</p>
        </div>
      </div>

      {elo.nextElo && (
        <div className="elo-progress-section">
          <h4>Progresso para o próximo elo</h4>
          <div className="progress-metrics">
            {Object.entries(elo.progress || {}).map(([metric, data]) => (
              <div key={metric} className="progress-metric">
                <div className="metric-header">
                  <span className="metric-name">
                    {metric === 'totalSpent' ? 'Total Gasto' :
                     metric === 'totalPacksBought' ? 'Packs Comprados' :
                     metric === 'totalServicesBought' ? 'Serviços Comprados' :
                     metric === 'totalVixtipsSentAmount' ? 'Gorjetas Enviadas' :
                     metric === 'totalPacksSold' ? 'Packs Vendidos' :
                     metric === 'totalServicesSold' ? 'Serviços Vendidos' :
                     metric === 'totalSales' ? 'Total de Vendas' :
                     metric === 'totalVixtipsReceivedAmount' ? 'Gorjetas Recebidas' :
                     metric === 'totalVcEarned' ? 'VC Ganho' :
                     metric}
                  </span>
                  <span className="metric-values">
                    {data.current} / {data.required}
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${data.progress}%` }}
                  ></div>
                </div>
                <span className="progress-percentage">{data.progress}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="elo-stats">
        <h4>Suas Estatísticas</h4>
        <div className="stats-grid">
          {accountType === 'client' ? (
            <>
              <div className="stat-item">
                <span className="stat-label">Total Gasto</span>
                <span className="stat-value">{stats.totalSpent || 0} VP</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Packs Comprados</span>
                <span className="stat-value">{stats.totalPacksBought || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Serviços Comprados</span>
                <span className="stat-value">{stats.totalServicesBought || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Gorjetas Enviadas</span>
                <span className="stat-value">{stats.totalVixtipsSentAmount || 0} VP</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat-item">
                <span className="stat-label">Packs Vendidos</span>
                <span className="stat-value">{stats.totalPacksSold || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Serviços Vendidos</span>
                <span className="stat-value">{stats.totalServicesSold || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total de Vendas</span>
                <span className="stat-value">{stats.totalSales || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Gorjetas Recebidas</span>
                <span className="stat-value">{stats.totalVixtipsReceivedAmount || 0} VP</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">VC Ganho</span>
                <span className="stat-value">{stats.totalVcEarned || 0} VC</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Componente para exibir lista de elos disponíveis
 */
const EloList = ({ className = '' }) => {
  const { eloConfig, loading, error } = useElo();

  if (loading) {
    return (
      <div className={`elo-list loading ${className}`}>
        <div className="elo-list-skeleton"></div>
      </div>
    );
  }

  if (error || !eloConfig) {
    return (
      <div className={`elo-list error ${className}`}>
        <p>Erro ao carregar lista de elos</p>
      </div>
    );
  }

  const eloEntries = Object.entries(eloConfig).sort((a, b) => a[1].order - b[1].order);

  return (
    <div className={`elo-list ${className}`}>
      <h3>Sistema de Elos</h3>
      <div className="elo-grid">
        {eloEntries.map(([eloKey, eloData]) => (
          <div key={eloKey} className="elo-item">
            <div 
              className="elo-icon" 
              style={{ backgroundColor: eloData.benefits.badgeColor }}
            >
              <img 
                src={eloUtils.getEloImageUrl(eloKey, eloConfig)} 
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
        ))}
      </div>
    </div>
  );
};

export { EloBadge, EloDetails, EloList };
