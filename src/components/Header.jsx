import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useUser } from '../contexts/UserContext';
import { getDefaultImage } from '../utils/defaultImages';
import CachedImage from './CachedImage';
import NotificationIcon from './NotificationIcon';
import SearchBar from './SearchBar';
import './Header.css';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const { vpBalance, formatCurrency } = useWallet();
  const { userProfile, formatUserDisplayName, getUserAvatarUrl } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // No need for loadUserData anymore, UserContext handles it
  // useEffect(() => {
  //   if (currentUser) {
  //     loadUserData();
  //   }
  // }, [currentUser]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Debug mobile menu state
  useEffect(() => {
    console.log('Mobile menu state changed:', mobileMenuOpen);
    try {
      if (mobileMenuOpen) {
        // Lock body scroll when mobile nav is open
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    } catch (e) {
      // noop
    }
  }, [mobileMenuOpen]);

  // loadUserData removed - handled by UserContext

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

  const toggleMobileMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Remove focus from the button to prevent stuck hover/active states
    if (e.target) {
      e.target.blur();
    }
    
    console.log('Toggle mobile menu clicked, current state:', mobileMenuOpen);
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setMobileMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      <header>
        <nav>
          <div className="header-left">
            <Link to="/" className="logo">
              <img src="/images/Flor-Colorida.png" alt="Vixter logo" className="logo-icon" fetchpriority="high" />
              <span>Vixter</span>
            </Link>
            
            {/* Mobile Search Bar - Only visible on mobile */}
            <div className="mobile-search-bar">
              <SearchBar />
            </div>
          </div>

          <ul className="nav-links">
            <li><Link to="/vixies" className={isActive('/vixies') ? 'active' : ''}>Vixies</Link></li>
            <li><Link to="/vixink" className={isActive('/vixink') ? 'active' : ''}>Vixink</Link></li>
            <li><Link to="/feed" className={isActive('/feed') ? 'active' : ''}>Feed</Link></li>
            
            {/* Search Bar */}
            <li className="search-container-nav">
              <SearchBar />
            </li>
            
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
                    {userProfile?.accountType === 'provider' ? (
                      <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <filter id="header-glow-vc" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                          
                          <linearGradient id="header-hexGradient-vc" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0A1F0A" />
                            <stop offset="100%" stopColor="#1A2E1A" />
                          </linearGradient>
                          
                          <radialGradient id="header-glowGradient-vc" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                            <stop offset="0%" stopColor="#00C853" stopOpacity="0.7" />
                            <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
                          </radialGradient>
                          
                          <linearGradient id="header-textGradient-vc" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00C853" />
                            <stop offset="100%" stopColor="#4CAF50" />
                          </linearGradient>
                        </defs>
                        
                        <circle cx="64" cy="64" r="58" fill="url(#header-glowGradient-vc)" />
                        
                        <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                              fill="url(#header-hexGradient-vc)" 
                              stroke="#00C853" 
                              strokeWidth="1.5" 
                              filter="url(#header-glow-vc)" />
                        
                        <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                              fill="none" 
                              stroke="#4CAF50" 
                              strokeWidth="1" 
                              strokeDasharray="3,3"
                              opacity="0.8" />
                              
                        <path d="M64 24 L88 36 L88 88 L64 100 L40 88 L40 36 Z" 
                              fill="none" 
                              stroke="#81C784" 
                              strokeWidth="1" 
                              opacity="0.8" />
                        
                        <g filter="url(#header-glow-vc)">
                          <text x="64" y="72" 
                                fontFamily="'Press Start 2P', monospace" 
                                fontSize="20" 
                                fill="url(#header-textGradient-vc)"
                                textAnchor="middle"
                                fontWeight="bold">VC</text>
                        </g>
                        
                        <path d="M32 60 H20 V68 H28" fill="none" stroke="#4CAF50" strokeWidth="1.5" />
                        <path d="M96 60 H108 V68 H100" fill="none" stroke="#4CAF50" strokeWidth="1.5" />
                        <path d="M64 24 V18" fill="none" stroke="#4CAF50" strokeWidth="1.5" />
                        <path d="M64 100 V106" fill="none" stroke="#4CAF50" strokeWidth="1.5" />
                       
                        <circle cx="20" cy="60" r="2" fill="#4CAF50" />
                        <circle cx="28" cy="68" r="2" fill="#4CAF50" />
                        <circle cx="108" cy="60" r="2" fill="#4CAF50" />
                        <circle cx="100" cy="68" r="2" fill="#4CAF50" />
                        <circle cx="64" cy="18" r="2" fill="#4CAF50" />
                        <circle cx="64" cy="106" r="2" fill="#4CAF50" />
                       
                        <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                              fill="none" 
                              stroke="#A5D6A7" 
                              strokeWidth="0.8" 
                              opacity="0.5">
                          <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                          <animate attributeName="stroke-width" values="0.8;2;0.8" dur="3s" repeatCount="indefinite" />
                        </path>
                      </svg>
                    ) : (
                      <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                       {/* Glow background */}
                       <defs>
                         <filter id="header-glow" x="-30%" y="-30%" width="160%" height="160%">
                           <feGaussianBlur stdDeviation="2" result="blur" />
                           <feComposite in="SourceGraphic" in2="blur" operator="over" />
                         </filter>
                         
                         {/* Glitch filter */}
                         <filter id="header-glitch" x="-10%" y="-10%" width="120%" height="120%">
                           <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" result="noise" />
                           <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
                         </filter>
                         
                         {/* Linear gradient for the hexagon */}
                         <linearGradient id="header-hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                           <stop offset="0%" stopColor="#0F0F1A" />
                           <stop offset="100%" stopColor="#1A1A2E" />
                         </linearGradient>
                         
                         {/* Radial gradient for glow */}
                         <radialGradient id="header-glowGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                           <stop offset="0%" stopColor="#8A2BE2" stopOpacity="0.7" />
                           <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0" />
                         </radialGradient>
                         
                         {/* Linear gradient for neon text */}
                         <linearGradient id="header-textGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                           <stop offset="0%" stopColor="#00FFCA" />
                           <stop offset="100%" stopColor="#00D4AA" />
                         </linearGradient>
                       </defs>
                       
                       {/* Glow background */}
                       <circle cx="64" cy="64" r="58" fill="url(#header-glowGradient)" />
                       
                       {/* Background hexagon */}
                       <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                             fill="url(#header-hexGradient)" 
                             stroke="#8A2BE2" 
                             strokeWidth="1.5" 
                             filter="url(#header-glow)" />
                       
                       {/* Hexagon border with secondary color */}
                       <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                             fill="none" 
                             stroke="#00FFCA" 
                             strokeWidth="1" 
                             strokeDasharray="3,3"
                             opacity="0.8" />
                              
                       {/* Inner hexagon */}
                       <path d="M64 24 L88 36 L88 88 L64 100 L40 88 L40 36 Z" 
                             fill="none" 
                             stroke="#FF2E63" 
                             strokeWidth="1" 
                             opacity="0.8" />
                       
                                           {/* VP Text with glow effect */}
                        <g filter="url(#header-glow)">
                          <text x="64" y="72" 
                                fontFamily="'Press Start 2P', monospace" 
                                fontSize="20" 
                                fill="url(#header-textGradient)"
                                textAnchor="middle"
                                fontWeight="bold">VP</text>
                        </g>
                        
                        {/* Digital circuit lines */}
                        <path d="M32 60 H20 V68 H28" fill="none" stroke="#00FFCA" strokeWidth="1.5" />
                        <path d="M96 60 H108 V68 H100" fill="none" stroke="#00FFCA" strokeWidth="1.5" />
                        <path d="M64 24 V18" fill="none" stroke="#00FFCA" strokeWidth="1.5" />
                        <path d="M64 100 V106" fill="none" stroke="#00FFCA" strokeWidth="1.5" />
                       
                                           {/* Digital nodes/connectors */}
                        <circle cx="20" cy="60" r="2" fill="#00FFCA" />
                        <circle cx="28" cy="68" r="2" fill="#00FFCA" />
                        <circle cx="108" cy="60" r="2" fill="#00FFCA" />
                        <circle cx="100" cy="68" r="2" fill="#00FFCA" />
                        <circle cx="64" cy="18" r="2" fill="#00FFCA" />
                        <circle cx="64" cy="106" r="2" fill="#00FFCA" />
                       
                       {/* Animated pulse effect */}
                       <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                             fill="none" 
                             stroke="#B14AFF" 
                             strokeWidth="0.8" 
                             opacity="0.5">
                         <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                         <animate attributeName="stroke-width" values="0.8;2;0.8" dur="3s" repeatCount="indefinite" />
                       </path>
                     </svg>
                    )}
                    <span id="vp-amount">{formatCurrency(vpBalance || 0)}</span>
                  </div>
                </li>
                
                {/* Notification Icon */}
                <li className="auth-hide logged-in">
                  <NotificationIcon />
                </li>
                
                {/* Profile Dropdown Menu */}
                <li className="profile-dropdown auth-hide logged-in">
                  <a href="#" className="profile-trigger">
                    <div className="profile-picture-container">
                      <div className="profile-picture" id="navbar-profile-pic">
                        {getUserAvatarUrl(userProfile) ? (
                          <CachedImage 
                            src={getUserAvatarUrl(userProfile)}
                            defaultType="PROFILE_1"
                            alt={formatUserDisplayName(userProfile)} 
                            className=""
                            showLoading={false}
                            sizes="40px"
                          />
                        ) : formatUserDisplayName(userProfile) !== 'Usuário' ? (
                          <span className="profile-initials">
                            {formatUserDisplayName(userProfile)
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
                    <Link 
                      to="/profile" 
                      onClick={(e) => {
                        // If already on profile page, clear hash to go to default tab
                        if (window.location.pathname === '/profile') {
                          e.preventDefault();
                          window.location.hash = '';
                        }
                      }}
                    >
                      <i className="fas fa-user"></i> Minha conta
                    </Link>
                    <Link to="/messages">
                      <i className="fas fa-envelope"></i> Mensagens
                    </Link>
                    <Link to="/my-services">
                      <i className="fas fa-briefcase"></i> Meus Serviços
                    </Link>
                    {(userProfile?.accountType === 'client' || userProfile?.accountType === 'both') && (
                      <Link to="/my-purchases">
                        <i className="fas fa-shopping-bag"></i> Minhas Compras
                      </Link>
                    )}
                    <Link to="/wallet"><i className="fas fa-wallet"></i> Carteira</Link>
                    <Link to="/settings"><i className="fas fa-cog"></i> Configurações</Link>
                    <div className="dropdown-divider"></div>
                    <a href="#" onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Logout</a>
                  </div>
                </li>
              </>
            )}
          </ul>

          {/* Mobile Menu Button */}
          <button 
            className={`mobile-menu-btn ${mobileMenuOpen ? 'menu-open' : ''}`} 
            onClick={toggleMobileMenu}
          >
            <i className="fas fa-bars"></i>
          </button>
        </nav>
      </header>

      {/* Mobile Navigation Overlay */}
      <div 
        className={`mobile-nav ${mobileMenuOpen ? 'active' : ''}`}
        onClick={(e) => {
          // Close menu if clicking on the backdrop (not the content)
          if (e.target === e.currentTarget) {
            closeMobileMenu(e);
          }
        }}
      >
        <div className="mobile-nav-header">
          <Link to="/" className="logo" onClick={() => setTimeout(closeMobileMenu, 100)}>
            <img src="/images/Flor-Colorida.png" alt="Vixter logo" className="logo-icon" />
            <span>Vixter</span>
          </Link>
          <button className="mobile-nav-close" onClick={closeMobileMenu}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <ul className="mobile-nav-links">
          <li><Link to="/vixies" className={isActive('/vixies') ? 'active' : ''} onClick={() => setTimeout(closeMobileMenu, 100)}>
            <i className="fas fa-users"></i>Vixies
          </Link></li>
          <li><Link to="/vixink" className={isActive('/vixink') ? 'active' : ''} onClick={() => setTimeout(closeMobileMenu, 100)}>
            <i className="fas fa-link"></i>Vixink
          </Link></li>
          <li><Link to="/feed" className={isActive('/feed') ? 'active' : ''} onClick={() => setTimeout(closeMobileMenu, 100)}>
            <i className="fas fa-comments"></i>Feed
          </Link></li>
          
          
          {!currentUser ? (
            <>
              <li className="auth-hide logged-out">
                <Link to="/login" onClick={() => setTimeout(closeMobileMenu, 100)}>
                  <i className="fas fa-sign-in-alt"></i>Entrar
                </Link>
              </li>
              <li className="auth-hide logged-out">
                <Link to="/register" onClick={() => setTimeout(closeMobileMenu, 100)}>
                  <i className="fas fa-user-plus"></i>Registrar
                </Link>
              </li>
            </>
          ) : (
            <>
              <li><Link 
                to="/profile" 
                onClick={(e) => {
                  // If already on profile page, clear hash to go to default tab
                  if (window.location.pathname === '/profile') {
                    e.preventDefault();
                    window.location.hash = '';
                  }
                  setTimeout(closeMobileMenu, 100);
                }}
              >
                <i className="fas fa-user"></i>Minha conta
              </Link></li>
              <li><Link to="/messages" className={isActive('/messages') ? 'active' : ''} onClick={() => setTimeout(closeMobileMenu, 100)}>
                <i className="fas fa-envelope"></i>Mensagens
              </Link></li>
              <li><Link to="/my-services" onClick={() => setTimeout(closeMobileMenu, 100)}>
                <i className="fas fa-briefcase"></i>Meus Serviços
              </Link></li>
              {(userProfile?.accountType === 'client' || userProfile?.accountType === 'both') && (
                <li><Link to="/my-purchases" onClick={() => setTimeout(closeMobileMenu, 100)}>
                  <i className="fas fa-shopping-bag"></i>Minhas Compras
                </Link></li>
              )}
              <li><Link to="/wallet" onClick={() => setTimeout(closeMobileMenu, 100)}>
                <i className="fas fa-wallet"></i>Carteira
              </Link></li>
              <li><Link to="/settings" onClick={() => setTimeout(closeMobileMenu, 100)}>
                <i className="fas fa-cog"></i>Configurações
              </Link></li>
              <li>
                <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); closeMobileMenu(); }}>
                  <i className="fas fa-sign-out-alt"></i>Logout
                </a>
              </li>
            </>
          )}
        </ul>

        {currentUser && (
          <div className="mobile-nav-footer">
            <div className="mobile-vp-balance" onClick={() => { handleVpBalanceClick(); closeMobileMenu(); }}>
              {userProfile?.accountType === 'provider' ? (
                <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="mobile-hexGradient-vc" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0A1F0A" />
                      <stop offset="100%" stopColor="#1A2E1A" />
                    </linearGradient>
                    <linearGradient id="mobile-textGradient-vc" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00C853" />
                      <stop offset="100%" stopColor="#4CAF50" />
                    </linearGradient>
                  </defs>
                  
                  <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                        fill="url(#mobile-hexGradient-vc)" 
                        stroke="#00C853" 
                        strokeWidth="1.5" />
                  
                  <text x="64" y="72" 
                        fontFamily="'Press Start 2P', monospace" 
                        fontSize="16" 
                        fill="url(#mobile-textGradient-vc)"
                        textAnchor="middle"
                        fontWeight="bold">VC</text>
                </svg>
              ) : (
                <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                {/* Simplified VP icon for mobile */}
                <defs>
                  <linearGradient id="mobile-hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0F0F1A" />
                    <stop offset="100%" stopColor="#1A1A2E" />
                  </linearGradient>
                  <linearGradient id="mobile-textGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00FFCA" />
                    <stop offset="100%" stopColor="#00D4AA" />
                  </linearGradient>
                </defs>
                
                <path d="M64 8 L108 32 L108 96 L64 120 L20 96 L20 32 Z" 
                      fill="url(#mobile-hexGradient)" 
                      stroke="#8A2BE2" 
                      strokeWidth="1.5" />
                
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="16" 
                      fill="url(#mobile-textGradient)"
                      textAnchor="middle"
                      fontWeight="bold">VP</text>
              </svg>
              )}
              <span>{formatCurrency(vpBalance || 0)}</span>
            </div>
            
            <div className="mobile-notification-section">
              <NotificationIcon />
            </div>
            
            <div className="mobile-profile-section">
              <div className="mobile-profile-avatar">
                {getUserAvatarUrl(userProfile) ? (
                  <CachedImage 
                    src={getUserAvatarUrl(userProfile)}
                    defaultType="PROFILE_1"
                    alt={formatUserDisplayName(userProfile)} 
                    className=""
                    showLoading={false}
                    sizes="36px"
                  />
                ) : formatUserDisplayName(userProfile) !== 'Usuário' ? (
                  <span className="profile-initials">
                    {formatUserDisplayName(userProfile)
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
              <div className="mobile-profile-info">
                <div className="mobile-profile-name">
                  {formatUserDisplayName(userProfile)}
                </div>
                <div className="mobile-profile-username">
                  @{userProfile?.username || 'user'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Header;