import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';

const DebugMessaging = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const { isConnected, isConnecting, connectionError } = useCentrifugo();
  const { loading: messagingLoading, conversations } = useEnhancedMessaging();

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4 style={{ margin: '0 0 10px 0' }}>Debug Info</h4>
      
      <div><strong>Auth Loading:</strong> {authLoading ? 'Yes' : 'No'}</div>
      <div><strong>User:</strong> {currentUser ? currentUser.uid.substring(0, 8) + '...' : 'None'}</div>
      
      <div><strong>Centrifugo:</strong></div>
      <div style={{ marginLeft: '10px' }}>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
        <div>Connecting: {isConnecting ? 'Yes' : 'No'}</div>
        <div>Error: {connectionError || 'None'}</div>
      </div>
      
      <div><strong>Messaging:</strong></div>
      <div style={{ marginLeft: '10px' }}>
        <div>Loading: {messagingLoading ? 'Yes' : 'No'}</div>
        <div>Conversations: {conversations.length}</div>
      </div>
    </div>
  );
};

export default DebugMessaging;
