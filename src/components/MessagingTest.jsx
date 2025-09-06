import React, { useState } from 'react';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useAuth } from '../contexts/AuthContext';

const MessagingTest = () => {
  const { 
    conversations, 
    selectedConversation, 
    messages, 
    isOnline, 
    offlineMessages,
    sendMessage,
    startConversation 
  } = useEnhancedMessaging();
  
  const { isConnected, isConnecting, publish } = useCentrifugo();
  const { currentUser } = useAuth();
  
  const [testMessage, setTestMessage] = useState('');
  const [testChannel, setTestChannel] = useState('test-channel');

  const handleSendTestMessage = async () => {
    if (!testMessage.trim()) return;
    
    try {
      await sendMessage(testMessage);
      setTestMessage('');
    } catch (error) {
      console.error('Error sending test message:', error);
    }
  };

  const handlePublishToChannel = async () => {
    if (!testChannel.trim() || !testMessage.trim()) return;
    
    try {
      await publish(testChannel, {
        type: 'test_message',
        content: testMessage,
        timestamp: Date.now(),
        sender: currentUser?.uid || 'anonymous'
      });
      setTestMessage('');
    } catch (error) {
      console.error('Error publishing to channel:', error);
    }
  };

  const handleStartTestConversation = async () => {
    // This would normally be done through user selection
    // For testing, we'll just log the action
    console.log('Starting test conversation...');
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      margin: '20px',
      backgroundColor: '#f9f9f9',
      maxWidth: '600px'
    }}>
      <h3>Messaging System Test</h3>
      
      {/* Connection Status */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Connection Status</h4>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <strong>Centrifugo:</strong> 
            <span style={{ 
              color: isConnected ? 'green' : isConnecting ? 'orange' : 'red',
              marginLeft: '8px'
            }}>
              {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          <div>
            <strong>Network:</strong> 
            <span style={{ 
              color: isOnline ? 'green' : 'red',
              marginLeft: '8px'
            }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Offline Messages */}
      {offlineMessages.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
          <h4>Offline Messages ({offlineMessages.length})</h4>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            {offlineMessages.map((msg, index) => (
              <li key={index}>
                {msg.text} - {new Date(msg.timestamp).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conversations */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Conversations ({conversations.length})</h4>
        {conversations.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No conversations yet</p>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px' }}>
            {conversations.map((conv) => (
              <div key={conv.id} style={{ 
                padding: '8px', 
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                backgroundColor: selectedConversation?.id === conv.id ? '#e3f2fd' : 'transparent'
              }}>
                <div style={{ fontWeight: 'bold' }}>
                  Conversation {conv.id.substring(0, 8)}...
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  Last message: {conv.lastMessage || 'No messages'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999' }}>
                  {conv.lastMessageTime ? new Date(conv.lastMessageTime).toLocaleString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Conversation Messages */}
      {selectedConversation && (
        <div style={{ marginBottom: '20px' }}>
          <h4>Messages in Selected Conversation ({messages.length})</h4>
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto', 
            border: '1px solid #ddd', 
            padding: '10px',
            backgroundColor: 'white'
          }}>
            {messages.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No messages in this conversation</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={{ 
                  padding: '8px', 
                  borderBottom: '1px solid #eee',
                  backgroundColor: msg.senderId === currentUser?.uid ? '#e3f2fd' : '#f5f5f5'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {msg.senderId === currentUser?.uid ? 'You' : 'Other'}
                  </div>
                  <div>{msg.content}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    {new Date(msg.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Test Message Input */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Test Message</h4>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Enter test message..."
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button
            onClick={handleSendTestMessage}
            disabled={!testMessage.trim() || !selectedConversation}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedConversation ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedConversation ? 'pointer' : 'not-allowed'
            }}
          >
            Send to Chat
          </button>
        </div>
      </div>

      {/* Test Channel Publishing */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Test Channel Publishing</h4>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value)}
            placeholder="Channel name"
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Message content"
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button
            onClick={handlePublishToChannel}
            disabled={!testChannel.trim() || !testMessage.trim() || !isConnected}
            style={{
              padding: '8px 16px',
              backgroundColor: isConnected ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isConnected ? 'pointer' : 'not-allowed'
            }}
          >
            Publish
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h4>Quick Actions</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleStartTestConversation}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Start Test Conversation
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessagingTest;
