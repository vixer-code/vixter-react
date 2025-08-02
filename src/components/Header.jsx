import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import './Header.css';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header>
      <nav>
        <div className="logo">
          <img src="/images/Flor-Colorida.png" alt="Vixter logo" className="logo-icon" />
          <span>Vixter</span>
        </div>

        <ul className="nav-links">
          <li><Link to="/" className="nav-link">Início</Link></li>
          <li><Link to="/vixies" className="nav-link">Vixies</Link></li>
          <li><Link to="/vixink" className="nav-link">Vixink</Link></li>
          <li><Link to="/feed" className="nav-link">Comunidade</Link></li>
          
          {!currentUser ? (
            <>
              <li><Link to="/login" className="nav-link">Entrar</Link></li>
              <li><Link to="/register" className="nav-link">Registrar</Link></li>
            </>
          ) : (
            <>
              {/* VP Balance Display */}
              <li>
                <div className="vp-balance">
                  <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      
                      <filter id="glitch" x="-10%" y="-10%" width="120%" height="120%">
                        <feColorMatrix type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"/>
                        <feOffset dx="2" dy="0" result="red"/>
                        <feColorMatrix type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"/>
                        <feOffset dx="-2" dy="0" result="blue"/>
                        <feBlend mode="normal" in="red" in2="SourceGraphic"/>
                        <feBlend mode="normal" in="blue"/>
                      </filter>
                    </defs>
                    
                    <circle cx="64" cy="64" r="30" fill="none" stroke="url(#vpGradient)" strokeWidth="4" filter="url(#glow)"/>
                    <text x="64" y="72" textAnchor="middle" fontSize="24" fontWeight="bold" fill="url(#vpGradient)" filter="url(#glitch)">VP</text>
                    
                    <defs>
                      <linearGradient id="vpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#9333ea"/>
                        <stop offset="50%" stopColor="#7c3aed"/>
                        <stop offset="100%" stopColor="#5b21b6"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="vp-amount" id="vp-display">0</span>
                </div>
              </li>
              
              {/* User menu dropdown */}
              <li className="user-menu">
                <button className="user-menu-trigger">
                  <User size={20} />
                  <span>{currentUser.displayName || currentUser.email}</span>
                </button>
                <div className="user-menu-dropdown">
                  <Link to="/profile" className="dropdown-item">
                    <User size={16} />
                    Perfil
                  </Link>
                  <Link to="/settings" className="dropdown-item">
                    Configurações
                  </Link>
                  <Link to="/my-services" className="dropdown-item">
                    Meus Serviços
                  </Link>
                  <Link to="/wallet" className="dropdown-item">
                    Carteira
                  </Link>
                  <button onClick={handleLogout} className="dropdown-item logout-btn">
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;