import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import MessagingTest from '../components/MessagingTest';
import EnhancedMessages from './EnhancedMessages';

const MessagingTestPage = () => {
  const { currentUser } = useAuth();
  const { isConnected, isConnecting } = useCentrifugo();
  const { conversations, isOnline, offlineMessages } = useEnhancedMessaging();

  if (!currentUser) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Please log in to test messaging</h2>
        <p>You need to be authenticated to use the messaging system.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Messaging System Test</h1>
      
      {/* System Status */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #dee2e6'
      }}>
        <h3>System Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>User:</strong> {currentUser.email || currentUser.uid}
          </div>
          <div>
            <strong>Centrifugo:</strong> 
            <span style={{ color: isConnected ? 'green' : isConnecting ? 'orange' : 'red', marginLeft: '8px' }}>
              {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          <div>
            <strong>Network:</strong> 
            <span style={{ color: isOnline ? 'green' : 'red', marginLeft: '8px' }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div>
            <strong>Conversations:</strong> {conversations.length}
          </div>
          <div>
            <strong>Offline Messages:</strong> {offlineMessages.length}
          </div>
        </div>
      </div>

      {/* Test Components */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3>Test Controls</h3>
          <MessagingTest />
        </div>
        
        <div>
          <h3>Enhanced Messages Interface</h3>
          <div style={{ height: '600px', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
            <EnhancedMessages />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#e7f3ff', 
        borderRadius: '8px',
        border: '1px solid #b3d9ff'
      }}>
        <h3>How to Test</h3>
        <ol>
          <li><strong>Check Connection:</strong> Ensure Centrifugo shows "Connected" status</li>
          <li><strong>Start Conversation:</strong> Click "Start Test Conversation" or use the user selector</li>
          <li><strong>Send Messages:</strong> Type a message and click "Send to Chat"</li>
          <li><strong>Test Offline:</strong> Disconnect internet and send messages (they'll be queued)</li>
          <li><strong>Test Real-time:</strong> Open another browser tab and send messages between them</li>
          <li><strong>Test Channels:</strong> Use the "Test Channel Publishing" section</li>
        </ol>
        
        <h4>Expected Behavior:</h4>
        <ul>
          <li>Messages should appear instantly in the chat interface</li>
          <li>Offline messages should be queued and sent when back online</li>
          <li>Real-time updates should work between different browser tabs</li>
          <li>Message history should be stored in Firebase</li>
          <li>Typing indicators should work (if implemented)</li>
        </ul>
      </div>
    </div>
  );
};

export default MessagingTestPage;
