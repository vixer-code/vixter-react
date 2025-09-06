import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMessaging } from '../../contexts/EnhancedMessagingContext';
import { useNotification } from '../../contexts/NotificationContext';
import './UserSelector.css';

const UserSelector = ({ onUserSelected, isOpen, onClose }) => {
  const { users, searchUsers, loading: usersLoading } = useUser();
  const { conversations, startConversation } = useMessaging();
  const { showError } = useNotification();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search users when search term changes
  useEffect(() => {
    const searchUsersDebounced = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsers(searchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching users:', error);
        showError('Erro ao buscar usuários');
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchUsersDebounced, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchUsers, showError]);

  // Check if user already has a conversation
  const hasConversationWith = (userId) => {
    return conversations.some(conv => {
      const participants = Object.keys(conv.participants || {});
      return participants.includes(userId);
    });
  };

  // Handle user selection
  const handleUserSelect = async (user) => {
    try {
      // console.log('🚀 Starting conversation with user:', user.displayName, 'UID:', user.uid || user.id);
      const userId = user.uid || user.id; // Handle both uid and id fields
      const conversation = await startConversation(userId);
      if (conversation) {
        console.log('✅ Conversation created successfully:', conversation.id);
        onUserSelected(conversation);
        onClose();
      } else {
        console.error('❌ Failed to create conversation - no conversation returned');
        showError('Falha ao criar conversa');
      }
    } catch (error) {
      console.error('❌ Error starting conversation:', error);
      showError('Erro ao iniciar conversa');
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className="user-selector-overlay" onClick={onClose}>
      <div className="user-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-selector-header">
          <h3>Iniciar Nova Conversa</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="user-selector-search">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search" onClick={clearSearch}>
                ×
              </button>
            )}
          </div>
        </div>

        <div className="user-selector-content">
          {isSearching && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Buscando usuários...</span>
            </div>
          )}

          {!isSearching && searchTerm && searchResults.length === 0 && (
            <div className="no-results">
              <p>Nenhum usuário encontrado para "{searchTerm}"</p>
            </div>
          )}

          {!isSearching && searchTerm && searchResults.length > 0 && (
            <div className="search-results">
              <h4>Resultados da busca</h4>
              {searchResults.map((user) => (
                <div
                  key={user.uid || user.id}
                  className={`user-item ${hasConversationWith(user.uid || user.id) ? 'has-conversation' : ''}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="user-avatar">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || user.name} />
                    ) : (
                      <div className="default-avatar">
                        {(user.displayName || user.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-info">
                    <div className="user-name">
                      {user.displayName || user.name || 'Usuário sem nome'}
                    </div>
                    <div className="user-username">
                      @{user.username || (user.uid || user.id || '').substring(0, 8)}
                    </div>
                    {hasConversationWith(user.uid || user.id) && (
                      <div className="conversation-indicator">
                        Já possui conversa
                      </div>
                    )}
                  </div>
                  <div className="user-actions">
                    <button
                      className="start-chat-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserSelect(user);
                      }}
                      disabled={hasConversationWith(user.uid || user.id)}
                    >
                      {hasConversationWith(user.uid || user.id) ? 'Conversar' : 'Iniciar Chat'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searchTerm && (
            <div className="recent-users">
              <h4>Usuários recentes</h4>
              <div className="recent-users-list">
                {conversations.slice(0, 5).map((conversation) => {
                  const otherUser = Object.keys(conversation.participants || {})
                    .find(uid => uid !== conversation.lastSenderId);
                  
                  if (!otherUser) return null;
                  
                  const user = users[otherUser];
                  if (!user) return null;

                  return (
                    <div
                      key={conversation.id}
                      className="user-item recent"
                      onClick={() => onUserSelected(conversation)}
                    >
                      <div className="user-avatar">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || user.name} />
                        ) : (
                          <div className="default-avatar">
                            {(user.displayName || user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="user-info">
                        <div className="user-name">
                          {user.displayName || user.name || 'Usuário sem nome'}
                        </div>
                        <div className="last-message">
                          {conversation.lastMessage || 'Nenhuma mensagem'}
                        </div>
                      </div>
                      <div className="message-time">
                        {conversation.lastMessageTime ? 
                          new Date(conversation.lastMessageTime).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : ''
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSelector;
