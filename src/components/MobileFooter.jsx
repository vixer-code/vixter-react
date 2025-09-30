import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './MobileFooter.css';

const MobileFooter = () => {
  const location = useLocation();
  const { currentUser } = useAuth();

  // Não mostrar o footer se não estiver logado
  if (!currentUser) return null;

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <footer className="mobile-footer">
      <nav className="mobile-footer-nav">
        <Link 
          to="/vixies" 
          className={`mobile-footer-item ${isActive('/vixies') ? 'active' : ''}`}
        >
          <i className="fas fa-users"></i>
          <span>Vixies</span>
        </Link>
        
        <Link 
          to="/vixink" 
          className={`mobile-footer-item ${isActive('/vixink') ? 'active' : ''}`}
        >
          <i className="fas fa-link"></i>
          <span>Vixink</span>
        </Link>
        
        <Link 
          to="/messages" 
          className={`mobile-footer-item ${isActive('/messages') ? 'active' : ''}`}
        >
          <i className="fas fa-envelope"></i>
          <span>Mensagens</span>
        </Link>
      </nav>
    </footer>
  );
};

export default MobileFooter;
