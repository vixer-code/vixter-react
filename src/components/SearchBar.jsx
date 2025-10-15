import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useBlock } from '../contexts/BlockContext';
import { database, db } from '../../config/firebase';
import { getProfileUrl } from '../utils/profileUrls';
import { ref, query, orderByChild, startAt, endAt, get, limitToFirst } from 'firebase/database';
import { collection, query as firestoreQuery, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import './SearchBar.css';

const SearchBar = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { hasBlockBetween } = useBlock();
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
      const usersRef = collection(db, 'users');
      
      // Search by username
      const usernameQuery = firestoreQuery(
        usersRef,
        where('username', '>=', searchTerm.toLowerCase()),
        where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      
      const usernameSnapshot = await getDocs(usernameQuery);
      const users = [];
      
      usernameSnapshot.forEach((doc) => {
        const userData = doc.data();
        // Filter out blocked users
        if (userData.username && 
            userData.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !hasBlockBetween(doc.id)) {
          users.push({
            id: doc.id,
            ...userData
          });
        }
      });

      // Also search by displayName
      const displayNameQuery = firestoreQuery(
        usersRef,
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(10)
      );
      
      const displaySnapshot = await getDocs(displayNameQuery);
      displaySnapshot.forEach((doc) => {
        const userData = doc.data();
        // Filter out blocked users
        if (userData.displayName && 
            userData.displayName.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !hasBlockBetween(doc.id)) {
          const existingUser = users.find(u => u.id === doc.id);
          if (!existingUser) {
            users.push({
              id: doc.id,
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
    // Only allow KYC verified users to search services
    if (!userProfile || !userProfile.kyc) {
      return [];
    }

    try {
      const servicesRef = collection(db, 'services');
      const searchQuery = firestoreQuery(
        servicesRef,
        where('isActive', '==', true),
        limit(20) // Get more results to filter by tags
      );
      
      const snapshot = await getDocs(searchQuery);
      const services = [];
      const searchTermLower = searchTerm.toLowerCase();
      
      snapshot.forEach((doc) => {
        const serviceData = doc.data();
        const titleMatch = serviceData.title && serviceData.title.toLowerCase().includes(searchTermLower);
        const tagMatch = serviceData.tags && Array.isArray(serviceData.tags) && 
          serviceData.tags.some(tag => tag.toLowerCase().includes(searchTermLower));
        
        if (titleMatch || tagMatch) {
          services.push({
            id: doc.id,
            ...serviceData
          });
        }
      });

      // Sort by relevance (title matches first, then tag matches)
      services.sort((a, b) => {
        const aTitleMatch = a.title && a.title.toLowerCase().includes(searchTermLower);
        const bTitleMatch = b.title && b.title.toLowerCase().includes(searchTermLower);
        
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

      return servicesWithUsernames.slice(0, 3); // Return top 3
    } catch (error) {
      console.error('Error searching services:', error);
      return [];
    }
  };

  const searchPacks = async () => {
    // Only allow KYC verified users to search packs
    if (!userProfile || !userProfile.kyc) {
      return [];
    }

    try {
      const packsRef = collection(db, 'packs');
      const searchQuery = firestoreQuery(
        packsRef,
        where('isActive', '==', true),
        limit(20) // Get more results to filter by tags
      );
      
      const snapshot = await getDocs(searchQuery);
      const packs = [];
      const searchTermLower = searchTerm.toLowerCase();
      
      snapshot.forEach((doc) => {
        const packData = doc.data();
        const titleMatch = packData.title && packData.title.toLowerCase().includes(searchTermLower);
        const tagMatch = packData.tags && Array.isArray(packData.tags) && 
          packData.tags.some(tag => tag.toLowerCase().includes(searchTermLower));
        
        if (titleMatch || tagMatch) {
          packs.push({
            id: doc.id,
            ...packData
          });
        }
      });

      // Sort by relevance (title matches first, then tag matches)
      packs.sort((a, b) => {
        const aTitleMatch = a.title && a.title.toLowerCase().includes(searchTermLower);
        const bTitleMatch = b.title && b.title.toLowerCase().includes(searchTermLower);
        
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

      return packsWithUsernames.slice(0, 3); // Return top 3
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
            placeholder={userProfile?.kyc ? "Buscar usuários, serviços, packs..." : "Buscar usuários..."}
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
                      to={getProfileUrl(user)}
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
              {userProfile?.kyc && searchResults.services.length > 0 && (
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
              {userProfile?.kyc && searchResults.packs.length > 0 && (
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
