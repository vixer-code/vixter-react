import React, { useEffect, useState } from 'react';
import useCall from '../hooks/useCall';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import './CallInterface.css';

const CallInterface = ({ conversation, onClose }) => {
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
    rejectCall 
  } = useEnhancedMessaging();

  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);

  // Handle incoming call from context
  useEffect(() => {
    if (incomingCall && incomingCall.conversationId === conversation?.id) {
      setIncomingCallData(incomingCall);
      setIsIncomingCall(true);
    }
  }, [incomingCall, conversation?.id]);

  const handleStartCall = async () => {
    if (!conversation) return;
    
    try {
      const otherUserId = Object.keys(conversation.participants || {}).find(
        id => id !== conversation.participants[id]
      );
      
      if (otherUserId) {
        await startCall(conversation.id, otherUserId);
      }
    } catch (error) {
      console.error('Error starting call:', error);
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
    onClose?.();
  };

  // Incoming call modal
  if (isIncomingCall) {
    return (
      <div className="call-modal-overlay">
        <div className="call-modal incoming-call">
          <div className="call-header">
            <h3>Chamada recebida</h3>
            <p>de {conversation?.participants?.[incomingCallData?.from]?.name || 'Usuário'}</p>
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

  // Call interface
  if (isInCall) {
    return (
      <div className="call-interface">
        <div className="call-header">
          <h3>
            {callStatus === 'calling' && 'Ligando...'}
            {callStatus === 'ringing' && 'Chamando...'}
            {callStatus === 'connected' && 'Conectado'}
            {callStatus === 'connecting' && 'Conectando...'}
          </h3>
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

          {/* Local video */}
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
        </div>

        <div className="call-controls">
          <button
            className={`control-button ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          <button
            className={`control-button ${!isVideoEnabled ? 'disabled' : ''}`}
            onClick={toggleVideo}
            title={isVideoEnabled ? 'Desligar câmera' : 'Ligar câmera'}
          >
            {isVideoEnabled ? '📹' : '📷'}
          </button>

          <button
            className={`control-button ${isScreenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
          >
            {isScreenSharing ? '🖥️' : '📺'}
          </button>

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
      <button
        className="start-call-button"
        onClick={handleStartCall}
        title="Iniciar chamada"
      >
        📞 Ligar
      </button>
    </div>
  );
};

export default CallInterface;
