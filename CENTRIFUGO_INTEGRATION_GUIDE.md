# Centrifugo Integration Guide for Vixter React

This guide explains how to use Centrifugo as your messaging websocket solution in the vixter-react project.

## Overview

Centrifugo is now integrated as the real-time messaging layer for your React application. It provides:
- Real-time message delivery
- WebSocket connections with automatic reconnection
- Channel-based messaging
- JWT-based authentication
- Scalable message broadcasting

## Architecture

```
React Frontend (CentrifugoContext) 
    ↓ WebSocket Connection
Centrifugo Server (vixter-centrifugo.fly.dev)
    ↓ HTTP API
Backend API (/api/centrifugo/*)
    ↓ Database Operations
Firebase Realtime Database
```

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in your project root with:

```env
# Frontend (Vite)
VITE_CENTRIFUGO_URL=https://vixter-centrifugo.fly.dev
VITE_CENTRIFUGO_WS_URL=wss://vixter-centrifugo.fly.dev/connection/websocket

# Backend (Next.js)
CENTRIFUGO_URL=https://vixter-centrifugo.fly.dev
CENTRIFUGO_API_KEY=9f3c2b1e-7a4d-4c8e-9d2a-8e6f4a1c3b7e
CENTRIFUGO_TOKEN_SECRET=7c8e1f9a2b3d4e5f6a7b8c9d0e1f2a3b
CENTRIFUGO_WS_URL=wss://vixter-centrifugo.fly.dev/connection/websocket
```

### 2. Centrifugo Server Configuration

Your Centrifugo server is already deployed at `https://vixter-centrifugo.fly.dev` with the following secrets:

```powershell
flyctl secrets set `
  API_KEY="9f3c2b1e-7a4d-4c8e-9d2a-8e6f4a1c3b7e" `
  TOKEN_HMAC_SECRET_KEY="7c8e1f9a2b3d4e5f6a7b8c9d0e1f2a3b" `
  ALLOWED_ORIGINS="https://vixter-react.vercel.app,https://vixter-react-llyd.vercel.app" `
  HEALTH="true" `
  LOG_LEVEL="info" `
  ADMIN="false"
```

## Usage

### 1. Using Centrifugo Context

The `CentrifugoContext` provides real-time messaging capabilities:

```jsx
import { useCentrifugo } from './contexts/CentrifugoContext';

function MyComponent() {
  const { 
    isConnected, 
    isConnecting, 
    subscribe, 
    unsubscribe, 
    publish 
  } = useCentrifugo();

  // Subscribe to a channel
  useEffect(() => {
    const subscription = subscribe('my-channel', {
      onMessage: (data) => {
        console.log('Received:', data);
      },
      onSubscribed: () => {
        console.log('Subscribed successfully');
      }
    });

    return () => unsubscribe('my-channel');
  }, []);

  // Publish a message
  const sendMessage = async () => {
    await publish('my-channel', {
      type: 'message',
      content: 'Hello World!'
    });
  };
}
```

### 2. Messaging Integration

The `MessagingContext` is already integrated with Centrifugo:

- **Real-time message delivery**: Messages are sent via Firebase and broadcast via Centrifugo
- **Automatic channel subscription**: Each conversation has its own channel
- **Message synchronization**: Messages are kept in sync between Firebase and Centrifugo

### 3. Channel Naming Convention

- **Conversations**: `conversation:{conversationId}`
- **User presence**: `user:{userId}`
- **Service notifications**: `service:{serviceOrderId}`

## API Endpoints

### Generate Token
```
POST /api/centrifugo/token
Content-Type: application/json

{
  "userId": "user123"
}

Response:
{
  "token": "jwt_token_here",
  "user": "user123",
  "expires": 1234567890
}
```

### Publish Message
```
POST /api/centrifugo/publish
Content-Type: application/json

{
  "channel": "conversation:123",
  "data": {
    "type": "new_message",
    "message": { ... }
  }
}

Response:
{
  "success": true,
  "result": { ... }
}
```

## Message Types

The system supports various message types:

### 1. New Message
```json
{
  "type": "new_message",
  "message": {
    "id": "msg123",
    "senderId": "user123",
    "content": "Hello!",
    "timestamp": 1234567890
  },
  "conversationId": "conv123"
}
```

### 2. Message Updated
```json
{
  "type": "message_updated",
  "message": {
    "id": "msg123",
    "content": "Updated content"
  }
}
```

### 3. Message Deleted
```json
{
  "type": "message_deleted",
  "messageId": "msg123"
}
```

### 4. Typing Indicator
```json
{
  "type": "typing",
  "userId": "user123",
  "isTyping": true
}
```

## Testing

### 1. Test Connection
```javascript
// In browser console
const { useCentrifugo } = window.React.useContext;
const { isConnected, isConnecting } = useCentrifugo();
console.log('Connected:', isConnected, 'Connecting:', isConnecting);
```

### 2. Test Message Publishing
```javascript
// Using the API directly
fetch('/api/centrifugo/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: 'test-channel',
    data: { message: 'Test message' }
  })
});
```

### 3. Test Channel Subscription
```javascript
// In a React component
const { subscribe } = useCentrifugo();

useEffect(() => {
  const sub = subscribe('test-channel', {
    onMessage: (data) => console.log('Received:', data)
  });
  return () => unsubscribe('test-channel');
}, []);
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if Centrifugo server is running
   - Verify environment variables
   - Check browser console for errors

2. **Token Generation Failed**
   - Verify `CENTRIFUGO_TOKEN_SECRET` is set
   - Check backend API endpoint is working

3. **Messages Not Received**
   - Check if subscribed to correct channel
   - Verify message publishing is working
   - Check Centrifugo server logs

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('centrifugo-debug', 'true');
```

## Performance Considerations

1. **Connection Management**: Centrifugo automatically handles reconnections
2. **Channel Cleanup**: Unsubscribe from channels when components unmount
3. **Message Batching**: Consider batching multiple messages for better performance
4. **Rate Limiting**: Implement rate limiting for message publishing

## Security

1. **JWT Tokens**: All connections are authenticated with JWT tokens
2. **Channel Authorization**: Implement channel-level authorization if needed
3. **Message Validation**: Validate all incoming messages on the backend
4. **CORS**: Centrifugo is configured with proper CORS settings

## Monitoring

Monitor your Centrifugo server:
- **Health Check**: `https://vixter-centrifugo.fly.dev/health`
- **Metrics**: Available at `/metrics` endpoint
- **Logs**: Check Fly.io logs with `flyctl logs`

## Next Steps

1. Implement typing indicators
2. Add message read receipts
3. Implement user presence tracking
4. Add message reactions
5. Implement file sharing via Centrifugo
