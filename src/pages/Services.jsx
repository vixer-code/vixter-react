import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { database } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';
import { Link } from 'react-router-dom';
import './Services.css';

const Services = () => {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const categories = [
    { value: '', label: 'Todas as Categorias' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'design', label: 'Design' },
    { value: 'coaching', label: 'Coaching' },
    { value: 'development', label: 'Desenvolvimento' },
    { value: 'writing', label: 'Escrita' },
    { value: 'music', label: 'Música' },
    { value: 'video', label: 'Vídeo' },
    { value: 'other', label: 'Outros' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Mais Recentes' },
    { value: 'oldest', label: 'Mais Antigos' },
    { value: 'price-low', label: 'Preço: Menor' },
    { value: 'price-high', label: 'Preço: Maior' },
    { value: 'rating', label: 'Melhor Avaliados' }
  ];

  useEffect(() => {
    const servicesRef = ref(database, 'services');
    
    const unsubscribe = onValue(servicesRef, (snapshot) => {
      const servicesData = [];
      snapshot.forEach((childSnapshot) => {
        const service = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        servicesData.push(service);
      });
      
      setServices(servicesData);
      setFilteredServices(servicesData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading services:', error);
      showNotification('Erro ao carregar serviços', 'error');
      setLoading(false);
    });

    return () => off(servicesRef);
  }, [showNotification]);

  useEffect(() => {
    let filtered = services;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    // Sort services
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'price-low':
          return (a.price || 0) - (b.price || 0);
        case 'price-high':
          return (b.price || 0) - (a.price || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });

    setFilteredServices(filtered);
  }, [services, searchTerm, selectedCategory, sortBy]);

  const formatPrice = (price) => {
    if (!price) return 'Gratuito';
    return `R$ ${price.toFixed(2)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR');
  };

  const getCategoryIcon = (category) => {
    const icons = {
      gaming: 'fas fa-gamepad',
      design: 'fas fa-palette',
      coaching: 'fas fa-chalkboard-teacher',
      development: 'fas fa-code',
      writing: 'fas fa-pen',
      music: 'fas fa-music',
      video: 'fas fa-video',
      other: 'fas fa-cog'
    };
    return icons[category] || 'fas fa-cog';
  };

  const getCategoryColor = (category) => {
    const colors = {
      gaming: '#ff6b6b',
      design: '#4ecdc4',
      coaching: '#45b7d1',
      development: '#96ceb4',
      writing: '#feca57',
      music: '#ff9ff3',
      video: '#54a0ff',
      other: '#5f27cd'
    };
    return colors[category] || '#5f27cd';
  };

  if (loading) {
    return (
      <div className="services-container">
        <div className="loading-spinner">Carregando serviços...</div>
      </div>
    );
  }

  return (
    <div className="services-container">
      <div className="services-header">
        <div className="services-title">
          <h1>Explorar Serviços</h1>
          <p>Descubra serviços incríveis oferecidos pela comunidade</p>
        </div>
        
        <div className="services-filters">
          <div className="search-filter">
            <div className="search-input-container">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                placeholder="Pesquisar serviços..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
          
          <div className="filter-controls">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-filter"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-filter"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="services-content">
        {filteredServices.length === 0 ? (
          <div className="no-services">
            <i className="fas fa-search"></i>
            <h3>Nenhum serviço encontrado</h3>
            <p>
              {searchTerm || selectedCategory 
                ? 'Tente ajustar seus filtros de pesquisa'
                : 'Ainda não há serviços disponíveis'
              }
            </p>
            {currentUser && (
              <Link to="/create-service" className="create-service-btn">
                <i className="fas fa-plus"></i>
                Criar Primeiro Serviço
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="services-stats">
              <span>{filteredServices.length} serviço{filteredServices.length !== 1 ? 's' : ''} encontrado{filteredServices.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="services-grid">
              {filteredServices.map((service) => (
                <div key={service.id} className="service-card">
                  <div className="service-image">
                    <img
                      src={service.imageUrl || '/images/defpfp1.png'}
                      alt={service.title}
                      onError={(e) => {
                        e.target.src = '/images/defpfp1.png';
                      }}
                    />
                    <div 
                      className="service-category"
                      style={{ backgroundColor: getCategoryColor(service.category) }}
                    >
                      <i className={getCategoryIcon(service.category)}></i>
                      {service.category}
                    </div>
                  </div>
                  
                  <div className="service-content">
                    <h3 className="service-title">{service.title}</h3>
                    <p className="service-description">
                      {service.description?.length > 100 
                        ? `${service.description.substring(0, 100)}...`
                        : service.description
                      }
                    </p>
                    
                    <div className="service-meta">
                      <div className="service-author">
                        <img
                          src={service.authorPhotoURL || '/images/defpfp1.png'}
                          alt={service.authorName}
                          onError={(e) => {
                            e.target.src = '/images/defpfp1.png';
                          }}
                        />
                        <span>{service.authorName}</span>
                      </div>
                      
                      <div className="service-rating">
                        <i className="fas fa-star"></i>
                        <span>{service.rating?.toFixed(1) || '0.0'}</span>
                      </div>
                    </div>
                    
                    <div className="service-footer">
                      <div className="service-price">
                        <span className="price">{formatPrice(service.price)}</span>
                      </div>
                      
                      <Link 
                        to={`/service/${service.id}`} 
                        className="view-service-btn"
                      >
                        Ver Detalhes
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Services; 