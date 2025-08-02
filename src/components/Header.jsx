import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [vpBalance, setVpBalance] = useState(0);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser]);

  const loadUserData = async () => {
    try {
      // Load VP balance
      const walletRef = ref(database, `wallets/${currentUser.uid}`);
      const walletSnapshot = await get(walletRef);
      if (walletSnapshot.exists()) {
        const walletData = walletSnapshot.val();
        setVpBalance(walletData.vpBalance || 0);
      }

      // Load user profile
      const userRef = ref(database, `users/${currentUser.uid}`);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        setUserProfile(userSnapshot.val());
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleVpBalanceClick = () => {
    if (currentUser) {
      navigate('/wallet');
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <header>
      <nav>
        <Link to="/" className="logo">
          <img src="/images/Flor-Colorida.png" alt="Vixter logo" className="logo-icon" />
          <span>Vixter</span>
        </Link>

        <ul className="nav-links">
          <li><Link to="/vixies" className={isActive('/vixies') ? 'active' : ''}>Vixies</Link></li>
          <li><Link to="/vixink" className={isActive('/vixink') ? 'active' : ''}>Vixink</Link></li>
          <li><Link to="/feed" className={isActive('/feed') ? 'active' : ''}>Comunidade</Link></li>
          
          {!currentUser ? (
            <>
              <li className="auth-hide logged-out"><Link to="/login">Entrar</Link></li>
              <li className="auth-hide logged-out"><Link to="/register">Registrar</Link></li>
            </>
          ) : (
            <>
              {/* VP Balance Display */}
              <li className="auth-hide logged-in">
                <div className="vp-balance" onClick={handleVpBalanceClick}>
                  <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                    {/* Glow background */}
                    <defs>
                      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      
                      {/* Glitch filter */}
                      <filter id="glitch" x="-10%" y="-10%" width="120%" height="120%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
                      </filter>
                      
                      {/* Linear gradient for the hexagon */}
                      <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0F0F1A" />
                        <stop offset="100%" stopColor="#1A1A2E" />
                      </linearGradient>
                      
                      {/* Radial gradient for glow */}
                      <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stopColor="#8A2BE2" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0" />
                      </radialGradient>
                      
                      {/* Linear gradient for neon text */}
                      <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00FFCA" />
                        <stop offset="100%" stopColor="#00D4AA" />
                      </linearGradient>
                    </defs>
                    
                    {/* Glow background */}
                    <circle cx="64" cy="64" r="60" fill="url(#glowGradient)" />
                    
                    {/* Background hexagon */}
                    <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                          fill="url(#hexGradient)" 
                          stroke="#8A2BE2" 
                          strokeWidth="2" 
                          filter="url(#glow)" />
                    
                    {/* Hexagon border with secondary color */}
                    <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                          fill="none" 
                          stroke="#00FFCA" 
                          strokeWidth="1.5" 
                          strokeDasharray="4,4"
                          opacity="0.8" />
                          
                    {/* Inner hexagon */}
                    <path d="M64 32 L92 48 L92 80 L64 96 L36 80 L36 48 Z" 
                          fill="none" 
                          stroke="#FF2E63" 
                          strokeWidth="1.5" 
                          opacity="0.8" />
                    
                    {/* VP Text with glow effect */}
                    <g filter="url(#glow)">
                      <text x="64" y="72" 
                            fontFamily="'Press Start 2P', monospace" 
                            fontSize="24" 
                            fill="url(#textGradient)"
                            textAnchor="middle"
                            fontWeight="bold">VP</text>
                    </g>
                    
                    {/* Digital circuit lines */}
                    <path d="M40 60 H28 V70 H36" fill="none" stroke="#00FFCA" strokeWidth="1" />
                    <path d="M88 60 H100 V70 H92" fill="none" stroke="#00FFCA" strokeWidth="1" />
                    <path d="M64 32 V24" fill="none" stroke="#00FFCA" strokeWidth="1" />
                    <path d="M64 96 V104" fill="none" stroke="#00FFCA" strokeWidth="1" />
                    
                    {/* Digital nodes/connectors */}
                    <circle cx="28" cy="60" r="2" fill="#00FFCA" />
                    <circle cx="36" cy="70" r="2" fill="#00FFCA" />
                    <circle cx="100" cy="60" r="2" fill="#00FFCA" />
                    <circle cx="92" cy="70" r="2" fill="#00FFCA" />
                    <circle cx="64" cy="24" r="2" fill="#00FFCA" />
                    <circle cx="64" cy="104" r="2" fill="#00FFCA" />
                    
                    {/* Animated pulse effect */}
                    <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                          fill="none" 
                          stroke="#B14AFF" 
                          strokeWidth="1" 
                          opacity="0.5">
                      <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                      <animate attributeName="stroke-width" values="1;3;1" dur="3s" repeatCount="indefinite" />
                    </path>
                  </svg>
                  <span id="vp-amount">{vpBalance.toLocaleString()}</span>
                </div>
              </li>
              
              {/* Profile Dropdown Menu */}
              <li className="profile-dropdown auth-hide logged-in">
                <a href="#" className="profile-trigger">
                  <div className="profile-picture-container">
                    <div className="profile-picture" id="navbar-profile-pic">
                      {userProfile?.profilePictureURL ? (
                        <img 
                          src={userProfile.profilePictureURL || '/images/defpfp1.png'} 
                          alt={userProfile.displayName || 'Profile'} 
                        />
                      ) : userProfile?.displayName ? (
                        <span className="profile-initials">
                          {userProfile.displayName
                            .split(' ')
                            .map(name => name[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </span>
                      ) : (
                        <i className="fas fa-user"></i>
                      )}
                    </div>
                    <div className="dropdown-indicator">
                      <i className="fas fa-chevron-down"></i>
                    </div>
                  </div>
                </a>
                <div className="profile-dropdown-content">
                  <Link to="/profile"><i className="fas fa-user"></i> Minha conta</Link>
                  <Link to="/my-services"><i className="fas fa-briefcase"></i> Meus Serviços</Link>
                  <Link to="/wallet"><i className="fas fa-wallet"></i> Carteira</Link>
                  <Link to="/settings"><i className="fas fa-cog"></i> Configurações</Link>
                  <div className="dropdown-divider"></div>
                  <a href="#" onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Logout</a>
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