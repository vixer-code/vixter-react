import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="not-found-icon">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="errorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF2E63" />
                <stop offset="100%" stopColor="#FF6B9D" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <circle cx="100" cy="100" r="80" fill="url(#errorGradient)" filter="url(#glow)" opacity="0.3"/>
            <text x="100" y="110" 
                  fontFamily="'Press Start 2P', monospace" 
                  fontSize="40" 
                  fill="url(#errorGradient)"
                  textAnchor="middle"
                  fontWeight="bold">404</text>
          </svg>
        </div>
        
        <h1 className="not-found-title">Página Não Encontrada</h1>
        <p className="not-found-description">
          Ops! Parece que você se perdeu no universo Vixter. 
          A página que você está procurando não existe ou foi movida.
        </p>
        
        <div className="not-found-actions">
          <Link to="/" className="not-found-btn primary">
            <i className="fas fa-home"></i>
            Voltar ao Início
          </Link>
          <Link to="/feed" className="not-found-btn secondary">
            <i className="fas fa-stream"></i>
            Ir para o Feed
          </Link>
        </div>
        
        <div className="not-found-help">
          <p>Páginas disponíveis:</p>
          <div className="available-pages">
            <Link to="/">Início</Link>
            <Link to="/feed">Feed</Link>
            <Link to="/profile">Perfil</Link>
            <Link to="/wallet">Carteira</Link>
            <Link to="/login">Login</Link>
            <Link to="/register">Registro</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 