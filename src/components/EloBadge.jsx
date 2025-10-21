import React from 'react';
import './EloBadge.css';

// Configuração dos elos (mesma do EloSystem)
const ELO_CONFIG = {
  ferro: { 
    name: 'Ferro', 
    order: 1, 
    xp: 0,
    color: '#8B4513', 
    image: '/images/iron.png', 
    description: 'Início da jornada' 
  },
  bronze: { 
    name: 'Bronze', 
    order: 2, 
    xp: 1250,
    color: '#CD7F32', 
    image: '/images/bronze.png', 
    description: 'Primeiros passos' 
  },
  prata: { 
    name: 'Prata', 
    order: 3, 
    xp: 4200,
    color: '#C0C0C0', 
    image: '/images/silver.png', 
    description: 'Crescimento constante' 
  },
  ouro: { 
    name: 'Ouro', 
    order: 4, 
    xp: 8500,
    color: '#FFD700', 
    image: '/images/gold.png', 
    description: 'Excelência em atividade' 
  },
  platina: { 
    name: 'Platina', 
    order: 5, 
    xp: 15350,
    color: '#E5E4E2', 
    image: '/images/platinum.png', 
    description: 'Dedicação exemplar' 
  },
  esmeralda: { 
    name: 'Esmeralda', 
    order: 6, 
    xp: 18800,
    color: '#50C878', 
    image: '/images/emerald.png', 
    description: 'Maestria em engajamento' 
  },
  diamante: { 
    name: 'Diamante', 
    order: 7, 
    xp: 22300,
    color: '#B9F2FF', 
    image: '/images/diamond.png', 
    description: 'Elite da plataforma' 
  },
  mestre: { 
    name: 'Mestre', 
    order: 8, 
    xp: 28200,
    color: '#800080', 
    image: '/images/master.png', 
    description: 'Lenda da comunidade' 
  }
};

const EloBadge = ({ userElo, userXp, size = 'medium', showText = true, className = '' }) => {
  // Calcular elo dinamicamente baseado no XP se fornecido
  const calculateEloFromXp = (xp) => {
    const eloEntries = Object.entries(ELO_CONFIG).sort((a, b) => b[1].xp - a[1].xp);
    
    for (const [eloKey, eloData] of eloEntries) {
      if (xp >= eloData.xp) {
        return {
          current: eloKey,
          name: eloData.name,
          order: eloData.order,
          benefits: {
            badgeColor: eloData.color,
            imageUrl: eloData.image,
            description: eloData.description
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
        imageUrl: '/images/iron.png',
        description: 'Início da jornada'
      }
    };
  };

  // Usar elo calculado dinamicamente se XP fornecido, senão usar elo salvo
  const elo = userXp !== undefined ? calculateEloFromXp(userXp) : userElo;
  
  if (!elo || !elo.current) {
    return null;
  }

  const imageUrl = elo.benefits?.imageUrl || '/images/iron.png';
  const eloName = elo.name;
  const eloColor = elo.benefits?.badgeColor || '#8B4513';

  return (
    <div className={`elo-badge-container ${size} ${className}`} title={elo.benefits?.description}>
      <div className="elo-badge-icon" style={{ backgroundColor: eloColor }}>
        <img 
          src={imageUrl} 
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
        <span className="elo-badge-name">{eloName}</span>
      )}
    </div>
  );
};

export default EloBadge;