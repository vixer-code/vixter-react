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
        authToken,
        defaults: {
          audio: true,
          video: true,
        },
      }).then((m) => {
        console.log('✅ Meeting initialized, adding track handler');

        m.on('local-track-added', ({ track, sender }) => {
          console.log('📌 Track adicionada:', track?.kind, track?.label);

          // Verifica se é o compartilhamento de tela
          if (
            track.kind === 'video' &&
            track.label &&
            track.label.toLowerCase().includes('screen')
          ) {
            console.log('🎯 Ajustando bitrate do screen sharing');

            try {
              const params = sender.getParameters();
              if (!params.encodings) params.encodings = [{}];

              params.encodings[0] = {
                maxBitrate: 2_500_000, // ~2.5 Mbps
                maxFramerate: 30,
              };

              sender.setParameters(params).catch((err) => {
                console.error('Erro ao aplicar parâmetros na track:', err);
              });
            } catch (error) {
              console.error('Falha ao modificar bitrate da track:', error);
            }
          }
        });
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

const CloudflareRealtimeCall = ({ conversation, onClose }) => {
  const [authToken, setAuthToken] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const getAuthToken = async () => {
    if (!conversation) return;
    
    setIsLoading(true);
    try {
      const roomId = `call_${conversation.id}_${Date.now()}`;
      
      const response = await fetch(`https://vixter-react-llyd.vercel.app/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'current-user-id',
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
