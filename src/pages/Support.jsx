import React, { useState } from 'react';
import { EmailTicketProvider, useEmailTicket } from '../contexts/EmailTicketContext';
import { useAuth } from '../contexts/AuthContext';
import EmailTicketModal from '../components/EmailTicketModal';
import PurpleSpinner from '../components/PurpleSpinner';
import './Support.css';

// Componente interno que usa o hook
const SupportContent = () => {
  const { currentUser } = useAuth();
  const {
    tickets,
    loading,
    TICKET_CATEGORIES,
    TICKET_PRIORITIES,
    TICKET_STATUSES,
    getCategoryDisplayName,
    getPriorityDisplayName,
    getStatusDisplayName,
    getPriorityColor,
    getStatusColor,
    formatTicketId,
    formatDate,
    isKycVerified,
    isKycPending,
    isKycNotConfigured,
    emailVerified,
    emailVerificationLoading,
    getKycStatusMessage
  } = useEmailTicket();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const handleCreateTicket = () => {
    if (!currentUser) {
      alert('Você precisa estar logado para criar um ticket');
      return;
    }
    setShowCreateModal(true);
  };

  const canCreateTicket = currentUser && isKycVerified && emailVerified;
  const kycStatus = getKycStatusMessage();

  const handleViewTicket = (ticket) => {
    setSelectedTicket(ticket);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return 'fas fa-circle';
      case 'in_progress': return 'fas fa-clock';
      case 'waiting_user': return 'fas fa-user-clock';
      case 'resolved': return 'fas fa-check-circle';
      case 'closed': return 'fas fa-times-circle';
      default: return 'fas fa-circle';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'low': return 'fas fa-arrow-down';
      case 'medium': return 'fas fa-minus';
      case 'high': return 'fas fa-arrow-up';
      case 'urgent': return 'fas fa-exclamation';
      default: return 'fas fa-minus';
    }
  };

  return (
    <div className="support-page">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="fas fa-headset"></i>
            </div>
            <div className="header-text">
              <h1>Central de Suporte</h1>
              <p>Precisa de ajuda? Nossa equipe está aqui para você</p>
            </div>
          </div>
          <button 
            className="create-ticket-btn"
            onClick={handleCreateTicket}
            disabled={!canCreateTicket}
          >
            <i className="fas fa-plus"></i>
            Novo Ticket
          </button>
        </div>

        {/* Requirements Status */}
        {currentUser && (
          <div className="requirements-status">
            <h2>Status dos Requisitos</h2>
            <div className="requirements-grid">
              <div className={`requirement-card ${emailVerified ? 'verified' : 'pending'}`}>
                <div className="requirement-icon">
                  <i className={`fas ${emailVerified ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                </div>
                <div className="requirement-content">
                  <h3>Verificação de Email</h3>
                  <p>{emailVerified ? 'Email verificado' : 'Email não verificado'}</p>
                  {!emailVerified && (
                    <small>Verifique seu email para criar tickets</small>
                  )}
                </div>
              </div>
              
              <div className={`requirement-card ${isKycVerified ? 'verified' : 'pending'}`}>
                <div className="requirement-icon">
                  <i className={`fas ${kycStatus.icon}`}></i>
                </div>
                <div className="requirement-content">
                  <h3>Verificação KYC</h3>
                  <p>{kycStatus.message}</p>
                  {!isKycVerified && (
                    <small>Complete o KYC para criar tickets</small>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Help */}
        <div className="quick-help">
          <h2>Como podemos ajudar?</h2>
          <div className="help-categories">
            {TICKET_CATEGORIES.map(category => (
              <div key={category.id} className="help-category">
                <div className="category-icon">
                  <i className={category.icon}></i>
                </div>
                <div className="category-content">
                  <h3>{category.label}</h3>
                  <p>{category.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Tickets */}
        <div className="my-tickets">
          <div className="section-header">
            <h2>Meus Tickets</h2>
            <p>Acompanhe o status dos seus tickets de suporte</p>
          </div>

          {!currentUser ? (
            <div className="login-prompt">
              <div className="prompt-icon">
                <i className="fas fa-sign-in-alt"></i>
              </div>
              <div className="prompt-content">
                <h3>Faça login para ver seus tickets</h3>
                <p>Entre na sua conta para visualizar e criar tickets de suporte</p>
              </div>
            </div>
          ) : loading ? (
            <div className="loading-state">
              <PurpleSpinner size="large" />
              <p>Carregando seus tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <i className="fas fa-inbox"></i>
              </div>
              <div className="empty-content">
                <h3>Nenhum ticket encontrado</h3>
                <p>Você ainda não criou nenhum ticket de suporte</p>
                <button 
                  className="btn-primary"
                  onClick={handleCreateTicket}
                  disabled={!canCreateTicket}
                >
                  <i className="fas fa-plus"></i>
                  Criar Primeiro Ticket
                </button>
                {!canCreateTicket && (
                  <div className="requirements-notice">
                    <p><i className="fas fa-info-circle"></i> Complete a verificação de email e KYC para criar tickets</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map(ticket => (
                <div key={ticket.id} className="ticket-card">
                  <div className="ticket-header">
                    <div className="ticket-id">
                      <i className="fas fa-hashtag"></i>
                      {formatTicketId(ticket.ticketId)}
                    </div>
                    <div className="ticket-status">
                      <i className={getStatusIcon(ticket.status)}></i>
                      <span style={{ color: getStatusColor(ticket.status) }}>
                        {getStatusDisplayName(ticket.status)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="ticket-content">
                    <h3 className="ticket-subject">{ticket.subject}</h3>
                    <p className="ticket-description">
                      {ticket.description.length > 150 
                        ? `${ticket.description.substring(0, 150)}...` 
                        : ticket.description
                      }
                    </p>
                  </div>
                  
                  <div className="ticket-meta">
                    <div className="meta-item">
                      <i className="fas fa-folder"></i>
                      <span>{getCategoryDisplayName(ticket.category)}</span>
                    </div>
                    <div className="meta-item">
                      <i className={getPriorityIcon(ticket.priority)}></i>
                      <span style={{ color: getPriorityColor(ticket.priority) }}>
                        {getPriorityDisplayName(ticket.priority)}
                      </span>
                    </div>
                    <div className="meta-item">
                      <i className="fas fa-calendar"></i>
                      <span>{formatDate(ticket.createdAt)}</span>
                    </div>
                  </div>
                  
                  <div className="ticket-actions">
                    <button 
                      className="btn-secondary"
                      onClick={() => handleViewTicket(ticket)}
                    >
                      <i className="fas fa-eye"></i>
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="contact-info">
          <div className="contact-card">
            <div className="contact-icon">
              <i className="fas fa-envelope"></i>
            </div>
            <div className="contact-content">
              <h3>Contato Direto</h3>
              <p>Para questões urgentes ou dúvidas gerais</p>
              <a href="mailto:contato@vixter.com.br" className="contact-email">
                contato@vixter.com.br
              </a>
            </div>
          </div>
          
          <div className="contact-card">
            <div className="contact-icon">
              <i className="fas fa-clock"></i>
            </div>
            <div className="contact-content">
              <h3>Tempo de Resposta</h3>
              <p>Nossa equipe responde em até 24 horas</p>
              <span className="response-time">Segunda a Sexta, 9h às 18h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EmailTicketModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="ticket-detail-modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="ticket-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalhes do Ticket</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedTicket(null)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="ticket-detail-header">
                <div className="ticket-id-large">
                  <i className="fas fa-hashtag"></i>
                  {formatTicketId(selectedTicket.ticketId)}
                </div>
                <div className="ticket-status-large">
                  <i className={getStatusIcon(selectedTicket.status)}></i>
                  <span style={{ color: getStatusColor(selectedTicket.status) }}>
                    {getStatusDisplayName(selectedTicket.status)}
                  </span>
                </div>
              </div>
              
              <div className="ticket-detail-content">
                <h3>{selectedTicket.subject}</h3>
                <div className="ticket-meta-detail">
                  <div className="meta-row">
                    <span className="meta-label">Categoria:</span>
                    <span>{getCategoryDisplayName(selectedTicket.category)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Prioridade:</span>
                    <span style={{ color: getPriorityColor(selectedTicket.priority) }}>
                      {getPriorityDisplayName(selectedTicket.priority)}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Criado em:</span>
                    <span>{formatDate(selectedTicket.createdAt)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Última atualização:</span>
                    <span>{formatDate(selectedTicket.updatedAt)}</span>
                  </div>
                </div>
                
                <div className="ticket-description-detail">
                  <h4>Descrição:</h4>
                  <p>{selectedTicket.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente principal que envolve com o provider
const Support = () => {
  return (
    <EmailTicketProvider>
      <SupportContent />
    </EmailTicketProvider>
  );
};

export default Support;
