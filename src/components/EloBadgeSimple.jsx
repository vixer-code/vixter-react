import React from 'react';
import { useUser } from '../contexts/UserContext';
import './EloBadgeSimple.css';

/**
 * Componente simples para exibir o elo do usuário
 */
const EloBadgeSimple = ({ 
  userId, 
  size = 'medium',
  className = '',
  showXp = false 
}) => {
  const { userProfile, userElo } = useUser();
  
  // Se não especificar userId, usa o usuário atual
  const targetUserId = userId || userProfile?.uid;
  const targetElo = userId ? null : userElo; // Por enquanto só funciona para usuário atual
  
  if (!targetElo?.elo) {
    return (
      <div className={`elo-badge-simple ${size} ${className}`}>
        <div className="elo-icon-simple">
          <img src="/images/iron.png" alt="Ferro" className="elo-image-simple" />
        </div>
        <span className="elo-name-simple">Ferro</span>
        {showXp && <span className="elo-xp-simple">0 XP</span>}
      </div>
    );
  }

  const { elo } = targetElo;
  const currentXp = userProfile?.stats?.xp || 0;

  return (
    <div 
      className={`elo-badge-simple ${size} ${className}`}
      style={{ '--elo-color': elo.benefits?.badgeColor || '#8B4513' }}
    >
      <div className="elo-icon-simple" style={{ backgroundColor: elo.benefits?.badgeColor || '#8B4513' }}>
        <img 
          src={elo.benefits?.imageUrl || '/images/iron.png'} 
          alt={elo.name}
          className="elo-image-simple"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <span className="elo-symbol-simple" style={{ display: 'none' }}>
          {elo.name.charAt(0)}
        </span>
      </div>
      <div className="elo-info-simple">
        <span className="elo-name-simple">{elo.name}</span>
        {showXp && (
          <span className="elo-xp-simple">{currentXp.toLocaleString()} XP</span>
        )}
      </div>
    </div>
  );
};

export default EloBadgeSimple;
