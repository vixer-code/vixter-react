import React, { useState, useEffect } from 'react';
import { useSupportTicket } from '../contexts/SupportTicketContext';
import { useNotification } from '../contexts/NotificationContext';
import PurpleSpinner from './PurpleSpinner';
import './SupportTicketModal.css';

const SupportTicketModal = ({ isOpen, onClose, ticketId = null }) => {
  const { 
    createTicket, 
    updateTicketStatus, 
    assignTicket,
    getTicketById,
    TICKET_CATEGORIES,
    TICKET_PRIORITIES,
    TICKET_STATUSES,
    isAdmin,
    creating,
    updating
  } = useSupportTicket();
  
  const { showSuccess, showError } = useNotification();
  
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'technical',
    priority: 'medium',
    attachments: []
  });
  
  const [existingTicket, setExistingTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');

  // Load existing ticket if editing
  useEffect(() => {
    if (ticketId && isOpen) {
      loadTicket();
    }
  }, [ticketId, isOpen]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const ticket = await getTicketById(ticketId);
      if (ticket) {
        setExistingTicket(ticket);
        setFormData({
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          attachments: ticket.attachments || []
        });
        setActiveTab('edit');
      }
    } catch (error) {
      showError('Erro ao carregar ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      file: file // Store file object for upload
    }));
    
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments]
    }));
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.description.trim()) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      if (existingTicket) {
        // Update existing ticket
        const success = await updateTicketStatus(ticketId, {
          subject: formData.subject,
          description: formData.description,
          category: formData.category,
          priority: formData.priority
        });
        
        if (success) {
          showSuccess('Ticket atualizado com sucesso');
          onClose();
        }
      } else {
        // Create new ticket
        const newTicketId = await createTicket(formData);
        if (newTicketId) {
          showSuccess('Ticket criado com sucesso');
          onClose();
        }
      }
    } catch (error) {
      showError('Erro ao processar ticket');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const success = await updateTicketStatus(ticketId, { status: newStatus });
      if (success) {
        setExistingTicket(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      showError('Erro ao atualizar status');
    }
  };

  const handleAssign = async (adminId) => {
    try {
      const success = await assignTicket(ticketId, adminId);
      if (success) {
        setExistingTicket(prev => ({ ...prev, assignedTo: adminId }));
      }
    } catch (error) {
      showError('Erro ao atribuir ticket');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="support-ticket-modal-overlay">
      <div className="support-ticket-modal">
        <div className="modal-header">
          <h2>
            {existingTicket ? 'Gerenciar Ticket' : 'Novo Ticket de Suporte'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <i className="fas fa-plus"></i>
            Criar Ticket
          </button>
          {existingTicket && (
            <button 
              className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              <i className="fas fa-edit"></i>
              Editar Ticket
            </button>
          )}
          {existingTicket && isAdmin() && (
            <button 
              className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
              onClick={() => setActiveTab('manage')}
            >
              <i className="fas fa-cog"></i>
              Gerenciar
            </button>
          )}
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-container">
              <PurpleSpinner text="Carregando..." />
            </div>
          ) : (
            <>
              {/* Create/Edit Form */}
              {(activeTab === 'create' || activeTab === 'edit') && (
                <form onSubmit={handleSubmit} className="ticket-form">
                  <div className="form-group">
                    <label htmlFor="subject">Assunto *</label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="Descreva brevemente o problema"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="category">Categoria *</label>
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
                    </div>

                    <div className="form-group">
                      <label htmlFor="priority">Prioridade *</label>
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
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Descrição Detalhada *</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Descreva o problema em detalhes. Inclua passos para reproduzir, mensagens de erro, etc."
                      rows={6}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="attachments">Anexos (opcional)</label>
                    <input
                      type="file"
                      id="attachments"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                    />
                    <small>Formatos aceitos: Imagens, PDF, DOC, TXT (máx. 10MB cada)</small>
                  </div>

                  {formData.attachments.length > 0 && (
                    <div className="attachments-list">
                      <h4>Anexos:</h4>
                      {formData.attachments.map((attachment, index) => (
                        <div key={index} className="attachment-item">
                          <span>{attachment.name}</span>
                          <button 
                            type="button" 
                            onClick={() => removeAttachment(index)}
                            className="remove-attachment"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="form-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary"
                      disabled={creating || updating}
                    >
                      {creating || updating ? (
                        <PurpleSpinner size="small" />
                      ) : (
                        existingTicket ? 'Atualizar Ticket' : 'Criar Ticket'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Admin Management */}
              {activeTab === 'manage' && existingTicket && isAdmin() && (
                <div className="admin-management">
                  <div className="ticket-info">
                    <h3>Informações do Ticket</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>ID:</label>
                        <span>{existingTicket.id}</span>
                      </div>
                      <div className="info-item">
                        <label>Usuário:</label>
                        <span>{existingTicket.userName}</span>
                      </div>
                      <div className="info-item">
                        <label>Email:</label>
                        <span>{existingTicket.userEmail}</span>
                      </div>
                      <div className="info-item">
                        <label>Criado em:</label>
                        <span>{new Date(existingTicket.timestamps.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="status-management">
                    <h3>Gerenciar Status</h3>
                    <div className="status-buttons">
                      {TICKET_STATUSES.map(status => (
                        <button
                          key={status.id}
                          className={`status-btn ${existingTicket.status === status.id ? 'active' : ''}`}
                          onClick={() => handleStatusChange(status.id)}
                          style={{ borderColor: status.color }}
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="assignment-management">
                    <h3>Atribuir Ticket</h3>
                    <div className="assignment-buttons">
                      <button
                        className="assign-btn"
                        onClick={() => handleAssign('admin_uid_1')}
                      >
                        Atribuir para Admin 1
                      </button>
                      <button
                        className="assign-btn"
                        onClick={() => handleAssign('admin_uid_2')}
                      >
                        Atribuir para Admin 2
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportTicketModal;
