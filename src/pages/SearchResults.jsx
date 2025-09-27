import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { database, db } from '../../config/firebase';
import { getProfileUrl } from '../utils/profileUrls';
import { ref, query, orderByChild, startAt, endAt, get } from 'firebase/database';
import { collection, query as firestoreQuery, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import './SearchResults.css';

const SearchResults = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState({
    users: [],
    services: [],
    packs: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, users, services, packs

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
      setSearchTerm(query);
      performSearch(query);
    }
  }, []);

  const searchUsers = async (term) => {
    try {
      const usersRef = collection(db, 'users');
      
      // Search by username
      const usernameQuery = firestoreQuery(
        usersRef,
        where('username', '>=', term.toLowerCase()),
        where('username', '<=', term.toLowerCase() + '\uf8ff')
      );
      
      const usernameSnapshot = await getDocs(usernameQuery);
      const users = [];
      
      usernameSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.username && userData.username.toLowerCase().includes(term.toLowerCase())) {
          users.push({
            id: doc.id,
            ...userData
          });
        }
      });

      // Search by displayName
      const displayNameQuery = firestoreQuery(
        usersRef,
        where('displayName', '>=', term),
        where('displayName', '<=', term + '\uf8ff')
      );
      
      const displaySnapshot = await getDocs(displayNameQuery);
      displaySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.displayName && userData.displayName.toLowerCase().includes(term.toLowerCase())) {
          const existingUser = users.find(u => u.id === doc.id);
          if (!existingUser) {
            users.push({
              id: doc.id,
              ...userData
            });
          }
        }
      });

      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  const searchServices = async (term) => {
    // Only allow KYC verified users to search services
    if (!userProfile || !userProfile.kyc) {
      return [];
    }

    try {
      const servicesRef = collection(db, 'services');
      const searchQuery = firestoreQuery(
        servicesRef,
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(searchQuery);
      const services = [];
      const termLower = term.toLowerCase();
      
      snapshot.forEach((doc) => {
        const serviceData = doc.data();
        const titleMatch = serviceData.title && serviceData.title.toLowerCase().includes(termLower);
        const tagMatch = serviceData.tags && Array.isArray(serviceData.tags) && 
          serviceData.tags.some(tag => tag.toLowerCase().includes(termLower));
        
        if (titleMatch || tagMatch) {
          services.push({
            id: doc.id,
            ...serviceData
          });
        }
      });

      // Sort by relevance (title matches first, then tag matches)
      services.sort((a, b) => {
        const aTitleMatch = a.title && a.title.toLowerCase().includes(termLower);
        const bTitleMatch = b.title && b.title.toLowerCase().includes(termLower);
        
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;
        return 0;
      });

      // Populate sellerUsername for services using providerId
      const servicesWithUsernames = await Promise.all(
        services.map(async (service) => {
          if (service.providerId && !service.sellerUsername) {
            try {
              const userRef = doc(db, 'users', service.providerId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                service.sellerUsername = userData.username || 'usuario';
              } else {
                service.sellerUsername = 'usuario';
              }
            } catch (error) {
              console.error('Error fetching service provider username:', error);
              service.sellerUsername = 'usuario';
            }
          }
          return service;
        })
      );

      return servicesWithUsernames;
    } catch (error) {
      console.error('Error searching services:', error);
      return [];
    }
  };

  const searchPacks = async (term) => {
    // Only allow KYC verified users to search packs
    if (!userProfile || !userProfile.kyc) {
      return [];
    }

    try {
      const packsRef = collection(db, 'packs');
      const searchQuery = firestoreQuery(
        packsRef,
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(searchQuery);
      const packs = [];
      const termLower = term.toLowerCase();
      
      snapshot.forEach((doc) => {
        const packData = doc.data();
        const titleMatch = packData.title && packData.title.toLowerCase().includes(termLower);
        const tagMatch = packData.tags && Array.isArray(packData.tags) && 
          packData.tags.some(tag => tag.toLowerCase().includes(termLower));
        
        if (titleMatch || tagMatch) {
          packs.push({
            id: doc.id,
            ...packData
          });
        }
      });

      // Sort by relevance (title matches first, then tag matches)
      packs.sort((a, b) => {
        const aTitleMatch = a.title && a.title.toLowerCase().includes(termLower);
        const bTitleMatch = b.title && b.title.toLowerCase().includes(termLower);
        
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;
        return 0;
      });

      // Populate sellerUsername for packs using creatorId
      const packsWithUsernames = await Promise.all(
        packs.map(async (pack) => {
          if ((pack.creatorId || pack.authorId) && !pack.sellerUsername) {
            try {
              const userId = pack.creatorId || pack.authorId;
              const userRef = doc(db, 'users', userId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                pack.sellerUsername = userData.username || 'usuario';
              } else {
                pack.sellerUsername = 'usuario';
              }
            } catch (error) {
              console.error('Error fetching pack creator username:', error);
              pack.sellerUsername = 'usuario';
            }
          }
          return pack;
        })
      );

      return packsWithUsernames;
    } catch (error) {
      console.error('Error searching packs:', error);
      return [];
    }
  };

  const performSearch = async (term) => {
    if (!term.trim()) return;

    setLoading(true);
    try {
      const [users, services, packs] = await Promise.all([
        searchUsers(term),
        searchServices(term),
        searchPacks(term)
      ]);

      setSearchResults({ users, services, packs });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      performSearch(searchTerm.trim());
      // Update URL
      window.history.pushState({}, '', `/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const getFilteredResults = () => {
    switch (activeTab) {
      case 'users':
        return { ...searchResults, services: [], packs: [] };
      case 'services':
        return { ...searchResults, users: [], packs: [] };
      case 'packs':
        return { ...searchResults, users: [], services: [] };
      default:
        return searchResults;
    }
  };

  const filteredResults = getFilteredResults();
  const totalResults = filteredResults.users.length + filteredResults.services.length + filteredResults.packs.length;

  return (
    <div className="search-results-container">
      <div className="search-results-header">
        <h1>Resultados da Busca</h1>
        
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-container">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={userProfile?.kyc ? "Buscar usuários, serviços, packs..." : "Buscar usuários..."}
              className="search-input"
            />
            <button type="submit" className="search-button">
              <i className="fas fa-search"></i>
            </button>
          </div>
        </form>
      </div>

      {searchTerm && (
        <div className="search-tabs">
          <button 
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Todos ({totalResults})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Usuários ({filteredResults.users.length})
          </button>
          {userProfile && userProfile.kyc && (
            <>
              <button 
                className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
                onClick={() => setActiveTab('services')}
              >
                Serviços ({filteredResults.services.length})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'packs' ? 'active' : ''}`}
                onClick={() => setActiveTab('packs')}
              >
                Packs ({filteredResults.packs.length})
              </button>
            </>
          )}
        </div>
      )}

      <div className="search-results-content">
        {loading ? (
          <div className="search-loading">
            <i className="fas fa-spinner fa-spin"></i>
            <span>Buscando...</span>
          </div>
        ) : searchTerm ? (
          !userProfile?.kyc && (activeTab === 'services' || activeTab === 'packs' || activeTab === 'all') ? (
            <div className="search-kyc-required">
              <i className="fas fa-shield-alt"></i>
              <h3>Verificação KYC Necessária</h3>
              <p>Para pesquisar packs e serviços, você precisa completar a verificação de identidade (KYC).</p>
              <Link to="/settings" className="kyc-link">
                <i className="fas fa-cog"></i>
                Ir para Configurações
              </Link>
            </div>
          ) : (
          totalResults > 0 ? (
            <>
              {/* Users Results */}
              {filteredResults.users.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <i className="fas fa-users"></i>
                    Usuários ({filteredResults.users.length})
                  </div>
                  <div className="search-results-grid">
                    {filteredResults.users.map((user) => (
                      <Link
                        key={user.id}
                        to={getProfileUrl(user)}
                        className="search-result-card"
                      >
                        <img
                          src={user.profilePictureURL || '/images/defpfp1.png'}
                          alt={user.displayName || user.username}
                          className="search-result-avatar"
                          onError={(e) => {
                            e.target.src = '/images/defpfp1.png';
                          }}
                        />
                        <div className="search-result-info">
                          <div className="search-result-name">
                            {user.displayName || 'Usuário'}
                          </div>
                          <div className="search-result-username">
                            @{user.username}
                          </div>
                          {user.bio && (
                            <div className="search-result-bio">
                              {user.bio}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Services Results */}
              {filteredResults.services.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <i className="fas fa-cog"></i>
                    Serviços ({filteredResults.services.length})
                  </div>
                  <div className="search-results-grid">
                    {filteredResults.services.map((service) => (
                      <Link
                        key={service.id}
                        to={`/service/${service.id}`}
                        className="search-result-card"
                      >
                        <div className="search-result-icon">
                          <i className="fas fa-cog"></i>
                        </div>
                        <div className="search-result-info">
                          <div className="search-result-name">
                            {service.title}
                          </div>
                          <div className="search-result-username">
                            por @{service.sellerUsername}
                          </div>
                          {service.description && (
                            <div className="search-result-bio">
                              {service.description}
                            </div>
                          )}
                          <div className="search-result-price">
                            {service.price} VC
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Packs Results */}
              {filteredResults.packs.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <i className="fas fa-box"></i>
                    Packs ({filteredResults.packs.length})
                  </div>
                  <div className="search-results-grid">
                    {filteredResults.packs.map((pack) => (
                      <Link
                        key={pack.id}
                        to={`/pack/${pack.id}`}
                        className="search-result-card"
                      >
                        <div className="search-result-icon">
                          <i className="fas fa-box"></i>
                        </div>
                        <div className="search-result-info">
                          <div className="search-result-name">
                            {pack.title}
                          </div>
                          <div className="search-result-username">
                            por @{pack.sellerUsername}
                          </div>
                          {pack.description && (
                            <div className="search-result-bio">
                              {pack.description}
                            </div>
                          )}
                          <div className="search-result-price">
                            {pack.price} VC
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="search-no-results">
              <i className="fas fa-search"></i>
              <h3>Nenhum resultado encontrado</h3>
              <p>Tente usar termos diferentes ou verifique a ortografia.</p>
            </div>
          )
          )
        ) : (
          <div className="search-placeholder">
            <i className="fas fa-search"></i>
            <h3>Digite algo para buscar</h3>
            <p>{userProfile?.kyc ? "Encontre usuários, serviços e packs na plataforma." : "Encontre usuários na plataforma. Complete a verificação KYC para pesquisar serviços e packs."}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
