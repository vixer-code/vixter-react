import React, { useState, useEffect } from 'react';
import { ref, get, query, orderByChild, limitToFirst } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultImage } from '../utils/defaultImages';
import CachedImage from '../components/CachedImage';
import './Feed.css';

const Feed = () => {
  const { currentUser } = useAuth();
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [currentTab, setCurrentTab] = useState('services');
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [servicesPage, setServicesPage] = useState(1);
  const [providersPage, setProvidersPage] = useState(1);
  const itemsPerPage = 12;
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    maxPrice: '',
    minRating: '',
    sortBy: 'relevance'
  });

  useEffect(() => {
    initFeed();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [services, providers, filters]);

  const initFeed = async () => {
    try {
      setLoading(true);
      
      // Load services and providers
      await Promise.all([
        loadServices(),
        loadProviders()
      ]);
      
      setLoading(false);
    } catch (error) {
      console.error('Error initializing feed:', error);
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const servicesRef = ref(database, 'services');
      const servicesQuery = query(servicesRef, orderByChild('createdAt'), limitToFirst(100));
      const snapshot = await get(servicesQuery);
      
      if (snapshot.exists()) {
        const servicesData = [];
        snapshot.forEach((childSnapshot) => {
          servicesData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        setServices(servicesData);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadProviders = async () => {
    try {
      const providersRef = ref(database, 'users');
      const providersQuery = query(providersRef, orderByChild('isProvider'), limitToFirst(100));
      const snapshot = await get(providersQuery);
      
      if (snapshot.exists()) {
        const providersData = [];
        snapshot.forEach((childSnapshot) => {
          const userData = childSnapshot.val();
          if (userData.isProvider) {
            providersData.push({
              id: childSnapshot.key,
              ...userData
            });
          }
        });
        setProviders(providersData);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const applyFilters = () => {
    let filteredServicesData = [...services];
    let filteredProvidersData = [...providers];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredServicesData = filteredServicesData.filter(service =>
        service.title?.toLowerCase().includes(searchTerm) ||
        service.description?.toLowerCase().includes(searchTerm) ||
        service.category?.toLowerCase().includes(searchTerm)
      );
      
      filteredProvidersData = filteredProvidersData.filter(provider =>
        provider.displayName?.toLowerCase().includes(searchTerm) ||
        provider.username?.toLowerCase().includes(searchTerm) ||
        provider.bio?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply category filter
    if (filters.category) {
      filteredServicesData = filteredServicesData.filter(service =>
        service.category === filters.category
      );
    }

    // Apply price filter
    if (filters.maxPrice) {
      filteredServicesData = filteredServicesData.filter(service =>
        service.price <= parseFloat(filters.maxPrice)
      );
    }

    // Apply rating filter
    if (filters.minRating) {
      filteredServicesData = filteredServicesData.filter(service =>
        service.rating >= parseFloat(filters.minRating)
      );
      
      filteredProvidersData = filteredProvidersData.filter(provider =>
        provider.rating >= parseFloat(filters.minRating)
      );
    }

    // Apply sorting
    filteredServicesData = sortServices(filteredServicesData);
    filteredProvidersData = sortProviders(filteredProvidersData);

    setFilteredServices(filteredServicesData);
    setFilteredProviders(filteredProvidersData);
  };

  const sortServices = (servicesToSort) => {
    const sorted = [...servicesToSort];
    
    switch (filters.sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      case 'price-high':
        return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
        return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      default:
        return sorted;
    }
  };

  const sortProviders = (providersToSort) => {
    const sorted = [...providersToSort];
    
    switch (filters.sortBy) {
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
        return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      default:
        return sorted;
    }
  };

  const handleSearch = () => {
    // Search is handled by the filters state change
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      category: '',
      maxPrice: '',
      minRating: '',
      sortBy: 'relevance'
    });
  };

  const getPaginatedItems = (items, page) => {
    const startIndex = (page - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  };

  const renderServiceCard = (service) => (
    <div key={service.id} className="service-card">
      <div className="service-image">
        <CachedImage 
          src={service.imageUrl}
          fallbackSrc="/images/default-service.jpg"
          alt={service.title}
          className="service-image-img"
          showLoading={false}
        />
      </div>
      <div className="service-info">
        <h3>{service.title}</h3>
        <p className="service-description">{service.description}</p>
        <div className="service-meta">
          <span className="service-category">{service.category}</span>
          <span className="service-price">R$ {service.price}</span>
        </div>
        <div className="service-rating">
          <span className="stars">
            {[...Array(5)].map((_, i) => (
              <i key={i} className={`fas fa-star ${i < (service.rating || 0) ? 'filled' : ''}`}></i>
            ))}
          </span>
          <span className="rating-text">({service.rating || 0})</span>
        </div>
      </div>
    </div>
  );

  const renderProviderCard = (provider) => (
    <div key={provider.id} className="provider-card">
      <div className="provider-avatar">
        <CachedImage 
          src={provider.profilePictureURL}
          defaultType="PROFILE_2"
          alt={provider.displayName}
          className="provider-avatar-img"
          showLoading={false}
        />
      </div>
      <div className="provider-info">
        <h3>{provider.displayName}</h3>
        <p className="provider-username">@{provider.username}</p>
        <p className="provider-bio">{provider.bio}</p>
        <div className="provider-meta">
          <span className="provider-rating">
            <i className="fas fa-star"></i> {provider.rating || 0}
          </span>
          <span className="provider-services">{provider.servicesCount || 0} serviços</span>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="feed-container">
        <div className="loading-text">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1>Comunidade Vixter</h1>
        <p>Descubra serviços incríveis e conecte-se com profissionais</p>
      </div>

      <div className="feed-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Buscar serviços ou profissionais..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-btn">
            <i className="fas fa-search"></i>
          </button>
        </div>

        <div className="filters-section">
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="filter-select"
          >
            <option value="">Todas as categorias</option>
            <option value="companhia">Companhia</option>
            <option value="conselhos">Conselhos</option>
            <option value="entretenimento">Entretenimento</option>
            <option value="suporte">Suporte</option>
          </select>

          <select
            value={filters.maxPrice}
            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            className="filter-select"
          >
            <option value="">Qualquer preço</option>
            <option value="50">Até R$ 50</option>
            <option value="100">Até R$ 100</option>
            <option value="200">Até R$ 200</option>
            <option value="500">Até R$ 500</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            className="filter-select"
          >
            <option value="relevance">Relevância</option>
            <option value="price-low">Menor preço</option>
            <option value="price-high">Maior preço</option>
            <option value="rating">Melhor avaliação</option>
            <option value="newest">Mais recentes</option>
          </select>

          <button onClick={resetFilters} className="reset-btn">
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="feed-tabs">
        <button
          className={`tab-btn ${currentTab === 'services' ? 'active' : ''}`}
          onClick={() => setCurrentTab('services')}
        >
          Serviços ({filteredServices.length})
        </button>
        <button
          className={`tab-btn ${currentTab === 'providers' ? 'active' : ''}`}
          onClick={() => setCurrentTab('providers')}
        >
          Profissionais ({filteredProviders.length})
        </button>
      </div>

      <div className="feed-content">
        {currentTab === 'services' ? (
          <div className="services-grid">
            {getPaginatedItems(filteredServices, servicesPage).map(renderServiceCard)}
          </div>
        ) : (
          <div className="providers-grid">
            {getPaginatedItems(filteredProviders, providersPage).map(renderProviderCard)}
          </div>
        )}

        {currentTab === 'services' && filteredServices.length === 0 && (
          <div className="no-results">
            <p>Nenhum serviço encontrado com os filtros aplicados.</p>
          </div>
        )}

        {currentTab === 'providers' && filteredProviders.length === 0 && (
          <div className="no-results">
            <p>Nenhum profissional encontrado com os filtros aplicados.</p>
          </div>
        )}
      </div>

      <div className="pagination">
        {currentTab === 'services' && (
          <div className="pagination-controls">
            <button
              onClick={() => setServicesPage(Math.max(1, servicesPage - 1))}
              disabled={servicesPage === 1}
              className="pagination-btn"
            >
              Anterior
            </button>
            <span className="page-info">
              Página {servicesPage} de {Math.ceil(filteredServices.length / itemsPerPage)}
            </span>
            <button
              onClick={() => setServicesPage(servicesPage + 1)}
              disabled={servicesPage >= Math.ceil(filteredServices.length / itemsPerPage)}
              className="pagination-btn"
            >
              Próxima
            </button>
          </div>
        )}

        {currentTab === 'providers' && (
          <div className="pagination-controls">
            <button
              onClick={() => setProvidersPage(Math.max(1, providersPage - 1))}
              disabled={providersPage === 1}
              className="pagination-btn"
            >
              Anterior
            </button>
            <span className="page-info">
              Página {providersPage} de {Math.ceil(filteredProviders.length / itemsPerPage)}
            </span>
            <button
              onClick={() => setProvidersPage(providersPage + 1)}
              disabled={providersPage >= Math.ceil(filteredProviders.length / itemsPerPage)}
              className="pagination-btn"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed; 