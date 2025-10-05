import React, { useEffect, useState } from 'react';
import useCall from '../hooks/useCall';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useAuth } from '../contexts/AuthContext';
import './CallInterface.css';

const CallInterface = ({ conversation, onClose }) => {
  const { currentUser } = useAuth();
  const {
    isInCall,
    isCallActive,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    callStatus,
    localVideoRef,
    remoteVideoRef,
    startCall: startCallHook,
    acceptCall: acceptCallHook,
    endCall: endCallHook,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  } = useCall();

  const { 
    incomingCall, 
    callState, 
    startCall, 
    acceptCall, 
    endCall, 
    rejectCall,
    getOtherParticipant: getOtherParticipantFromContext
  } = useEnhancedMessaging();

  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [showCallOptions, setShowCallOptions] = useState(true);
  const [callType, setCallType] = useState(null); // 'audio' or 'video'
  const [isConnecting, setIsConnecting] = useState(false);
  const [otherUser, setOtherUser] = useState(null);

  // Load other user data
  useEffect(() => {
    if (conversation) {
      getOtherParticipantFromContext(conversation).then(setOtherUser);
    }
  }, [conversation, getOtherParticipantFromContext]);

  // Handle incoming call from context
  useEffect(() => {
    if (incomingCall && incomingCall.conversationId === conversation?.id) {
      setIncomingCallData(incomingCall);
      setIsIncomingCall(true);
    }
  }, [incomingCall, conversation?.id]);

  // Get other participant info
  const getOtherParticipant = () => {
    if (!conversation?.participants || !currentUser?.uid) return null;
    const participantIds = Object.keys(conversation.participants);
    const otherId = participantIds.find(id => id !== currentUser.uid);
    return otherId;
  };

  // Get other participant user data
  const getOtherParticipantData = () => {
    const otherId = getOtherParticipant();
    if (!otherId) return null;
    
    // Try to get from conversation participants first
    const participantData = conversation.participants[otherId];
    if (participantData && typeof participantData === 'object') {
      return participantData;
    }
    
    // Fallback to users context if available
    return null; // Will be handled by the context
  };

  const handleStartCall = async (type) => {
    if (!conversation) return;
    
    try {
      setIsConnecting(true);
      setCallType(type);
      setShowCallOptions(false);
      
      const otherUserId = getOtherParticipant();
      
      if (otherUserId) {
        const result = await startCall(conversation.id, otherUserId, type);
        if (result) {
          // Start the actual call with the hook
          await startCallHook(conversation.id, otherUserId, type);
        }
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setIsConnecting(false);
      setShowCallOptions(true);
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCallData) return;
    
    try {
      await acceptCall(incomingCallData.room, conversation.id);
      setIsIncomingCall(false);
      setIncomingCallData(null);
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const handleRejectCall = () => {
    rejectCall();
    setIsIncomingCall(false);
    setIncomingCallData(null);
  };

  const handleEndCall = () => {
    endCall();
    endCallHook();
    onClose?.();
  };

  const handleBackToOptions = () => {
    setShowCallOptions(true);
    setCallType(null);
    setIsConnecting(false);
  };

  // Incoming call modal
  if (isIncomingCall) {
    return (
      <div className="call-modal-overlay">
        <div className="call-modal incoming-call">
        <div className="call-header">
          <div className="call-user-info">
            <div className="user-avatar">
              {(otherUser?.photoURL || otherUser?.profilePictureURL) ? (
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
                  display: (otherUser?.photoURL || otherUser?.profilePictureURL) ? 'none' : 'flex' 
                }}
              >
                {(otherUser?.displayName || otherUser?.name || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="user-details">
              <h3>Chamada recebida</h3>
              <p>de {otherUser?.displayName || otherUser?.name || 'Usuário'}</p>
            </div>
          </div>
        </div>
          
          <div className="call-actions">
            <button 
              className="call-button accept"
              onClick={handleAcceptCall}
            >
              📞 Aceitar
            </button>
            <button 
              className="call-button reject"
              onClick={handleRejectCall}
            >
              ❌ Recusar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Call interface (when in call)
  if (isInCall) {
    return (
      <div className="call-interface">
        <div className="call-header">
          <div className="call-user-info">
            <div className="user-avatar">
              {(otherUser?.photoURL || otherUser?.profilePictureURL) ? (
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
                  display: (otherUser?.photoURL || otherUser?.profilePictureURL) ? 'none' : 'flex' 
                }}
              >
                {(otherUser?.displayName || otherUser?.name || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="user-details">
              <h3>
                {callStatus === 'calling' && 'Ligando...'}
                {callStatus === 'ringing' && 'Chamando...'}
                {callStatus === 'connected' && 'Conectado'}
                {callStatus === 'connecting' && 'Conectando...'}
              </h3>
              <p>{otherUser?.displayName || otherUser?.name || 'Usuário'}</p>
            </div>
          </div>
          <button className="close-button" onClick={handleEndCall}>
            ✕
          </button>
        </div>

        <div className="video-container">
          {/* Remote video */}
          <div className="remote-video">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="video-element"
            />
            {!isCallActive && (
              <div className="video-placeholder">
                <div className="avatar">👤</div>
                <p>Aguardando conexão...</p>
              </div>
            )}
          </div>

          {/* Local video - only show for video calls */}
          {callType === 'video' && (
            <div className="local-video">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted={true}
                className="video-element small"
              />
              {isScreenSharing && (
                <div className="screen-share-indicator">
                  📺 Compartilhando tela
                </div>
              )}
            </div>
          )}
        </div>

        <div className="call-controls">
          <button
            className={`control-button ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {callType === 'video' && (
            <button
              className={`control-button ${!isVideoEnabled ? 'disabled' : ''}`}
              onClick={toggleVideo}
              title={isVideoEnabled ? 'Desligar câmera' : 'Ligar câmera'}
            >
              {isVideoEnabled ? '📹' : '📷'}
            </button>
          )}

          {callType === 'video' && (
            <button
              className={`control-button ${isScreenSharing ? 'active' : ''}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
            >
              {isScreenSharing ? '🖥️' : '📺'}
            </button>
          )}

          <button
            className="control-button end-call"
            onClick={handleEndCall}
            title="Encerrar chamada"
          >
            📞
          </button>
        </div>
      </div>
    );
  }

  // Call button (when not in call)
  return (
    <div className="call-interface">
      <div className="call-header">
        <h3>Erro</h3>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="error-content">
        <p>Algo deu errado. Tente novamente.</p>
        <button onClick={handleBackToOptions} className="retry-button">
          Tentar Novamente
        </button>
      </div>
    </div>
  );
};

export default CallInterface;
