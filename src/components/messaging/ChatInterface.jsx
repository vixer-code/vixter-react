import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEnhancedMessaging } from '../../contexts/EnhancedMessagingContext';
import { useCentrifugo } from '../../contexts/CentrifugoContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import TypingIndicator from './TypingIndicator';
import './ChatInterface.css';

const ChatInterface = ({ conversation, onClose }) => {
  const { 
    messages, 
    sendMessage, 
    sendMediaMessage, 
    getOtherParticipant,
    formatTime,
    sending,
    uploadingMedia,
    handleTypingChange,
    getTypingUsers
  } = useEnhancedMessaging();
  
  const { publish, isConnected } = useCentrifugo();
  const { currentUser } = useAuth();
  const { showError } = useNotification();
  
  const [messageText, setMessageText] = useState('');
  // Removed old typing state - now using context
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const otherUser = getOtherParticipant(conversation);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!conversation || !isConnected) return;

    const typingChannel = `typing:${conversation.id}`;
    
    const subscription = publish ? {
      onMessage: (data) => {
        if (data.userId !== currentUser?.uid) {
          setOtherUserTyping(data.isTyping);
          
          // Clear typing indicator after 3 seconds
          if (data.isTyping) {
            setTimeout(() => setOtherUserTyping(false), 3000);
          }
        }
      }
    } : null;

    return () => {
      // Cleanup if needed
    };
  }, [conversation?.id, isConnected, currentUser?.uid, publish]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Removed old typing functions - now using context

  // Handle message send
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || sending) return;

    const messageToSend = messageText.trim();
    setMessageText('');

    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Erro ao enviar mensagem');
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.type.startsWith('image/') ? 'image' : 
                    file.type.startsWith('video/') ? 'video' : 
                    file.type.startsWith('audio/') ? 'audio' : 'file';

    try {
      await sendMediaMessage(file, fileType);
    } catch (error) {
      console.error('Error sending media message:', error);
      showError('Erro ao enviar arquivo');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // Handle message input change with typing indicators
  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessageText(value);
    
    // Trigger typing indicator
    if (value.trim()) {
      handleTypingChange(true);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Common emojis
  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

  if (!conversation) {
    return (
      <div className="chat-interface no-conversation">
        <div className="no-conversation-content">
          <div className="no-conversation-icon">💬</div>
          <h3>Selecione uma conversa</h3>
          <p>Escolha uma conversa existente ou inicie uma nova conversa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-user-info">
          <div className="user-avatar">
            {otherUser.photoURL ? (
              <img src={otherUser.photoURL} alt={otherUser.displayName || otherUser.name} />
            ) : (
              <div className="default-avatar">
                {(otherUser.displayName || otherUser.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-details">
            <div className="user-name">
              {otherUser.displayName || otherUser.name || 'Usuário sem nome'}
            </div>
            <div className="user-status">
              {otherUserTyping ? 'Digitando...' : 'Online'}
            </div>
          </div>
        </div>
        <div className="chat-actions">
          <button className="action-button" title="Informações">
            ℹ️
          </button>
          <button className="action-button" onClick={onClose} title="Fechar">
            ×
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="no-messages">
              <div className="no-messages-icon">💬</div>
              <p>Nenhuma mensagem ainda</p>
              <p>Envie uma mensagem para começar a conversa</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.senderId === currentUser?.uid ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  {message.type === 'text' && (
                    <div className="message-text">{message.content}</div>
                  )}
                  
                  {message.type === 'image' && (
                    <div className="message-media">
                      <img src={message.mediaUrl} alt="Imagem" />
                      {message.content && (
                        <div className="message-caption">{message.content}</div>
                      )}
                    </div>
                  )}
                  
                  {message.type === 'video' && (
                    <div className="message-media">
                      <video controls>
                        <source src={message.mediaUrl} type="video/mp4" />
                        Seu navegador não suporta vídeos.
                      </video>
                      {message.content && (
                        <div className="message-caption">{message.content}</div>
                      )}
                    </div>
                  )}
                  
                  {message.type === 'audio' && (
                    <div className="message-media">
                      <audio controls>
                        <source src={message.mediaUrl} type="audio/mpeg" />
                        Seu navegador não suporta áudio.
                      </audio>
                      {message.content && (
                        <div className="message-caption">{message.content}</div>
                      )}
                    </div>
                  )}
                  
                  {message.type === 'file' && (
                    <div className="message-file">
                      <div className="file-icon">📎</div>
                      <div className="file-info">
                        <div className="file-name">{message.mediaInfo?.name || 'Arquivo'}</div>
                        <div className="file-size">
                          {message.mediaInfo?.size ? 
                            `${(message.mediaInfo.size / 1024).toFixed(1)} KB` : 
                            'Tamanho desconhecido'
                          }
                        </div>
                      </div>
                      <a href={message.mediaUrl} download className="download-button">
                        ⬇️
                      </a>
                    </div>
                  )}
                  
                  <div className="message-meta">
                    <span className="message-time">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.senderId === currentUser?.uid && (
                      <span className="message-status">
                        {message.read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Typing Indicator */}
          <TypingIndicator typingUsers={getTypingUsers()} />
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="message-input-container">
        <form onSubmit={handleSendMessage} className="message-input-form">
          <div className="input-actions">
            <button
              type="button"
              className="action-button"
              onClick={() => setShowMediaOptions(!showMediaOptions)}
              title="Anexar arquivo"
            >
              📎
            </button>
            <button
              type="button"
              className="action-button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Emojis"
            >
              😀
            </button>
          </div>
          
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleMessageChange}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="message-input"
              rows="1"
              disabled={sending}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!messageText.trim() || sending}
            >
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        </form>

        {/* Media Options */}
        {showMediaOptions && (
          <div className="media-options">
            <button
              className="media-option"
              onClick={() => fileInputRef.current?.click()}
            >
              📷 Foto
            </button>
            <button
              className="media-option"
              onClick={() => fileInputRef.current?.click()}
            >
              🎥 Vídeo
            </button>
            <button
              className="media-option"
              onClick={() => fileInputRef.current?.click()}
            >
              🎵 Áudio
            </button>
            <button
              className="media-option"
              onClick={() => fileInputRef.current?.click()}
            >
              📄 Arquivo
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            <div className="emoji-grid">
              {emojis.map((emoji, index) => (
                <button
                  key={index}
                  className="emoji-button"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default ChatInterface;
