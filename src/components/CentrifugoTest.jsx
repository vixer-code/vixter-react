import React, { useState, useEffect } from 'react';
import { useCentrifugo } from '../contexts/CentrifugoContext';

const CentrifugoTest = () => {
  const { 
    isConnected, 
    isConnecting, 
    connectionError, 
    subscribe, 
    unsubscribe, 
    publish,
    subscriptions 
  } = useCentrifugo();
  
  const [testChannel, setTestChannel] = useState('test-channel');
  const [testMessage, setTestMessage] = useState('Hello from Centrifugo!');
  const [receivedMessages, setReceivedMessages] = useState([]);

  // Subscribe to test channel
  useEffect(() => {
    if (!isConnected || !testChannel) return;

    console.log('Subscribing to test channel:', testChannel);
    
    const subscription = subscribe(testChannel, {
      onMessage: (data, ctx) => {
        console.log('Received message:', data);
        setReceivedMessages(prev => [...prev, {
          timestamp: new Date().toLocaleTimeString(),
          data: data
        }]);
      },
      onSubscribed: (ctx) => {
        console.log('Successfully subscribed to test channel');
      },
      onError: (ctx) => {
        console.error('Subscription error:', ctx);
      }
    });

    return () => {
      console.log('Unsubscribing from test channel');
      unsubscribe(testChannel);
    };
  }, [isConnected, testChannel, subscribe, unsubscribe]);

  const handlePublish = async () => {
    if (!testMessage.trim()) return;

    try {
      await publish(testChannel, {
        type: 'test_message',
        content: testMessage,
        timestamp: Date.now(),
        sender: 'test-user'
      });
      console.log('Message published successfully');
    } catch (error) {
      console.error('Error publishing message:', error);
    }
  };

  const clearMessages = () => {
    setReceivedMessages([]);
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      margin: '20px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3>Centrifugo Connection Test</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> 
        <span style={{ 
          color: isConnected ? 'green' : isConnecting ? 'orange' : 'red',
          marginLeft: '10px'
        }}>
          {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
        </span>
      </div>

      {connectionError && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          <strong>Error:</strong> {connectionError}
        </div>
      )}

      <div style={{ marginBottom: '10px' }}>
        <strong>Active Subscriptions:</strong> {subscriptions.length}
        {subscriptions.length > 0 && (
          <ul>
            {subscriptions.map(channel => (
              <li key={channel}>{channel}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>
          Test Channel:
          <input
            type="text"
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>
          Test Message:
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px', width: '300px' }}
          />
        </label>
        <button 
          onClick={handlePublish}
          disabled={!isConnected || !testMessage.trim()}
          style={{ 
            marginLeft: '10px', 
            padding: '5px 10px',
            backgroundColor: isConnected ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'pointer' : 'not-allowed'
          }}
        >
          Publish Message
        </button>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Received Messages:</strong>
          <button 
            onClick={clearMessages}
            style={{ 
              padding: '5px 10px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>
        
        <div style={{ 
          maxHeight: '200px', 
          overflowY: 'auto', 
          border: '1px solid #ddd', 
          padding: '10px',
          marginTop: '10px',
          backgroundColor: 'white'
        }}>
          {receivedMessages.length === 0 ? (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              No messages received yet. Try publishing a message!
            </div>
          ) : (
            receivedMessages.map((msg, index) => (
              <div key={index} style={{ 
                marginBottom: '5px', 
                padding: '5px', 
                backgroundColor: '#f0f0f0',
                borderRadius: '4px'
              }}>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {msg.timestamp}
                </div>
                <div>
                  <strong>Type:</strong> {msg.data.type}
                </div>
                <div>
                  <strong>Content:</strong> {msg.data.content}
                </div>
                {msg.data.sender && (
                  <div>
                    <strong>Sender:</strong> {msg.data.sender}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CentrifugoTest;
