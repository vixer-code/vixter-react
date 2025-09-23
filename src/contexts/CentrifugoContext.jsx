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
        debug: true, // Enable debug mode
      });

      // Connection event handlers
      centrifugeInstance.on('connecting', (ctx) => {
        setIsConnecting(true);
      });

      centrifugeInstance.on('connected', (ctx) => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
      });

      centrifugeInstance.on('disconnected', (ctx) => {
        setIsConnected(false);
        setIsConnecting(false);
        
        // Clear subscriptions when disconnected
        subscriptionsRef.current.clear();
        setSubscriptions(new Map());
      });

      centrifugeInstance.on('error', (ctx) => {
        setConnectionError(ctx.message || 'Connection error');
        setIsConnecting(false);
        setIsConnected(false);
      });

      centrifugeInstance.on('token', (ctx) => {
        // Token refreshed
      });

      // Connect
      centrifugeInstance.connect();
      
      centrifugeRef.current = centrifugeInstance;
      setCentrifuge(centrifugeInstance);

      // Add connection timeout - increased to 30 seconds for slow networks
      const connectionTimeout = setTimeout(() => {
        if (!isConnected && isConnecting) {
          setConnectionError('Connection timeout - please check your internet connection');
          setIsConnecting(false);
          setIsConnected(false);
          // Try to reconnect after a delay
          setTimeout(() => {
            setConnectionError(null);
            initializeCentrifugo();
          }, 5000);
        }
      }, 30000); // 30 second timeout

      // Clear timeout when connected
      centrifugeInstance.on('connected', () => {
        clearTimeout(connectionTimeout);
      });

    } catch (error) {
      setConnectionError(error.message);
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [currentUser?.uid, getToken, isConnected, isConnecting]);

  // Subscribe to a channel
  const subscribe = useCallback((channel, handlers = {}) => {
    if (!centrifugeRef.current) {
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
      if (handlers.onMessage) {
        handlers.onMessage(ctx.data, ctx);
      }
    });

    subscription.on('subscribing', (ctx) => {
      if (handlers.onSubscribing) {
        handlers.onSubscribing(ctx);
      }
    });

    subscription.on('subscribed', (ctx) => {
      if (handlers.onSubscribed) {
        handlers.onSubscribed(ctx);
      }
    });

    subscription.on('unsubscribed', (ctx) => {
      if (handlers.onUnsubscribed) {
        handlers.onUnsubscribed(ctx);
      }
    });

    subscription.on('error', (ctx) => {
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
    }
  }, []);

  // Unsubscribe from all channels
  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.forEach((subscription, channel) => {
      subscription.unsubscribe();
    });
    subscriptionsRef.current.clear();
    setSubscriptions(new Map());
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
        const errorText = await response.text();
        throw new Error(`Failed to publish message: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
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
