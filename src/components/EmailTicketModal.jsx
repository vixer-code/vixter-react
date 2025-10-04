import React, { useState } from 'react';
import { useEmailTicket } from '../contexts/EmailTicketContext';
import { useNotification } from '../contexts/NotificationContext';
import PurpleSpinner from './PurpleSpinner';
import './EmailTicketModal.css';

const EmailTicketModal = ({ isOpen, onClose }) => {
  const { 
    createTicket, 
    TICKET_CATEGORIES,
    TICKET_PRIORITIES,
    creating
  } = useEmailTicket();
  
  const { showSuccess, showError } = useNotification();
  
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'technical',
    priority: 'medium'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.description.trim()) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.description.trim().length < 20) {
      showError('A descrição deve ter pelo menos 20 caracteres');
      return;
    }

    try {
      const ticketId = await createTicket(formData);
      if (ticketId) {
        // Reset form
        setFormData({
          subject: '',
          description: '',
          category: 'technical',
          priority: 'medium'
        });
        onClose();
      }
    } catch (error) {
      showError('Erro ao processar ticket');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="email-ticket-modal-overlay">
      <div className="email-ticket-modal">
        <div className="modal-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="fas fa-envelope"></i>
            </div>
            <div className="header-text">
              <h2>Novo Ticket de Suporte</h2>
              <p>Descreva seu problema e nossa equipe entrará em contato via email</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-content">
          <form onSubmit={handleSubmit} className="ticket-form">
            <div className="form-group">
              <label htmlFor="subject">
                <i className="fas fa-tag"></i>
                Assunto *
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Descreva brevemente o problema"
                required
                maxLength={100}
              />
              <small>Máximo 100 caracteres</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">
                  <i className="fas fa-folder"></i>
                  Categoria *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                >
                  {TICKET_CATEGORIES.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <small>{TICKET_CATEGORIES.find(c => c.id === formData.category)?.description}</small>
              </div>

              <div className="form-group">
                <label htmlFor="priority">
                  <i className="fas fa-exclamation-triangle"></i>
                  Prioridade *
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  required
                >
                  {TICKET_PRIORITIES.map(priority => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
                <small>{TICKET_PRIORITIES.find(p => p.id === formData.priority)?.description}</small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">
                <i className="fas fa-align-left"></i>
                Descrição Detalhada *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Descreva o problema em detalhes. Inclua passos para reproduzir, mensagens de erro, screenshots, etc. Quanto mais detalhes, melhor será nossa capacidade de ajudar."
                rows={8}
                required
                minLength={20}
                maxLength={2000}
              />
              <small>
                {formData.description.length}/2000 caracteres (mínimo 20)
              </small>
            </div>

            <div className="info-box">
              <div className="info-icon">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="info-content">
                <h4>Como funciona o suporte via email?</h4>
                <ul>
                  <li>Você receberá um email de confirmação com o ID do ticket</li>
                  <li>Nossa equipe analisará seu problema e responderá por email</li>
                  <li>Para responder, simplesmente responda o email recebido</li>
                  <li>O ticket será atualizado automaticamente com suas mensagens</li>
                </ul>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                <i className="fas fa-times"></i>
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={creating || !formData.subject.trim() || !formData.description.trim() || formData.description.trim().length < 20}
              >
                {creating ? (
                  <>
                    <PurpleSpinner size="small" />
                    Criando Ticket...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane"></i>
                    Criar Ticket
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmailTicketModal;
