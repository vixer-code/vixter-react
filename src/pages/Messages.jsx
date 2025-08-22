import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FixedSizeList as List, VariableSizeList } from 'react-window';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMessaging } from '../contexts/MessagingContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import MessageBubble from '../components/MessageBubble';
import MediaInput from '../components/MediaInput';
import NewConversationModal from '../components/NewConversationModal';
import './Messages.css';

const Messages = () => {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();
  const {
    conversations,
    serviceConversations,
    selectedConversation,
    setSelectedConversation,
    messages,
    users,
    loading,
    sending,
    activeTab,
    setActiveTab,
    sendMessage,
    sendMediaMessage,
    getOtherParticipant,
    formatTime,
    MESSAGE_TYPES,
    readReceiptsEnabled,
    setReadReceiptsEnabled
  } = useMessaging();
  const { getPendingOrdersCount } = useServiceOrder();
  
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending text message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    
    if (!newMessage.trim()) return;

    const success = await sendMessage(newMessage, replyingTo?.id);
    if (success) {
      setNewMessage('');
      setReplyingTo(null);
      messageInputRef.current?.focus();
    }
  };

  // Handle media selection
  const handleMediaSelect = async (file, type) => {
    const success = await sendMediaMessage(file, type, '');
    if (success) {
      // Media sent successfully
    }
  };

  // Handle message reply
  const handleReply = (message) => {
    setReplyingTo(message);
    messageInputRef.current?.focus();
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations based on search term
  const filteredConversations = useMemo(() => {
    const currentConversations = activeTab === 'messages' ? conversations : serviceConversations;
    
    if (!searchTerm) return currentConversations;
    
    const term = searchTerm.toLowerCase();
    return currentConversations.filter(conversation => {
      const otherUser = getOtherParticipant(conversation);
      return otherUser.displayName?.toLowerCase().includes(term) ||
             otherUser.username?.toLowerCase().includes(term) ||
             conversation.lastMessage?.toLowerCase().includes(term);
    });
  }, [conversations, serviceConversations, searchTerm, activeTab, getOtherParticipant]);

  // Get tab label with counts
  const getTabLabel = (tab) => {
    if (tab === 'services') {
      const pendingCount = getPendingOrdersCount();
      return (
        <span>
          Serviços
          {pendingCount > 0 && <span className="notification-badge">{pendingCount}</span>}
        </span>
      );
    }
    return 'Mensagens';
  };

  if (loading) {
    return (
      <div className="messages-container">
        <div className="loading-spinner">Carregando conversas...</div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      <div className="messages-sidebar">
        <div className="messages-header">
          <div className="header-top">
            <h2>Mensagens</h2>
            <div className="header-actions">
              <button
                onClick={() => setShowNewConversationModal(true)}
                className="new-conversation-button"
                title="Nova Conversa"
              >
                <i className="fas fa-plus"></i>
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="settings-button"
                title="Configurações"
              >
                <i className="fas fa-cog"></i>
              </button>
            </div>
          </div>

          {/* Settings dropdown */}
          {showSettings && (
            <div className="settings-dropdown">
              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={readReceiptsEnabled}
                    onChange={(e) => setReadReceiptsEnabled(e.target.checked)}
                  />
                  <span>Confirmações de leitura</span>
                </label>
              </div>
            </div>
          )}

          {/* Tab navigation */}
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'messages' ? 'active' : ''}`}
              onClick={() => setActiveTab('messages')}
            >
              {getTabLabel('messages')}
            </button>
            <button
              className={`tab-button ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              {getTabLabel('services')}
            </button>
          </div>
          
          <div className="search-container">
            <input
              type="text"
              placeholder={`Pesquisar ${activeTab === 'messages' ? 'conversas' : 'serviços'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <i className="fas fa-search search-icon"></i>
          </div>
        </div>
        
        <div className="conversations-list">
          {filteredConversations.length === 0 ? (
            <div className="no-conversations">
              <div className="empty-state">
                <i className="fas fa-comments"></i>
                <h3>
                  {activeTab === 'messages' 
                    ? 'Nenhuma conversa encontrada' 
                    : 'Nenhuma conversa de serviço'
                  }
                </h3>
                <p>
                  {activeTab === 'messages'
                    ? 'Clique no botão + acima para iniciar uma nova conversa'
                    : 'Conversas de serviços aparecerão aqui quando você comprar ou vender serviços'
                  }
                </p>
                {activeTab === 'messages' && (
                  <button 
                    className="start-conversation-btn"
                    onClick={() => setShowNewConversationModal(true)}
                  >
                    <i className="fas fa-plus"></i>
                    Nova Conversa
                  </button>
                )}
              </div>
            </div>
          ) : (
            <List
              height={400}
              width={'100%'}
              itemCount={filteredConversations.length}
              itemSize={72}
              itemKey={(index) => filteredConversations[index].id}
            >
              {({ index, style }) => {
                const conversation = filteredConversations[index];
                const otherUser = getOtherParticipant(conversation);
                const isSelected = selectedConversation?.id === conversation.id;
                const isServiceConversation = conversation.type === 'service';
                
                return (
                  <div
                    style={style}
                    className={`conversation-item ${isSelected ? 'selected' : ''} ${
                      isServiceConversation ? 'service-conversation' : ''
                    }`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="conversation-avatar">
                      <img
                        src={otherUser.photoURL || '/images/defpfp1.png'}
                        alt={otherUser.displayName || 'User'}
                        onError={(e) => {
                          e.target.src = '/images/defpfp1.png';
                        }}
                      />
                      <div className={`status-indicator ${otherUser.status || 'offline'}`}></div>
                      {isServiceConversation && (
                        <div className="service-indicator">
                          <i className="fas fa-handshake"></i>
                        </div>
                      )}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-name">
                        {otherUser.displayName || otherUser.username || 'Usuário'}
                        {isServiceConversation && (
                          <span className="service-badge">Serviço</span>
                        )}
                      </div>
                      <div className="conversation-preview">
                        {conversation.lastMessage || 'Nenhuma mensagem ainda'}
                      </div>
                    </div>
                    {conversation.lastMessageTime && (
                      <div className="conversation-time">
                        {formatTime(conversation.lastMessageTime)}
                      </div>
                    )}
                  </div>
                );
              }}
            </List>
          )}
        </div>
      </div>

      <div className="messages-main">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <img
                  src={getOtherParticipant(selectedConversation).photoURL || '/images/defpfp1.png'}
                  alt={getOtherParticipant(selectedConversation).displayName || 'User'}
                  onError={(e) => {
                    e.target.src = '/images/defpfp1.png';
                  }}
                />
                <div>
                  <h3>
                    {getOtherParticipant(selectedConversation).displayName || 'Usuário'}
                    {selectedConversation.type === 'service' && (
                      <span className="service-chat-badge">
                        <i className="fas fa-handshake"></i>
                        Conversa de Serviço
                      </span>
                    )}
                  </h3>
                  <span className={`status-text ${getOtherParticipant(selectedConversation).status || 'offline'}`}>
                    {getOtherParticipant(selectedConversation).status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="messages-list">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <div className="empty-state">
                    <i className="fas fa-comments"></i>
                    <h3>Nenhuma mensagem ainda</h3>
                    <p>Inicie uma conversa enviando a primeira mensagem!</p>
                  </div>
                </div>
              ) : (
                <VariableSizeList
                  height={520}
                  width={'100%'}
                  itemCount={messages.length}
                  estimatedItemSize={80}
                  itemSize={(index) => {
                    const message = messages[index];
                    if (message.type === MESSAGE_TYPES.SERVICE_NOTIFICATION) {
                      return 200; // Service notifications are larger
                    }
                    if (message.type !== MESSAGE_TYPES.TEXT) {
                      return 120; // Media messages
                    }
                    const textLength = message.content?.length || 0;
                    const lines = Math.ceil(textLength / 40);
                    return Math.min(200, 60 + lines * 18);
                  }}
                  itemKey={(index) => messages[index].id}
                >
                  {({ index, style }) => (
                    <div style={style}>
                      <MessageBubble
                        message={messages[index]}
                        users={users}
                        onReply={handleReply}
                        showAvatar={true}
                      />
                    </div>
                  )}
                </VariableSizeList>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="reply-indicator">
                <div className="reply-content">
                  <i className="fas fa-reply"></i>
                  <span>Respondendo a: {replyingTo.content?.substring(0, 50)}...</span>
                </div>
                <button onClick={cancelReply} className="cancel-reply">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}

            <div className="message-input-container">
              <MediaInput
                onMediaSelect={handleMediaSelect}
                disabled={sending}
              />
              
              <form onSubmit={handleSendMessage} className="message-form">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua mensagem..."
                  className="message-input"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="send-button"
                >
                  {sending ? (
                    <div className="button-spinner"></div>
                  ) : (
                    <i className="fas fa-paper-plane"></i>
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="no-conversation-selected">
            <div className="select-conversation-message">
              <i className="fas fa-comments"></i>
              <h3>Selecione uma conversa</h3>
              <p>
                {activeTab === 'messages'
                  ? 'Escolha uma conversa para começar a enviar mensagens'
                  : 'Selecione uma conversa de serviço para gerenciar seus pedidos'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close settings */}
      {showSettings && (
        <div 
          className="settings-overlay"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
      />
    </div>
  );
};

export default Messages;