import React, { useEffect } from 'react';
import { useRealtimeKitClient, RealtimeKitProvider } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { useAuth } from '../contexts/AuthContext';

const RealtimeKitCallProvider = ({ children, authToken }) => {
  const { currentUser } = useAuth();
  const [meeting, initMeeting] = useRealtimeKitClient();

  useEffect(() => {
    if (authToken && currentUser) {
      console.log('🚀 Initializing RealtimeKit meeting with authToken');
      
      initMeeting({
        authToken: authToken,
        defaults: {
          audio: true,
          video: {
            width: 1280,
            height: 720,
            frameRate: 30,
            maxBitrate: 2500
          },
          screen: {
            width: 1280,
            height: 720,
            framerate: 30,
            maxBitrate: 2500
          }
        },
      });
    }
  }, [authToken, currentUser, initMeeting]);

  if (!meeting) {
    return <div>Loading RealtimeKit...</div>;
  }

  return (
    <RealtimeKitProvider value={meeting} fallback={<div>Loading meeting...</div>}>
      {children}
    </RealtimeKitProvider>
  );
};

// Componente de exemplo usando RtkMeeting
const RealtimeKitCallInterface = ({ onClose }) => {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <RtkMeeting 
        mode="fill" 
        meeting={null} // Será fornecido pelo RealtimeKitProvider
        onLeave={onClose}
      />
    </div>
  );
};

// Componente principal que combina tudo
const CloudflareRealtimeCall = ({ conversation, onClose }) => {
  const [authToken, setAuthToken] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Função para obter o token do backend
  const getAuthToken = async () => {
    if (!conversation) return;
    
    setIsLoading(true);
    try {
      const roomId = `call_${conversation.id}_${Date.now()}`;
      
      const response = await fetch(`https://vixter-react-llyd.vercel.app/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'current-user-id', // Será substituído pelo contexto de auth
          conversationId: conversation.id,
          role: 'participant'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get auth token');
      }

      const { token } = await response.json();
      setAuthToken(token);
    } catch (error) {
      console.error('Error getting auth token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getAuthToken();
  }, [conversation]);

  if (isLoading) {
    return <div>Loading call...</div>;
  }

  if (!authToken) {
    return <div>Failed to initialize call</div>;
  }

  return (
    <RealtimeKitCallProvider authToken={authToken}>
      <RealtimeKitCallInterface onClose={onClose} />
    </RealtimeKitCallProvider>
  );
};

export default CloudflareRealtimeCall;
