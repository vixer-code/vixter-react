import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { database, db } from '../../config/firebase';
import { ref, query, orderByChild, startAt, endAt, get } from 'firebase/database';
import { collection, query as firestoreQuery, where, getDocs, orderBy, limit } from 'firebase/firestore';
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
    if (!userProfile || userProfile.idVerified !== true) {
      return [];
    }

    try {
      const servicesRef = collection(db, 'services');
      const searchQuery = firestoreQuery(
        servicesRef,
        where('title', '>=', term),
        where('title', '<=', term + '\uf8ff')
      );
      
      const snapshot = await getDocs(searchQuery);
      const services = [];
      
      snapshot.forEach((doc) => {
        const serviceData = doc.data();
        if (serviceData.title && serviceData.title.toLowerCase().includes(term.toLowerCase())) {
          services.push({
            id: doc.id,
            ...serviceData
          });
        }
      });

      return services;
    } catch (error) {
      console.error('Error searching services:', error);
      return [];
    }
  };

  const searchPacks = async (term) => {
    if (!userProfile || userProfile.idVerified !== true) {
      return [];
    }

    try {
      const packsRef = collection(db, 'packs');
      const searchQuery = firestoreQuery(
        packsRef,
        where('title', '>=', term),
        where('title', '<=', term + '\uf8ff')
      );
      
      const snapshot = await getDocs(searchQuery);
      const packs = [];
      
      snapshot.forEach((doc) => {
        const packData = doc.data();
        if (packData.title && packData.title.toLowerCase().includes(term.toLowerCase())) {
          packs.push({
            id: doc.id,
            ...packData
          });
        }
      });

      return packs;
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
              placeholder="Buscar usuários, serviços, packs..."
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
          {userProfile && userProfile.idVerified && (
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
                        to={`/profile/${user.id}`}
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
        ) : (
          <div className="search-placeholder">
            <i className="fas fa-search"></i>
            <h3>Digite algo para buscar</h3>
            <p>Encontre usuários, serviços e packs na plataforma.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
