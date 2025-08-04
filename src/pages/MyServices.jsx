import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { db } from '../config/firebase';
import { ref, onValue, remove, off, query, orderByChild, equalTo } from 'firebase/database';
import { Link } from 'react-router-dom';
import './MyServices.css';

const MyServices = () => {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadMyServices();
    }

    return () => {
      const servicesRef = ref(db, 'services');
      off(servicesRef);
    };
  }, [currentUser]);

  const loadMyServices = () => {
    const servicesRef = ref(db, 'services');
    const myServicesQuery = query(
      servicesRef,
      orderByChild('authorId'),
      equalTo(currentUser.uid)
    );

    const unsubscribe = onValue(myServicesQuery, (snapshot) => {
      const servicesData = [];
      snapshot.forEach((childSnapshot) => {
        const service = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        servicesData.push(service);
      });
      
      // Sort by creation date (newest first)
      servicesData.sort((a, b) => b.createdAt - a.createdAt);
      setServices(servicesData);
      setLoading(false);
    });

    return unsubscribe;
  };

  const deleteService = async () => {
    if (!selectedService) return;

    try {
      const serviceRef = ref(db, `services/${selectedService.id}`);
      await remove(serviceRef);
      
      setShowDeleteModal(false);
      setSelectedService(null);
      showNotification('Serviço excluído com sucesso!', 'success');
    } catch (error) {
      console.error('Error deleting service:', error);
      showNotification('Erro ao excluir serviço', 'error');
    }
  };

  const confirmDelete = (service) => {
    setSelectedService(service);
    setShowDeleteModal(true);
  };

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

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'Ativo', color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)' },
      inactive: { label: 'Inativo', color: '#ff6b6b', bg: 'rgba(255, 107, 107, 0.1)' },
      pending: { label: 'Pendente', color: '#feca57', bg: 'rgba(254, 202, 87, 0.1)' },
      draft: { label: 'Rascunho', color: '#95a5a6', bg: 'rgba(149, 165, 166, 0.1)' }
    };

    const config = statusConfig[status] || statusConfig.inactive;
    
    return (
      <span 
        className="status-badge"
        style={{ 
          color: config.color, 
          backgroundColor: config.bg,
          borderColor: config.color
        }}
      >
        {config.label}
      </span>
    );
  };

  if (!currentUser) {
    return (
      <div className="my-services-container">
        <div className="not-authenticated">
          <h2>Faça login para gerenciar seus serviços</h2>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-services-container">
        <div className="loading-spinner">Carregando seus serviços...</div>
      </div>
    );
  }

  return (
    <div className="my-services-container">
      <div className="my-services-header">
        <div className="my-services-title">
          <h1>Meus Serviços</h1>
          <p>Gerencie e monitore seus serviços oferecidos</p>
        </div>
        
        <Link to="/create-service" className="create-service-btn">
          <i className="fas fa-plus"></i>
          Criar Novo Serviço
        </Link>
      </div>

      <div className="my-services-content">
        {services.length === 0 ? (
          <div className="no-services">
            <div className="no-services-icon">
              <i className="fas fa-briefcase"></i>
            </div>
            <h3>Você ainda não tem serviços</h3>
            <p>Crie seu primeiro serviço para começar a oferecer seus talentos</p>
            <Link to="/create-service" className="create-first-service-btn">
              <i className="fas fa-plus"></i>
              Criar Primeiro Serviço
            </Link>
          </div>
        ) : (
          <>
            <div className="services-stats">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-briefcase"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-number">{services.length}</span>
                  <span className="stat-label">Total de Serviços</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-eye"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-number">
                    {services.reduce((total, service) => total + (service.views || 0), 0)}
                  </span>
                  <span className="stat-label">Visualizações</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-star"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-number">
                    {services.length > 0 
                      ? (services.reduce((total, service) => total + (service.rating || 0), 0) / services.length).toFixed(1)
                      : '0.0'
                    }
                  </span>
                  <span className="stat-label">Avaliação Média</span>
                </div>
              </div>
            </div>

            <div className="services-grid">
              {services.map((service) => (
                <div key={service.id} className="service-card">
                  <div className="service-header">
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
                      </div>
                    </div>
                    
                    <div className="service-status">
                      {getStatusBadge(service.status || 'active')}
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
                      <div className="service-stats">
                        <span className="stat">
                          <i className="fas fa-eye"></i>
                          {service.views || 0}
                        </span>
                        <span className="stat">
                          <i className="fas fa-star"></i>
                          {service.rating?.toFixed(1) || '0.0'}
                        </span>
                        <span className="stat">
                          <i className="fas fa-calendar"></i>
                          {formatDate(service.createdAt)}
                        </span>
                      </div>
                      
                      <div className="service-price">
                        <span className="price">{formatPrice(service.price)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="service-actions">
                    <Link 
                      to={`/service/${service.id}`} 
                      className="action-btn view-btn"
                    >
                      <i className="fas fa-eye"></i>
                      Visualizar
                    </Link>
                    
                    <Link 
                      to={`/edit-service/${service.id}`} 
                      className="action-btn edit-btn"
                    >
                      <i className="fas fa-edit"></i>
                      Editar
                    </Link>
                    
                    <button
                      onClick={() => confirmDelete(service)}
                      className="action-btn delete-btn"
                    >
                      <i className="fas fa-trash"></i>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar Exclusão</h3>
              <button 
                className="modal-close"
                onClick={() => setShowDeleteModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <p>
                Tem certeza que deseja excluir o serviço "{selectedService?.title}"?
                Esta ação não pode ser desfeita.
              </p>
            </div>
            
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="cancel-btn"
              >
                Cancelar
              </button>
              <button
                onClick={deleteService}
                className="confirm-btn"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyServices; 