import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, limit, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMessaging } from '../contexts/MessagingContext';
import { useNotification } from '../contexts/NotificationContext';
import { useUser } from '../contexts/UserContext';
import CachedImage from './CachedImage';
import './NewConversationModal.css';

const NewConversationModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { createConversation } = useMessaging();
  const { showNotification } = useNotification();
  const { formatUserDisplayName, getUserAvatarUrl } = useUser();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isGroupConversation, setIsGroupConversation] = useState(false);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedUsers([]);
      setGroupName('');
      setIsGroupConversation(false);
    }
  }, [isOpen]);

  // Search for users
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        // Search by username
        const usernameQuery = query(
          collection(db, 'users'),
          where('username', '>=', searchTerm.toLowerCase()),
          where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
          limit(10)
        );

        // Search by display name
        const displayNameQuery = query(
          collection(db, 'users'),
          where('displayName', '>=', searchTerm),
          where('displayName', '<=', searchTerm + '\uf8ff'),
          limit(10)
        );

        const [usernameResults, displayNameResults] = await Promise.all([
          getDocs(usernameQuery),
          getDocs(displayNameQuery)
        ]);

        const users = new Map();
        
        // Add results from both queries
        [...usernameResults.docs, ...displayNameResults.docs].forEach(doc => {
          const userData = { id: doc.id, ...doc.data() };
          // Don't include current user
          if (userData.id !== currentUser.uid) {
            users.set(userData.id, userData);
          }
        });

        setSearchResults(Array.from(users.values()));
      } catch (error) {
        console.error('Error searching users:', error);
        showNotification('Erro ao buscar usuários', 'error');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, currentUser.uid, showNotification]);

  const handleUserSelect = (user) => {
    if (isGroupConversation) {
      setSelectedUsers(prev => {
        const isSelected = prev.find(u => u.id === user.id);
        if (isSelected) {
          return prev.filter(u => u.id !== user.id);
        } else {
          return [...prev, user];
        }
      });
    } else {
      // For direct conversation, create immediately
      handleCreateConversation([user]);
    }
  };

  const handleCreateConversation = async (participants = selectedUsers) => {
    if (participants.length === 0) {
      showNotification('Selecione pelo menos um usuário', 'error');
      return;
    }

    try {
      const participantIds = [currentUser.uid, ...participants.map(u => u.id)];
      const conversationData = {
        participantIds,
        type: 'regular',
        name: isGroupConversation && groupName.trim() ? groupName.trim() : null
      };

      await createConversation(conversationData);
      showNotification('Conversa criada com sucesso!', 'success');
      onClose();
    } catch (error) {
      console.error('Error creating conversation:', error);
      showNotification('Erro ao criar conversa', 'error');
    }
  };

  const filteredResults = useMemo(() => {
    return searchResults.filter(user => 
      !selectedUsers.find(selected => selected.id === user.id)
    );
  }, [searchResults, selectedUsers]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-conversation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nova Conversa</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-content">
          {/* Conversation Type Toggle */}
          <div className="conversation-type">
            <button 
              className={!isGroupConversation ? 'active' : ''}
              onClick={() => setIsGroupConversation(false)}
            >
              <i className="fas fa-user"></i>
              Conversa Direta
            </button>
            <button 
              className={isGroupConversation ? 'active' : ''}
              onClick={() => setIsGroupConversation(true)}
            >
              <i className="fas fa-users"></i>
              Grupo
            </button>
          </div>

          {/* Group Name Input (only for groups) */}
          {isGroupConversation && (
            <div className="group-name-input">
              <label>Nome do Grupo (opcional)</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Digite o nome do grupo..."
                maxLength={50}
              />
            </div>
          )}

          {/* Search Input */}
          <div className="search-input">
            <i className="fas fa-search"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar usuários por nome ou @username..."
              autoFocus
            />
          </div>

          {/* Selected Users (for group conversations) */}
          {isGroupConversation && selectedUsers.length > 0 && (
            <div className="selected-users">
              <h4>Participantes Selecionados ({selectedUsers.length})</h4>
              <div className="selected-users-list">
                {selectedUsers.map(user => (
                  <div key={user.id} className="selected-user-chip">
                    <div className="user-avatar">
                      {getUserAvatarUrl(user) ? (
                        <CachedImage 
                          src={getUserAvatarUrl(user)}
                          defaultType="PROFILE_1"
                          alt={formatUserDisplayName(user)} 
                          sizes="24px"
                        />
                      ) : (
                        <div className="avatar-placeholder">
                          {formatUserDisplayName(user).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span>{formatUserDisplayName(user)}</span>
                    <button 
                      className="remove-user"
                      onClick={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          <div className="search-results">
            {loading && (
              <div className="loading-state">
                <i className="fas fa-spinner fa-spin"></i>
                Buscando usuários...
              </div>
            )}

            {!loading && searchTerm.length >= 2 && filteredResults.length === 0 && (
              <div className="no-results">
                <i className="fas fa-search"></i>
                <p>Nenhum usuário encontrado</p>
                <small>Tente buscar por nome ou @username</small>
              </div>
            )}

            {!loading && filteredResults.length > 0 && (
              <>
                <h4>Resultados da Busca</h4>
                <div className="users-list">
                  {filteredResults.map(user => (
                    <div 
                      key={user.id} 
                      className="user-item"
                      onClick={() => handleUserSelect(user)}
                    >
                      <div className="user-avatar">
                        {getUserAvatarUrl(user) ? (
                          <CachedImage 
                            src={getUserAvatarUrl(user)}
                            defaultType="PROFILE_1"
                            alt={formatUserDisplayName(user)} 
                            sizes="40px"
                          />
                        ) : (
                          <div className="avatar-placeholder">
                            {formatUserDisplayName(user).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="user-info">
                        <div className="user-name">{formatUserDisplayName(user)}</div>
                        <div className="user-username">@{user.username}</div>
                      </div>
                      {isGroupConversation && (
                        <div className="select-indicator">
                          <i className="fas fa-plus"></i>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {searchTerm.length < 2 && !loading && (
              <div className="search-prompt">
                <i className="fas fa-search"></i>
                <p>Digite pelo menos 2 caracteres para buscar</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer (for group conversations) */}
        {isGroupConversation && selectedUsers.length > 0 && (
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button 
              className="btn-create" 
              onClick={() => handleCreateConversation()}
            >
              Criar Grupo ({selectedUsers.length} participantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewConversationModal;
