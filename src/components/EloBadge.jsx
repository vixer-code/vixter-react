import React from 'react';
import './EloBadge.css';

const EloBadge = ({ userElo, size = 'medium', showText = true, className = '' }) => {
  if (!userElo || !userElo.current) {
    return null;
  }

  // Configuração dos elos (mesma do EloSystem)
  const ELO_CONFIG = {
    ferro: { 
      name: 'Ferro', 
      order: 1, 
      color: '#8B4513', 
      image: '/images/iron.png', 
      description: 'Início da jornada' 
    },
    bronze: { 
      name: 'Bronze', 
      order: 2, 
      color: '#CD7F32', 
      image: '/images/bronze.png', 
      description: 'Primeiros passos' 
    },
    prata: { 
      name: 'Prata', 
      order: 3, 
      color: '#C0C0C0', 
      image: '/images/silver.png', 
      description: 'Crescimento constante' 
    },
    ouro: { 
      name: 'Ouro', 
      order: 4, 
      color: '#FFD700', 
      image: '/images/gold.png', 
      description: 'Excelência em atividade' 
    },
    platina: { 
      name: 'Platina', 
      order: 5, 
      color: '#E5E4E2', 
      image: '/images/platinum.png', 
      description: 'Dedicação exemplar' 
    },
    esmeralda: { 
      name: 'Esmeralda', 
      order: 6, 
      color: '#50C878', 
      image: '/images/emerald.png', 
      description: 'Maestria em engajamento' 
    },
    diamante: { 
      name: 'Diamante', 
      order: 7, 
      color: '#B9F2FF', 
      image: '/images/diamond.png', 
      description: 'Elite da plataforma' 
    },
    mestre: { 
      name: 'Mestre', 
      order: 8, 
      color: '#800080', 
      image: '/images/master.png', 
      description: 'Lenda da comunidade' 
    }
  };

  const eloData = ELO_CONFIG[userElo.current] || ELO_CONFIG.ferro;
  const eloName = userElo.name || eloData.name;
  const eloColor = userElo.benefits?.badgeColor || eloData.color;
  const eloImage = userElo.benefits?.imageUrl || eloData.image;

  return (
    <div 
      className={`elo-badge ${size} ${className}`}
      style={{ '--elo-color': eloColor }}
      title={`${eloName} - ${eloData.description}`}
    >
      <div className="elo-badge-icon">
        <img 
          src={eloImage} 
          alt={eloName}
          className="elo-badge-image"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <span className="elo-badge-symbol" style={{ display: 'none' }}>
          {eloName.charAt(0)}
        </span>
      </div>
      {showText && (
        <span className="elo-badge-text">{eloName}</span>
      )}
    </div>
  );
};

export default EloBadge;