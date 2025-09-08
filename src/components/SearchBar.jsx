import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { database } from '../../config/firebase';
import { ref, query, orderByChild, startAt, endAt, get, limitToFirst } from 'firebase/database';
import { Link } from 'react-router-dom';
import './SearchBar.css';

const SearchBar = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState({
    users: [],
    services: [],
    packs: []
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults({ users: [], services: [], packs: [] });
      setShowDropdown(false);
      return;
    }

    const searchUsers = async () => {
      try {
        const usersRef = ref(database, 'users');
        const searchQuery = query(
          usersRef,
          orderByChild('username'),
          startAt(searchTerm.toLowerCase()),
          endAt(searchTerm.toLowerCase() + '\uf8ff'),
          limitToFirst(10)
        );
        
        const snapshot = await get(searchQuery);
        const users = [];
        snapshot.forEach((child) => {
          const userData = child.val();
          if (userData.username && userData.username.toLowerCase().includes(searchTerm.toLowerCase())) {
            users.push({
              id: child.key,
              ...userData
            });
          }
        });

        // Also search by displayName
        const displayNameQuery = query(
          usersRef,
          orderByChild('displayName'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limitToFirst(10)
        );
        
        const displaySnapshot = await get(displayNameQuery);
        displaySnapshot.forEach((child) => {
          const userData = child.val();
          if (userData.displayName && userData.displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
            const existingUser = users.find(u => u.id === child.key);
            if (!existingUser) {
              users.push({
                id: child.key,
                ...userData
              });
            }
          }
        });

        return users.slice(0, 3); // Top 3 users
      } catch (error) {
        console.error('Error searching users:', error);
        return [];
      }
    };

    const searchServices = async () => {
      if (!userProfile || userProfile.idVerified !== true) {
        return [];
      }

      try {
        const servicesRef = ref(database, 'services');
        const searchQuery = query(
          servicesRef,
          orderByChild('title'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limitToFirst(3)
        );
        
        const snapshot = await get(searchQuery);
        const services = [];
        snapshot.forEach((child) => {
          const serviceData = child.val();
          if (serviceData.title && serviceData.title.toLowerCase().includes(searchTerm.toLowerCase())) {
            services.push({
              id: child.key,
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

    const searchPacks = async () => {
      if (!userProfile || userProfile.idVerified !== true) {
        return [];
      }

      try {
        const packsRef = ref(database, 'packs');
        const searchQuery = query(
          packsRef,
          orderByChild('title'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limitToFirst(3)
        );
        
        const snapshot = await get(searchQuery);
        const packs = [];
        snapshot.forEach((child) => {
          const packData = child.val();
          if (packData.title && packData.title.toLowerCase().includes(searchTerm.toLowerCase())) {
            packs.push({
              id: child.key,
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

    const performSearch = async () => {
      setLoading(true);
      try {
        const [users, services, packs] = await Promise.all([
          searchUsers(),
          searchServices(),
          searchPacks()
        ]);

        setSearchResults({ users, services, packs });
        setShowDropdown(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchTerm, userProfile]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Navigate to full search results page
      window.location.href = `/search?q=${encodeURIComponent(searchTerm.trim())}`;
    }
  };

  const handleResultClick = () => {
    setShowDropdown(false);
    setSearchTerm('');
  };

  const totalResults = searchResults.users.length + searchResults.services.length + searchResults.packs.length;

  return (
    <div className="search-container" ref={searchRef}>
      <form onSubmit={handleSearchSubmit} className="search-form">
        <div className="search-input-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => searchTerm.trim().length >= 2 && setShowDropdown(true)}
            placeholder="Buscar usuários, serviços, packs..."
            className="search-input"
          />
          <button type="submit" className="search-button">
            <i className="fas fa-search"></i>
          </button>
        </div>
      </form>

      {showDropdown && searchTerm.trim().length >= 2 && (
        <div className="search-dropdown" ref={dropdownRef}>
          {loading ? (
            <div className="search-loading">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Buscando...</span>
            </div>
          ) : totalResults > 0 ? (
            <>
              {/* Users Results */}
              {searchResults.users.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <i className="fas fa-users"></i>
                    Usuários
                  </div>
                  {searchResults.users.map((user) => (
                    <Link
                      key={user.id}
                      to={`/profile/${user.id}`}
                      className="search-result-item"
                      onClick={handleResultClick}
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
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Services Results */}
              {searchResults.services.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <i className="fas fa-cog"></i>
                    Serviços
                  </div>
                  {searchResults.services.map((service) => (
                    <Link
                      key={service.id}
                      to={`/service/${service.id}`}
                      className="search-result-item"
                      onClick={handleResultClick}
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
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Packs Results */}
              {searchResults.packs.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">
                    <i className="fas fa-box"></i>
                    Packs
                  </div>
                  {searchResults.packs.map((pack) => (
                    <Link
                      key={pack.id}
                      to={`/pack/${pack.id}`}
                      className="search-result-item"
                      onClick={handleResultClick}
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
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* View All Results */}
              <div className="search-view-all">
                <Link
                  to={`/search?q=${encodeURIComponent(searchTerm.trim())}`}
                  className="view-all-link"
                  onClick={handleResultClick}
                >
                  <i className="fas fa-external-link-alt"></i>
                  Ver todos os resultados ({totalResults})
                </Link>
              </div>
            </>
          ) : (
            <div className="search-no-results">
              <i className="fas fa-search"></i>
              <span>Nenhum resultado encontrado</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
