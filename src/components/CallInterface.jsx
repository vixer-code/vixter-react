import React, { useEffect, useState, useCallback } from 'react';
import { useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import './CallInterface.css';

/**
 * Component to initialize RealtimeKit meeting and render RtkMeeting
 * Now integrated into the messaging box (right side)
 */
const RealtimeKitMeetingWrapper = ({ authToken, conversation, otherUser, onClose, isNewMeeting }) => {
  const { currentUser } = useAuth();
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);

  // Send "Chamada realizada" message when meeting is created (only for new meetings)
  const sendCallMessage = useCallback(async () => {
    if (!isNewMeeting || !conversation?.id || !currentUser) return;
    
    try {
      console.log('📝 Sending "Chamada realizada" message...');
      const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
      
      await addDoc(messagesRef, {
        text: '📞 Chamada realizada',
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: serverTimestamp(),
        type: 'call',
        callMetadata: {
          initiatedBy: currentUser.uid,
          initiatedAt: new Date().toISOString(),
          participants: [currentUser.uid]
        }
      });
      
      console.log('✅ Call message sent successfully');
    } catch (error) {
      console.error('❌ Error sending call message:', error);
    }
  }, [isNewMeeting, conversation?.id, currentUser]);

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
        setHasJoined(true);
        
        // Send call message if this is a new meeting
        if (isNewMeeting) {
          sendCallMessage();
        }
      }).catch((error) => {
        console.error('❌ Error initializing RealtimeKit:', error);
        setInitError(error.message);
        setIsInitializing(false);
      });
    }
  }, [authToken, meeting, initMeeting, isInitializing, isNewMeeting, sendCallMessage]);

  // Show loading state
  if (isInitializing || !meeting) {
    return (
      <div className="call-interface-inline">
        <div className="call-header-inline">
          <div className="call-user-info">
            <div className="user-avatar-small">
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
                className="default-avatar-small"
                style={{ 
                  display: (otherUser?.photoURL || otherUser?.profilePictureURL) ? 'none' : 'flex' 
                }}
              >
                {(otherUser?.displayName || otherUser?.name || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="user-details-inline">
              <h4>Iniciando chamada...</h4>
              <p>{otherUser?.displayName || otherUser?.name || 'Usuário'}</p>
            </div>
          </div>
          <button className="close-button-inline" onClick={onClose}>✕</button>
        </div>
        <div className="meeting-container-inline">
          <div className="loading-placeholder">
            <div className="spinner">🔄</div>
            <p>Conectando...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (initError) {
    return (
      <div className="call-interface-inline">
        <div className="call-header-inline">
          <div className="call-user-info">
            <h4>Erro ao iniciar chamada</h4>
          </div>
          <button className="close-button-inline" onClick={onClose}>✕</button>
        </div>
        <div className="meeting-container-inline">
          <div className="error-placeholder">
            <div className="error-icon">❌</div>
            <p>{initError}</p>
            <button onClick={onClose} className="close-error-btn">Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ Meeting object is ready, rendering RtkMeeting component');
  console.log('🔍 Meeting object:', meeting);
  console.log('🔍 Meeting keys:', Object.keys(meeting));

  // Render the official RtkMeeting component inline (in the messaging box)
  return (
    <div className="call-interface-inline">
      <div className="call-header-inline">
        <div className="call-user-info">
          <div className="user-avatar-small">
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
              className="default-avatar-small"
              style={{ 
                display: (otherUser?.photoURL || otherUser?.profilePictureURL) ? 'none' : 'flex' 
              }}
            >
              {(otherUser?.displayName || otherUser?.name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="user-details-inline">
            <h4>Chamada em andamento</h4>
            <p>{otherUser?.displayName || otherUser?.name || 'Usuário'}</p>
          </div>
        </div>
        <button className="close-button-inline" onClick={onClose} title="Encerrar chamada">
          ✕
        </button>
      </div>
      <div className="meeting-container-inline">
        <RtkMeeting 
          meeting={meeting}
          mode="fill"
          showSetupScreen={false}
          leaveOnUnmount={true}
          loadConfigFromPreset={true}
        />
      </div>
    </div>
  );
};

/**
 * Main CallInterface component
 */
const CallInterface = ({ conversation, onClose }) => {
  const { currentUser } = useAuth();
  const { activeRooms, endCall } = useEnhancedMessaging();
  
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading immediately
  const [otherUser, setOtherUser] = useState(null);
  const [showMeeting, setShowMeeting] = useState(false);
  const [isNewMeeting, setIsNewMeeting] = useState(false);

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

  // Auto-start call when component mounts
  useEffect(() => {
    if (conversation && currentUser && !authToken) {
      getAuthToken();
    }
  }, [conversation, currentUser]);

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
      console.log('🔍 Is new meeting:', data.isNewMeeting);
      
      setAuthToken(data.token);
      setIsNewMeeting(data.isNewMeeting || false);
      setShowMeeting(true);
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      alert('Erro ao iniciar chamada: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveCall = () => {
    console.log('🔚 Leaving RealtimeKit call');
    
    // End call in context
    const roomId = existingRoom?.roomId || `call_${conversation.id}`;
    if (roomId && conversation?.id) {
      endCall(roomId, conversation.id);
    }
    
    // Reset state and return to messaging
    setAuthToken(null);
    setShowMeeting(false);
    setIsNewMeeting(false);
    
    // Don't close the CallInterface, just hide the meeting
    // User stays in the messaging view
    console.log('✅ Returned to messaging view');
  };

  // If we have a token and should show meeting, render the meeting wrapper inline
  if (showMeeting && authToken) {
    return (
      <RealtimeKitMeetingWrapper 
        authToken={authToken}
        conversation={conversation}
        otherUser={otherUser}
        onClose={handleLeaveCall}
        isNewMeeting={isNewMeeting}
      />
    );
  }

  // Show loading screen while connecting
  return (
    <div className="call-interface-inline call-connecting">
      <div className="call-header-inline">
        <div className="call-user-info">
          <div className="user-avatar-small">
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
              className="default-avatar-small"
              style={{ 
                display: (otherUser?.photoURL || otherUser?.profilePictureURL) ? 'none' : 'flex' 
              }}
            >
              {(otherUser?.displayName || otherUser?.name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="user-details-inline">
            <h4>Conectando...</h4>
            <p>{otherUser?.displayName || otherUser?.name || 'Usuário'}</p>
          </div>
        </div>
        <button className="close-button-inline" onClick={onClose}>
          ✕
        </button>
      </div>
      
      <div className="call-connecting-content">
        <div className="call-avatar-large">
          {(otherUser?.photoURL || otherUser?.profilePictureURL) ? (
            <img 
              src={otherUser.photoURL || otherUser.profilePictureURL} 
              alt={otherUser.displayName || otherUser.name}
            />
          ) : (
            <div className="default-avatar-large">
              {(otherUser?.displayName || otherUser?.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="spinner-large">🔄</div>
        <h3>Iniciando chamada com {otherUser?.displayName || otherUser?.name || 'usuário'}...</h3>
        <p className="connecting-message">Aguarde um momento</p>
      </div>
    </div>
  );
};

export default CallInterface;
