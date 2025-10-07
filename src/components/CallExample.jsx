import React from 'react';
import CloudflareRealtimeCall from '../components/CloudflareRealtimeCall';

// Exemplo de uso do componente corrigido
const CallExample = () => {
  const [showCall, setShowCall] = React.useState(false);
  const [conversation, setConversation] = React.useState(null);

  const handleStartCall = () => {
    // Simular uma conversa
    const mockConversation = {
      id: 'conv_123',
      participants: ['user1', 'user2'],
      type: 'video'
    };
    
    setConversation(mockConversation);
    setShowCall(true);
  };

  const handleCloseCall = () => {
    setShowCall(false);
    setConversation(null);
  };

  return (
    <div>
      <h1>Exemplo de Chamada com RealtimeKit</h1>
      
      {!showCall ? (
        <button onClick={handleStartCall}>
          Iniciar Chamada
        </button>
      ) : (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1000 }}>
          <CloudflareRealtimeCall 
            conversation={conversation}
            onClose={handleCloseCall}
          />
        </div>
      )}
    </div>
  );
};

export default CallExample;
