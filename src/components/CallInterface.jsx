import React, { useEffect, useState } from 'react';
import { useRealtimeKitClient, RealtimeKitProvider } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import '@cloudflare/realtimekit-react-ui/dist/index.css';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useAuth } from '../contexts/AuthContext';
import './CallInterface.css';

/**
 * Component to initialize RealtimeKit meeting and render RtkMeeting
 */
const RealtimeKitMeetingWrapper = ({ authToken, conversation, onClose }) => {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    if (authToken && !meeting && !isInitializing) {
      setIsInitializing(true);
      console.log('🚀 Initializing RealtimeKit meeting with authToken');
      console.log('🔑 Token length:', authToken.length);
      console.log('🔑 Token preview:', authToken.substring(0, 50) + '...');
      
      initMeeting({
        authToken: authToken,
        defaults: {
          audio: true,
          video: true,
        },
      }).then(() => {
        console.log('✅ RealtimeKit meeting initialized successfully');
        setIsInitializing(false);
      }).catch((error) => {
        console.error('❌ Error initializing RealtimeKit:', error);
        setInitError(error.message);
        setIsInitializing(false);
      });
    }
  }, [authToken, meeting, initMeeting, isInitializing]);

  // Show loading state
  if (isInitializing || !meeting) {
    return (
      <div className="call-interface call-active">
        <div className="call-header">
          <h3>Iniciando chamada...</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="video-container">
          <div className="video-placeholder">
            <div className="spinner">🔄</div>
            <p>Conectando ao RealtimeKit...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (initError) {
    return (
      <div className="call-interface call-active">
        <div className="call-header">
          <h3>Erro ao iniciar chamada</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="video-container">
          <div className="video-placeholder">
            <div className="error">❌</div>
            <p>{initError}</p>
            <button onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ Meeting object is ready, rendering RtkMeeting component');
  console.log('🔍 Meeting object:', meeting);
  console.log('🔍 Meeting keys:', Object.keys(meeting));

  // Render the official RtkMeeting component
  return (
    <RealtimeKitProvider value={meeting}>
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        zIndex: 9999,
        backgroundColor: '#000'
      }}>
        <RtkMeeting 
          mode="fill"
          onLeave={onClose}
        />
      </div>
    </RealtimeKitProvider>
  );
};

/**
 * Main CallInterface component
 */
const CallInterface = ({ conversation, onClose }) => {
  const { currentUser } = useAuth();
  const { activeRooms, endCall } = useEnhancedMessaging();
  
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [showMeeting, setShowMeeting] = useState(false);

  // Check if there's an active room for this conversation
  const existingRoom = activeRooms[conversation?.id];

  // Get other participant
  const getOtherParticipant = () => {
    if (!conversation?.participants || !currentUser?.uid) return null;
    const participantIds = Object.keys(conversation.participants);
    const otherId = participantIds.find(id => id !== currentUser.uid);
    return otherId;
  };

  // Load other user data
  useEffect(() => {
    if (conversation?.participants) {
      const otherId = getOtherParticipant();
      if (otherId) {
        const participantData = conversation.participants[otherId];
        if (participantData && typeof participantData === 'object') {
          setOtherUser(participantData);
        }
      }
    }
  }, [conversation]);

  // Get auth token from backend
  const getAuthToken = async () => {
    if (!conversation) {
      console.error('No conversation provided');
      return;
    }

    setIsLoading(true);
    try {
      const roomId = `call_${conversation.id}`;
      const otherUserId = getOtherParticipant();
      
      console.log('🔑 Getting RealtimeKit token for room:', roomId);
      console.log('🔑 User ID:', currentUser.uid);
      console.log('🔑 User accountType:', currentUser.accountType);
      console.log('🔑 Conversation ID:', conversation.id);

      // Get user account type with fallback
      const userAccountType = currentUser.accountType || currentUser.type || 'client';
      
      const response = await fetch(`https://vixter-react-llyd.vercel.app/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          conversationId: conversation.id,
          role: 'participant',
          accountType: userAccountType,
          username: currentUser.displayName || currentUser.email || `User ${currentUser.uid.substring(0, 8)}`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get auth token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Auth token received successfully');
      console.log('🔍 Token length:', data.token?.length);
      console.log('🔍 Meeting ID:', data.meetingId);
      console.log('🔍 Is existing room:', data.existingRoom);
      
      setAuthToken(data.token);
      setShowMeeting(true);
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      alert('Erro ao iniciar chamada: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCall = () => {
    console.log('🏠 Starting RealtimeKit call...');
    getAuthToken();
  };

  const handleLeaveCall = () => {
    console.log('🔚 Leaving RealtimeKit call');
    
    // End call in context
    const roomId = existingRoom?.roomId || `call_${conversation.id}`;
    if (roomId && conversation?.id) {
      endCall(roomId, conversation.id);
    }
    
    // Reset state
    setAuthToken(null);
    setShowMeeting(false);
    onClose?.();
  };

  // If we have a token and should show meeting, render the meeting wrapper
  if (showMeeting && authToken) {
    return (
      <RealtimeKitMeetingWrapper 
        authToken={authToken}
        conversation={conversation}
        onClose={handleLeaveCall}
      />
    );
  }

  // Show call start screen
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
            <h3>{existingRoom ? 'Sala Disponível' : 'Iniciar Chamada'}</h3>
            <p>{otherUser?.displayName || otherUser?.name || 'Usuário'}</p>
          </div>
        </div>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>
      
      <div className="call-options-content">
        <button
          className="start-call-button"
          onClick={handleStartCall}
          disabled={isLoading}
          title={existingRoom ? 'Entrar na sala existente' : 'Criar nova sala de chamada'}
        >
          {isLoading ? '⏳ Carregando...' : (existingRoom ? '🚪 Entrar na Sala' : '📞 Iniciar Chamada')}
        </button>
      </div>
    </div>
  );
};

export default CallInterface;
