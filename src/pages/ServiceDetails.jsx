import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../config/firebase';
import { ref, get, push, set } from 'firebase/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CachedImage from '../components/CachedImage';
import './ServiceDetails.css';

const ServiceDetails = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [service, setService] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    notes: ''
  });

  useEffect(() => {
    loadServiceDetails();
  }, [serviceId]);

  const loadServiceDetails = async () => {
    try {
      // Load service data
      const serviceRef = ref(database, `services/${serviceId}`);
      const serviceSnapshot = await get(serviceRef);
      
      if (!serviceSnapshot.exists()) {
        setIsLoading(false);
        return;
      }

      const serviceData = {
        id: serviceSnapshot.key,
        ...serviceSnapshot.val()
      };
      
      setService(serviceData);

      // Load provider data
      if (serviceData.userId) {
        const providerRef = ref(database, `users/${serviceData.userId}`);
        const providerSnapshot = await get(providerRef);
        
        if (providerSnapshot.exists()) {
          setProvider(providerSnapshot.val());
        }
      }

      // Increment view count
      if (serviceData.views !== undefined) {
        const updatedViews = (serviceData.views || 0) + 1;
        await set(ref(database, `services/${serviceId}/views`), updatedViews);
      }

    } catch (error) {
      console.error('Error loading service details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setIsBooking(true);

    try {
      const bookingRef = push(ref(database, 'bookings'));
      const booking = {
        id: bookingRef.key,
        serviceId: service.id,
        serviceTitle: service.title,
        providerId: service.userId,
        clientId: currentUser.uid,
        clientName: currentUser.displayName || currentUser.email,
        price: service.price,
        date: bookingData.date,
        time: bookingData.time,
        notes: bookingData.notes,
        status: 'pending',
        createdAt: Date.now()
      };

      await set(bookingRef, booking);
      
      alert('Serviço agendado com sucesso! O prestador será notificado.');
      setShowBookingForm(false);
      setBookingData({ date: '', time: '', notes: '' });
      
    } catch (error) {
      console.error('Error booking service:', error);
      alert('Erro ao agendar serviço. Tente novamente.');
    } finally {
      setIsBooking(false);
    }
  };

  const handleContactProvider = () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    // Navigate to messages with the provider
    navigate(`/messages?user=${service.userId}`);
  };

  const formatPrice = (price) => {
    return `VP ${parseFloat(price).toFixed(2)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Data não disponível';
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  const getProviderRating = () => {
    if (!provider?.rating) return '★★★★☆';
    const rating = Math.round(provider.rating);
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const getMinDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Allow booking from tomorrow
    return today.toISOString().split('T')[0];
  };

  if (isLoading) {
    return (
      <div className="service-details-loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Carregando detalhes do serviço...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="service-details-page">
        <Header />
        <main className="service-details-container">
          <div className="error-state">
            <i className="fas fa-exclamation-triangle"></i>
            <h2>Serviço não encontrado</h2>
            <p>O serviço que você está procurando não existe ou foi removido.</p>
            <button className="btn btn-primary" onClick={() => navigate('/services')}>
              <i className="fas fa-arrow-left"></i>
              Voltar aos Serviços
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isOwnService = currentUser?.uid === service.userId;

  return (
    <div className="service-details-page">
      <Header />
      
      <main className="service-details-container">
        <div className="service-details-header">
          <button 
            className="back-btn"
            onClick={() => navigate(-1)}
          >
            <i className="fas fa-arrow-left"></i>
            Voltar
          </button>
        </div>

        <div className="service-details-content">
          <div className="service-main">
            {service.images && service.images.length > 0 && (
              <div className="service-images">
                <div className="main-image">
                  <CachedImage 
                    src={service.images[0]} 
                    alt={service.title}
                    className="service-main-img"
                  />
                </div>
                {service.images.length > 1 && (
                  <div className="image-thumbnails">
                    {service.images.slice(1, 5).map((image, index) => (
                      <CachedImage 
                        key={index}
                        src={image} 
                        alt={`${service.title} ${index + 2}`}
                        className="service-thumb-img"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="service-header">
              <div className="service-title-section">
                <h1 className="service-title">{service.title}</h1>
                <div className="service-meta">
                  <span className="service-category">
                    <i className="fas fa-tag"></i>
                    {service.category || 'Geral'}
                  </span>
                  {service.duration && (
                    <span className="service-duration">
                      <i className="fas fa-clock"></i>
                      {service.duration} min
                    </span>
                  )}
                  <span className="service-views">
                    <i className="fas fa-eye"></i>
                    {service.views || 0} visualizações
                  </span>
                </div>
              </div>
              <div className="service-price-section">
                <div className="service-price">{formatPrice(service.price)}</div>
                {service.status && service.status !== 'active' && (
                  <div className={`service-status-badge ${service.status}`}>
                    {service.status === 'paused' ? 'Pausado' : 'Indisponível'}
                  </div>
                )}
              </div>
            </div>

            <div className="service-description">
              <h3>Descrição do Serviço</h3>
              <p>{service.description}</p>
            </div>
          </div>

          <div className="service-sidebar">
            {provider && (
              <div className="provider-card">
                <h3>Sobre o Prestador</h3>
                <div className="provider-info">
                  <div className="provider-avatar">
                    <CachedImage 
                      src={provider.profilePictureURL}
                      defaultType="PROFILE_1"
                      alt={provider.displayName}
                      className="provider-avatar-img"
                    />
                  </div>
                  <div className="provider-details">
                    <h4 className="provider-name">{provider.displayName || 'Usuário'}</h4>
                    <p className="provider-username">@{provider.username}</p>
                    <div className="provider-rating">
                      <span className="stars">{getProviderRating()}</span>
                      <span className="reviews-count">
                        ({provider.reviewCount || 0} avaliações)
                      </span>
                    </div>
                    {provider.bio && (
                      <p className="provider-bio">{provider.bio}</p>
                    )}
                  </div>
                </div>
                
                <div className="provider-stats">
                  <div className="stat">
                    <span className="stat-value">{provider.totalServices || 0}</span>
                    <span className="stat-label">Serviços</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{provider.completedOrders || 0}</span>
                    <span className="stat-label">Concluídos</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatDate(provider.createdAt)}</span>
                    <span className="stat-label">Membro desde</span>
                  </div>
                </div>
              </div>
            )}

            {!isOwnService && service.status === 'active' && (
              <div className="service-actions">
                <button 
                  className="btn btn-primary action-btn"
                  onClick={() => setShowBookingForm(true)}
                  disabled={!currentUser}
                >
                  <i className="fas fa-calendar-plus"></i>
                  Agendar Serviço
                </button>
                <button 
                  className="btn btn-secondary action-btn"
                  onClick={handleContactProvider}
                  disabled={!currentUser}
                >
                  <i className="fas fa-message"></i>
                  Entrar em Contato
                </button>
                {!currentUser && (
                  <p className="auth-notice">
                    <i className="fas fa-info-circle"></i>
                    Faça login para agendar este serviço
                  </p>
                )}
              </div>
            )}

            {isOwnService && (
              <div className="owner-actions">
                <p className="owner-notice">
                  <i className="fas fa-info-circle"></i>
                  Este é seu próprio serviço
                </p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => navigate(`/profile/${currentUser.uid}`)}
                >
                  <i className="fas fa-edit"></i>
                  Gerenciar no Perfil
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Booking Modal */}
        {showBookingForm && (
          <div className="booking-modal-overlay">
            <div className="booking-modal">
              <div className="booking-modal-header">
                <h3>Agendar Serviço</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowBookingForm(false)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <form className="booking-form" onSubmit={handleBookingSubmit}>
                <div className="form-group">
                  <label htmlFor="booking-date">Data *</label>
                  <input
                    type="date"
                    id="booking-date"
                    value={bookingData.date}
                    onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                    min={getMinDate()}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="booking-time">Horário *</label>
                  <select
                    id="booking-time"
                    value={bookingData.time}
                    onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })}
                    required
                  >
                    <option value="">Selecione um horário</option>
                    <option value="09:00">09:00</option>
                    <option value="10:00">10:00</option>
                    <option value="11:00">11:00</option>
                    <option value="12:00">12:00</option>
                    <option value="13:00">13:00</option>
                    <option value="14:00">14:00</option>
                    <option value="15:00">15:00</option>
                    <option value="16:00">16:00</option>
                    <option value="17:00">17:00</option>
                    <option value="18:00">18:00</option>
                    <option value="19:00">19:00</option>
                    <option value="20:00">20:00</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="booking-notes">Observações</label>
                  <textarea
                    id="booking-notes"
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    rows="3"
                    placeholder="Informações adicionais sobre o serviço..."
                  />
                </div>

                <div className="booking-summary">
                  <div className="summary-item">
                    <span>Serviço:</span>
                    <span>{service.title}</span>
                  </div>
                  <div className="summary-item">
                    <span>Preço:</span>
                    <span className="price">{formatPrice(service.price)}</span>
                  </div>
                </div>

                <div className="booking-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowBookingForm(false)}
                    disabled={isBooking}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isBooking}
                  >
                    {isBooking ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Agendando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check"></i>
                        Confirmar Agendamento
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ServiceDetails;