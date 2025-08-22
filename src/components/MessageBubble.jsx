import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMessaging } from '../contexts/MessagingContext';
import MediaViewer from './MediaViewer';
import ServiceNotificationCard from './ServiceNotificationCard';
import './MessageBubble.css';

const MessageBubble = ({ message, users, onReply, showAvatar = true }) => {
  const { currentUser } = useAuth();
  const { formatTime, deleteMessage, MESSAGE_TYPES } = useMessaging();
  const [showOptions, setShowOptions] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const optionsRef = useRef(null);

  const isOwnMessage = message.senderId === currentUser?.uid;
  const isSystemMessage = message.senderId === 'system';
  const sender = isSystemMessage ? null : (users[message.senderId] || {});

  const handleDeleteMessage = async () => {
    if (window.confirm('Tem certeza que deseja deletar esta mensagem?')) {
      await deleteMessage(message.id);
    }
    setShowOptions(false);
  };

  const handleReply = () => {
    onReply(message);
    setShowOptions(false);
  };

  const getMessageContent = () => {
    switch (message.type) {
      case MESSAGE_TYPES.TEXT:
        return (
          <div className="message-text">
            {message.content}
          </div>
        );

      case MESSAGE_TYPES.IMAGE:
        return (
          <div className="message-media">
            <img
              src={message.mediaUrl}
              alt="Imagem enviada"
              className="message-image"
              onClick={() => setShowMediaViewer(true)}
              loading="lazy"
            />
            {message.content && (
              <div className="message-caption">{message.content}</div>
            )}
          </div>
        );

      case MESSAGE_TYPES.VIDEO:
        return (
          <div className="message-media">
            <video
              src={message.mediaUrl}
              className="message-video"
              controls
              preload="metadata"
            />
            {message.content && (
              <div className="message-caption">{message.content}</div>
            )}
          </div>
        );

      case MESSAGE_TYPES.AUDIO:
        return (
          <div className="message-media">
            <div className="audio-player">
              <audio src={message.mediaUrl} controls className="message-audio" />
              <div className="audio-info">
                <i className="fas fa-microphone"></i>
                <span>Mensagem de voz</span>
              </div>
            </div>
            {message.content && (
              <div className="message-caption">{message.content}</div>
            )}
          </div>
        );

      case MESSAGE_TYPES.FILE:
        return (
          <div className="message-file">
            <div className="file-preview">
              <i className="fas fa-file"></i>
              <div className="file-info">
                <div className="file-name">{message.mediaInfo?.name || 'Arquivo'}</div>
                <div className="file-size">
                  {message.mediaInfo?.size ? 
                    `${(message.mediaInfo.size / 1024 / 1024).toFixed(2)} MB` : 
                    'Tamanho desconhecido'
                  }
                </div>
              </div>
              <a
                href={message.mediaUrl}
                download={message.mediaInfo?.name}
                className="file-download"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fas fa-download"></i>
              </a>
            </div>
            {message.content && (
              <div className="message-caption">{message.content}</div>
            )}
          </div>
        );

      case MESSAGE_TYPES.SERVICE_NOTIFICATION:
        return (
          <ServiceNotificationCard 
            serviceOrderData={message.serviceOrderData}
            messageId={message.id}
          />
        );

      default:
        return (
          <div className="message-text">
            {message.content || 'Mensagem não suportada'}
          </div>
        );
    }
  };

  const getReplyContent = () => {
    if (!message.replyTo) return null;

    // In a real implementation, you'd fetch the replied message
    // For now, we'll show a placeholder
    return (
      <div className="message-reply-indicator">
        <i className="fas fa-reply"></i>
        <span>Respondendo a uma mensagem</span>
      </div>
    );
  };

  return (
    <>
      <div 
        className={`message-bubble ${isOwnMessage ? 'own-message' : 'other-message'} ${
          isSystemMessage ? 'system-message' : ''
        } ${message.type !== MESSAGE_TYPES.TEXT ? 'media-message' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowOptions(!showOptions);
        }}
      >
        {/* Avatar for other users */}
        {!isOwnMessage && !isSystemMessage && showAvatar && (
          <div className="message-avatar">
            <img
              src={sender.photoURL || '/images/defpfp1.png'}
              alt={sender.displayName || 'User'}
              onError={(e) => {
                e.target.src = '/images/defpfp1.png';
              }}
            />
          </div>
        )}

        <div className="message-content-wrapper">
          {/* Reply indicator */}
          {getReplyContent()}

          {/* Message content */}
          <div className="message-content">
            {getMessageContent()}
          </div>

          {/* Message metadata */}
          <div className="message-metadata">
            <span className="message-time">{formatTime(message.timestamp)}</span>
            {isOwnMessage && message.read && (
              <i className="fas fa-check-double message-read-indicator" title="Lida"></i>
            )}
            {isOwnMessage && !message.read && (
              <i className="fas fa-check message-sent-indicator" title="Enviada"></i>
            )}
          </div>

          {/* Message options */}
          {showOptions && !isSystemMessage && (
            <div className="message-options" ref={optionsRef}>
              <button
                onClick={handleReply}
                className="message-option-btn"
                title="Responder"
              >
                <i className="fas fa-reply"></i>
              </button>
              {isOwnMessage && (
                <button
                  onClick={handleDeleteMessage}
                  className="message-option-btn delete"
                  title="Deletar"
                >
                  <i className="fas fa-trash"></i>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media viewer modal */}
      {showMediaViewer && message.type === MESSAGE_TYPES.IMAGE && (
        <MediaViewer
          mediaUrl={message.mediaUrl}
          mediaType="image"
          caption={message.content}
          onClose={() => setShowMediaViewer(false)}
        />
      )}

      {/* Click outside to close options */}
      {showOptions && (
        <div 
          className="message-options-overlay"
          onClick={() => setShowOptions(false)}
        />
      )}
    </>
  );
};

export default MessageBubble;
