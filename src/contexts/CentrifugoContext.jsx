import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Centrifuge } from 'centrifuge';
import { useAuth } from './AuthContext';

const CentrifugoContext = createContext({});

export const useCentrifugo = () => {
  const context = useContext(CentrifugoContext);
  if (!context) {
    throw new Error('useCentrifugo must be used within a CentrifugoProvider');
  }
  return context;
};

export const CentrifugoProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [centrifuge, setCentrifuge] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [subscriptions, setSubscriptions] = useState(new Map());
  const [connectionError, setConnectionError] = useState(null);
  
  // Refs to store subscriptions and avoid stale closures
  const subscriptionsRef = useRef(new Map());
  const centrifugeRef = useRef(null);

  // Centrifugo configuration
  const CENTRIFUGO_WS_URL = 'wss://vixter-centrifugo.fly.dev/connection/websocket';

  // Generate token for authentication
  const getToken = useCallback(async () => {
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch('https://vixter-react-llyd.vercel.app/api/centrifugo/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser.uid })
      });

      if (!response.ok) {
        throw new Error('Failed to get Centrifugo token');
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting Centrifugo token:', error);
      throw error;
    }
  }, [currentUser?.uid]);

  // Initialize Centrifugo connection
  const initializeCentrifugo = useCallback(async () => {
    if (!currentUser?.uid || centrifugeRef.current) {
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionError(null);

      // Add timeout for token generation
      const tokenPromise = getToken();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token generation timeout')), 10000)
      );
      
      const token = await Promise.race([tokenPromise, timeoutPromise]);

      const centrifugeInstance = new Centrifuge(CENTRIFUGO_WS_URL, {
        token: token,
        // Token refresh interval (in milliseconds)
        tokenRefreshInterval: 30 * 60 * 1000, // 30 minutes
        getToken: getToken,
      });

      // Connection event handlers
      centrifugeInstance.on('connecting', (ctx) => {
        console.log('Centrifugo connecting:', ctx.code, ctx.reason);
        setIsConnecting(true);
      });

      centrifugeInstance.on('connected', (ctx) => {
        console.log('Centrifugo connected over:', ctx.transport);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
      });

      centrifugeInstance.on('disconnected', (ctx) => {
        console.log('Centrifugo disconnected:', ctx.code, ctx.reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Clear subscriptions when disconnected
        subscriptionsRef.current.clear();
        setSubscriptions(new Map());
      });

      centrifugeInstance.on('error', (ctx) => {
        console.error('Centrifugo error:', ctx);
        setConnectionError(ctx.message || 'Connection error');
        setIsConnecting(false);
        setIsConnected(false);
      });

      centrifugeInstance.on('token', (ctx) => {
        console.log('Centrifugo token refreshed');
      });

      // Connect
      centrifugeInstance.connect();
      
      centrifugeRef.current = centrifugeInstance;
      setCentrifuge(centrifugeInstance);

      // Add connection timeout
      setTimeout(() => {
        if (!isConnected && isConnecting) {
          console.warn('Centrifugo connection timeout');
          setConnectionError('Connection timeout');
          setIsConnecting(false);
          setIsConnected(false);
        }
      }, 15000); // 15 second timeout

    } catch (error) {
      console.error('Error initializing Centrifugo:', error);
      setConnectionError(error.message);
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [currentUser?.uid, getToken, isConnected, isConnecting]);

  // Subscribe to a channel
  const subscribe = useCallback((channel, handlers = {}) => {
    if (!centrifugeRef.current) {
      console.warn('Centrifugo not initialized');
      return null;
    }

    // Unsubscribe from existing subscription if it exists
    if (subscriptionsRef.current.has(channel)) {
      const existingSub = subscriptionsRef.current.get(channel);
      existingSub.unsubscribe();
      subscriptionsRef.current.delete(channel);
    }

    const subscription = centrifugeRef.current.newSubscription(channel);

    // Set up event handlers
    subscription.on('publication', (ctx) => {
      console.log('Received message on channel', channel, ':', ctx.data);
      if (handlers.onMessage) {
        handlers.onMessage(ctx.data, ctx);
      }
    });

    subscription.on('subscribing', (ctx) => {
      console.log('Subscribing to channel', channel, ':', ctx.code, ctx.reason);
      if (handlers.onSubscribing) {
        handlers.onSubscribing(ctx);
      }
    });

    subscription.on('subscribed', (ctx) => {
      console.log('Subscribed to channel', channel, ':', ctx);
      if (handlers.onSubscribed) {
        handlers.onSubscribed(ctx);
      }
    });

    subscription.on('unsubscribed', (ctx) => {
      console.log('Unsubscribed from channel', channel, ':', ctx.code, ctx.reason);
      if (handlers.onUnsubscribed) {
        handlers.onUnsubscribed(ctx);
      }
    });

    subscription.on('error', (ctx) => {
      console.error('Subscription error for channel', channel, ':', ctx);
      if (handlers.onError) {
        handlers.onError(ctx);
      }
    });

    // Subscribe
    subscription.subscribe();

    // Store subscription
    subscriptionsRef.current.set(channel, subscription);
    setSubscriptions(new Map(subscriptionsRef.current));

    return subscription;
  }, []);

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channel) => {
    if (subscriptionsRef.current.has(channel)) {
      const subscription = subscriptionsRef.current.get(channel);
      subscription.unsubscribe();
      subscriptionsRef.current.delete(channel);
      setSubscriptions(new Map(subscriptionsRef.current));
      console.log('Unsubscribed from channel:', channel);
    }
  }, []);

  // Unsubscribe from all channels
  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.forEach((subscription, channel) => {
      subscription.unsubscribe();
    });
    subscriptionsRef.current.clear();
    setSubscriptions(new Map());
    console.log('Unsubscribed from all channels');
  }, []);

  // Publish message to a channel (via backend API)
  const publish = useCallback(async (channel, data) => {
    try {
      const response = await fetch('https://vixter-react-llyd.vercel.app/api/centrifugo/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel, data })
      });

      if (!response.ok) {
        throw new Error('Failed to publish message');
      }

      return await response.json();
    } catch (error) {
      console.error('Error publishing message:', error);
      throw error;
    }
  }, []);

  // Initialize connection when user is authenticated
  useEffect(() => {
    if (currentUser?.uid && !centrifugeRef.current) {
      initializeCentrifugo();
    }
  }, [currentUser?.uid, initializeCentrifugo]);

  // Cleanup on unmount or user change
  useEffect(() => {
    return () => {
      if (centrifugeRef.current) {
        unsubscribeAll();
        centrifugeRef.current.disconnect();
        centrifugeRef.current = null;
        setCentrifuge(null);
        setIsConnected(false);
        setIsConnecting(false);
      }
    };
  }, [unsubscribeAll]);

  // Cleanup when user changes
  useEffect(() => {
    if (!currentUser?.uid && centrifugeRef.current) {
      unsubscribeAll();
      centrifugeRef.current.disconnect();
      centrifugeRef.current = null;
      setCentrifuge(null);
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [currentUser?.uid, unsubscribeAll]);

  const value = {
    // State
    isConnected,
    isConnecting,
    connectionError,
    subscriptions: Array.from(subscriptions.keys()),
    
    // Actions
    subscribe,
    unsubscribe,
    unsubscribeAll,
    publish,
    
    // Utils
    getToken,
  };

  return (
    <CentrifugoContext.Provider value={value}>
      {children}
    </CentrifugoContext.Provider>
  );
};

export default CentrifugoProvider;
