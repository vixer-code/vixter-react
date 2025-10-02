import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedMessaging } from '../../contexts/EnhancedMessagingContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useUserStatus } from '../../hooks/useUserStatus';
import { getProfileUrl } from '../../utils/profileUrls';
import CachedImage from '../CachedImage';
import SendButtonWithAudio from '../SendButtonWithAudio';
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
    users
  } = useEnhancedMessaging();
  
  const { currentUser } = useAuth();
  const { showError } = useNotification();
  const navigate = useNavigate();
  
  const [messageText, setMessageText] = useState('');
  // Removed old typing state - now using context
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  
  // Image viewer modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [modalImageAlt, setModalImageAlt] = useState('');
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [otherUser, setOtherUser] = useState({});
  const otherUserStatus = useUserStatus(otherUser?.id);

  // Load other user data when conversation changes
  useEffect(() => {
    if (conversation) {
      getOtherParticipant(conversation).then(setOtherUser);
    }
  }, [conversation, getOtherParticipant]);

  // Handle profile navigation
  const handleProfileClick = () => {
    if (otherUser && otherUser.id) {
      const profileUrl = getProfileUrl(otherUser);
      navigate(profileUrl);
    }
  };

  // Image viewer modal handlers (mesmo padrão do Profile)
  const handleOpenImageModal = (url, alt) => {
    setModalImageUrl(url);
    setModalImageAlt(alt);
    setShowImageModal(true);
  };
  
  const handleCloseImageModal = () => setShowImageModal(false);

  // Check if user is near bottom to determine auto-scroll behavior
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
  };

  // Handle scroll events to detect user scrolling
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const wasNearBottom = isNearBottom();
    setShouldAutoScroll(wasNearBottom);
    
    // Reset user scrolling flag after a delay
    clearTimeout(window.scrollTimeout);
    setIsUserScrolling(true);
    window.scrollTimeout = setTimeout(() => {
      setIsUserScrolling(false);
    }, 150);
  };

  // Prevent scrolling on the messages container when keyboard is visible
  useEffect(() => {
    if (messagesContainerRef.current) {
      if (isKeyboardVisible) {
        // Allow scrolling only within the messages container
        messagesContainerRef.current.style.overflowY = 'auto';
        messagesContainerRef.current.style.overflowX = 'hidden';
        messagesContainerRef.current.style.webkitOverflowScrolling = 'touch';
      } else {
        // Normal scrolling behavior
        messagesContainerRef.current.style.overflowY = 'auto';
        messagesContainerRef.current.style.overflowX = 'hidden';
      }
    }
  }, [isKeyboardVisible]);

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (shouldAutoScroll && !isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll, isUserScrolling]);

  // Handle mobile keyboard visibility
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        const initialHeight = window.innerHeight;
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const heightDifference = initialHeight - currentHeight;
        
        if (heightDifference > 150) { // Keyboard is likely visible
          setIsKeyboardVisible(true);
          setKeyboardHeight(heightDifference);
          
          // Prevent body scroll when keyboard is visible
          document.body.style.overflow = 'hidden';
          document.body.style.position = 'fixed';
          document.body.style.width = '100%';
          document.body.style.height = '100%';
          
          // Scroll to bottom when keyboard appears
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        } else {
          setIsKeyboardVisible(false);
          setKeyboardHeight(0);
          
          // Restore body scroll when keyboard is hidden
          document.body.style.overflow = '';
          document.body.style.position = '';
          document.body.style.width = '';
          document.body.style.height = '';
        }
      }
    };

    // Listen for viewport changes (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
      
      // Cleanup: restore body scroll on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Typing indicators now handled by EnhancedMessagingContext
  // All typing state and functions moved to context for better management

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Removed old typing functions - now using context

  // Handle message send
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || sending) return;

    // Check if service is completed
    if (isServiceCompleted) {
      showError('Esta conversa foi finalizada e não permite mais mensagens');
      return;
    }

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
                    file.type.startsWith('audio/') ? 'audio' : null;

    // Only allow image, video, and audio files
    if (!fileType) {
      showError('Tipo de arquivo não suportado. Apenas imagens, vídeos e áudios são permitidos.');
      return;
    }

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

  // Handle audio recording from integrated button
  const handleSendAudio = async (audioFile) => {
    try {
      await sendMediaMessage(audioFile, 'audio');
    } catch (error) {
      console.error('Error sending audio:', error);
      showError('Erro ao enviar áudio');
    }
  };

  // Handle message input change with typing indicators
  const handleMessageChange = (e) => {
    const value = e.target.value;
    
    // Check if service is completed and user is trying to type
    if (isServiceCompleted && value.trim()) {
      showError('Esta conversa foi finalizada e não permite mais mensagens');
      return;
    }
    
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

  // Handle textarea focus for mobile keyboard
  const handleTextareaFocus = () => {
    if (window.innerWidth <= 768) {
      // Ensure the input is visible when focused
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    }
  };

  // Common emojis
  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

  if (!conversation) {
    return (
      <div className="chat-interface no-conversation">
        <div className="no-conversation-content">
          <div className="no-conversation-icon">💬</div>
          <h3>Sem conversas ativas</h3>
          <p>Clique em uma conversa na lista ao lado para iniciar</p>
          <p className="conversation-hint">Ou use o botão ✏️ para iniciar uma nova conversa</p>
        </div>
      </div>
    );
  }


  const isServiceCompleted = conversation?.type === 'service' && conversation?.isCompleted;

  return (
    <div 
      className={`chat-interface ${isServiceCompleted ? 'completed-service' : ''} ${isKeyboardVisible ? 'keyboard-visible' : ''}`}
      style={{
        '--keyboard-height': `${keyboardHeight}px`
      }}
    >
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-user-info" onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
          <div className="user-avatar">
            {(otherUser.photoURL || otherUser.profilePictureURL) ? (
              <img 
                src={otherUser.photoURL || otherUser.profilePictureURL} 
                alt={otherUser.displayName || otherUser.name}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="default-avatar"
              style={{ 
                display: (otherUser.photoURL || otherUser.profilePictureURL) ? 'none' : 'flex' 
              }}
            >
              {(otherUser.displayName || otherUser.name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="user-details">
            <div className="user-name">
              {otherUser.displayName || otherUser.name || 'Usuário sem nome'}
            </div>
            <div className="user-status">
              {isServiceCompleted ? (
                <span className="service-completed">🔒 Serviço Concluído</span>
              ) : otherUserStatus === 'online' ? (
                <span className="status-online">🟢 Online</span>
              ) : (
                <span className="status-offline">🔴 Offline</span>
              )}
            </div>
            {conversation?.type === 'service' && (
              <div className="service-name">
                {conversation.serviceName || 'Serviço'}
              </div>
            )}
          </div>
        </div>
        <div className="chat-actions">
        <button className="action-button close-button back-button" onClick={onClose} title="Voltar">
          ⵦ
        </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        <div className="messages-list" ref={messagesContainerRef} onScroll={handleScroll}>
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
                      <CachedImage 
                        src={message.mediaUrl} 
                        alt="Imagem enviada" 
                        className="message-image"
                        enableCache={true}
                        priority={false}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleOpenImageModal(message.mediaUrl, 'Imagem da conversa')}
                        onError={(e) => {
                          console.warn('Failed to load message image:', message.mediaUrl, e);
                        }}
                      />
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
                      <audio 
                        controls 
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          e.target.volume = 1.0; // Volume padrão em 100%
                        }}
                      >
                        <source src={message.mediaUrl} type="audio/webm" />
                        <source src={message.mediaUrl} type="audio/mpeg" />
                        <source src={message.mediaUrl} type="audio/wav" />
                        <source src={message.mediaUrl} type="audio/mp3" />
                        Seu navegador não suporta o elemento de áudio.
                      </audio>
                      {message.content && (
                        <div className="message-caption">{message.content}</div>
                      )}
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
            disabled={isServiceCompleted}
          >
            <img src="/images/clip.png" alt="Anexar arquivo" style={{ width: '16px', height: '16px' }} />
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emojis"
            disabled={isServiceCompleted}
          >
            <img src="/images/smiling-face.png" alt="Emojis" style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={handleMessageChange}
            onKeyPress={handleKeyPress}
            onFocus={handleTextareaFocus}
            placeholder={isServiceCompleted ? "Serviço finalizado - Conversa arquivada" : "Digite sua mensagem..."}
            className="message-input"
            rows="1"
            disabled={sending || isServiceCompleted}
          />
          <SendButtonWithAudio
            onSendMessage={handleSendMessage}
            onSendAudio={handleSendAudio}
            messageText={messageText}
            sending={sending}
            disabled={isServiceCompleted}
            isServiceCompleted={isServiceCompleted}
          />
        </div>
      </form>

      {/* Media Options */}
      {showMediaOptions && !isServiceCompleted && (
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
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && !isServiceCompleted && (
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
          accept="image/*,video/*,audio/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Completed Service Notice */}
      {isServiceCompleted && (
        <div className="completed-service-notice">
          <div className="notice-content">
            <i className="fas fa-check-circle"></i>
            <span>Este serviço foi concluído. A conversa está arquivada e não permite mais interações.</span>
          </div>
        </div>
      )}

      {/* Image Viewer Modal - responsivo */}
      {showImageModal && (
        <div className="modal-overlay image-viewer-overlay" onClick={handleCloseImageModal} tabIndex={-1}>
          <div 
            className="modal-content image-viewer-content" 
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={modalImageUrl} 
              alt={modalImageAlt} 
              className="image-viewer-img"
            />
            <button 
              className="modal-close image-viewer-close" 
              onClick={handleCloseImageModal}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
