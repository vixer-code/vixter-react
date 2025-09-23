import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, database } from '../../config/firebase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [usernameCache] = useState(new Map());
  const [emailVerified, setEmailVerified] = useState(false);

  // Helper function to check if input is email or username
  const isEmail = useCallback((input) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  }, []);

  // Function to find email by username (with robust fallback)
  const findEmailByUsername = useCallback(async (username) => {
    try {
      console.log('[findEmailByUsername] Searching for username:', username);
      
      if (!database) {
        throw new Error('Database not initialized');
      }

      // Check cache first
      if (usernameCache.has(username.toLowerCase())) {
        console.log('[findEmailByUsername] Found in cache:', username);
        return usernameCache.get(username.toLowerCase());
      }

      // Method 1: Try optimized query (exact)
      try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
          const users = snapshot.val();
          // Find user by username
          const userId = Object.keys(users).find(key => 
            users[key].username === username || users[key].username === username.toLowerCase()
          );
          
          if (userId) {
            const user = users[userId];
            
            // Save to cache
            usernameCache.set(username.toLowerCase(), user.email);
            
            console.log('[findEmailByUsername] Found user (exact) with username:', username, 'email:', user.email);
            return user.email;
          }
        }
      } catch (queryError) {
        console.warn('[findEmailByUsername] Query method failed, trying fallback:', queryError.message);
      }

      console.log('[findEmailByUsername] Username not found:', username);
      return null;
      
    } catch (error) {
      console.error('[findEmailByUsername] Error searching for username:', error);
      
      // If it's a permission error, give a more friendly message
      if (error.message && error.message.includes('permission_denied')) {
        console.error('[findEmailByUsername] Permission denied - suggest using email instead');
        throw new Error('Não foi possível verificar o username. Por favor, tente fazer login com seu email.');
      }
      
      throw error;
    }
  }, [usernameCache]);

  // Create user profile in database
  const createUserProfile = useCallback(async (uid, name, email) => {
    console.log('[createUserProfile] uid:', uid, 'name:', name, 'email:', email);
  
    try {
      const userRef = ref(database, `users/${uid}`);
      console.log('[createUserProfile] userRef:', userRef.toString(), '— About to call set');
  
      await set(userRef, {
        name,
        email,
        createdAt: Date.now(),
        profileComplete: false,
        kyc: false,
        kycState: 'PENDING_UPLOAD'
      });
  
      console.log('[createUserProfile] set successful!');
    } catch (error) {
      console.error('[createUserProfile] Error creating user profile:', error);
      throw error;
    }
  }, []);

  // Login function with username/email support
  const login = useCallback(async (emailOrUsername, password) => {
    try {
      let email = emailOrUsername.trim();
      
      // Check if input is username instead of email
      if (!isEmail(email)) {
        console.log('[login] Input appears to be username, searching for email...');
        
        try {
          const foundEmail = await findEmailByUsername(email);
          
          if (!foundEmail) {
            throw new Error('Username não encontrado. Verifique se o username está correto ou tente usar seu email.');
          }
          
          email = foundEmail;
          console.log('[login] Found email for username:', email);
          
        } catch (usernameError) {
          // If username lookup failed, suggest using email
          if (usernameError.message.includes('Username não encontrado')) {
            throw usernameError;
          } else {
            throw new Error('Erro ao verificar username. Tente fazer login com seu email: ' + usernameError.message);
          }
        }
      }
      
      console.log('[login] Attempting login with email:', email);
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Save to cache for next time (if it was a username login)
      if (!isEmail(emailOrUsername.trim()) && result.user) {
        usernameCache.set(emailOrUsername.toLowerCase(), email);
      }
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle custom username/email errors
      if (error.message.includes('Username não encontrado') || 
          error.message.includes('Erro ao verificar username')) {
        throw error;
      }
      
      // Handle Firebase auth errors
      switch (error.code) {
        case 'auth/user-not-found':
          throw new Error('Email não encontrado. Verifique suas credenciais.');
        case 'auth/wrong-password':
          throw new Error('Senha incorreta. Tente novamente.');
        case 'auth/invalid-email':
          throw new Error('Email inválido. Por favor, digite um email válido.');
        case 'auth/user-disabled':
          throw new Error('Esta conta foi desabilitada. Entre em contato com o suporte.');
        case 'auth/too-many-requests':
          throw new Error('Muitas tentativas de login. Tente novamente mais tarde.');
        case 'auth/network-request-failed':
          throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
        default:
          throw error;
      }
    }
  }, [findEmailByUsername, isEmail, usernameCache]);

  // Register function with profile creation
  const register = useCallback(async (name, email, password) => {
    try {
      console.log('[register] Received name:', name, 'email:', email);
      
      // Create user in Firebase Auth
      console.log('[register] About to createUserWithEmailAndPassword...');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log('[register] Finished createUserWithEmailAndPassword. result:', result);
  
      const user = result.user;
      console.log('[register] Got user:', user ? user.uid : null);
  
      // Set display name
      console.log('[register] Updating displayName in Auth profile...');
      await updateProfile(user, { displayName: name });
      console.log('[register] displayName update done');
  
      // Create user profile in database
      console.log('[register] Calling createUserProfile...');
      await createUserProfile(user.uid, name, email);
      console.log('[register] createUserProfile finished successfully!');
  
      return result;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }, [createUserProfile]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setToken(null);
      
      // Clear username cache
      usernameCache.clear();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [usernameCache]);

  // Reset password function with better error handling
  const resetPassword = useCallback(async (email) => {
    try {
      console.log('[resetPassword] Sending password reset email to:', email);
      await sendPasswordResetEmail(auth, email);
      console.log('[resetPassword] Password reset email sent successfully');
      return true;
    } catch (error) {
      console.error('[resetPassword] Error sending password reset email:', error);
      
      // Re-throw with more specific error information
      switch (error.code) {
        case 'auth/user-not-found':
          throw new Error('Não existe uma conta com este email.');
        case 'auth/invalid-email':
          throw new Error('Email inválido.');
        case 'auth/too-many-requests':
          throw new Error('Muitas tentativas de reset. Tente novamente mais tarde.');
        default:
          throw error;
      }
    }
  }, []);

  // Force refresh email verification status
  const refreshEmailVerification = useCallback(async () => {
    if (currentUser) {
      try {
        console.log('Refreshing email verification status...');
        console.log('Before reload - emailVerified:', currentUser.emailVerified);
        
        // Force reload the user to get latest data from Firebase Auth
        await currentUser.reload();
        
        // Wait a bit for the changes to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reload again to ensure we have the latest data
        await currentUser.reload();
        
        console.log('After reload - emailVerified:', currentUser.emailVerified);
        setEmailVerified(currentUser.emailVerified);
        
        return currentUser.emailVerified;
      } catch (error) {
        console.error('Error refreshing email verification:', error);
        return false;
      }
    }
    return false;
  }, [currentUser]);

  // Get current user token
  const getIdToken = useCallback(async () => {
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        setToken(token);
        return token;
      } catch (error) {
        console.error('Error getting token:', error);
        throw error;
      }
    }
    return null;
  }, [currentUser]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      setCurrentUser(user);
      
      if (user) {
        try {
          const token = await user.getIdToken();
          setToken(token);
          setEmailVerified(user.emailVerified);
          
          // Force refresh the user to get updated emailVerified status
          await user.reload();
          setEmailVerified(user.emailVerified);
        } catch (error) {
          console.error('Error getting token on auth change:', error);
        }
      } else {
        setToken(null);
        setEmailVerified(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(() => ({
    currentUser,
    token,
    emailVerified,
    login,
    register,
    logout,
    resetPassword,
    refreshEmailVerification,
    getIdToken,
    loading
  }), [currentUser, token, emailVerified, login, register, logout, resetPassword, refreshEmailVerification, getIdToken, loading]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};