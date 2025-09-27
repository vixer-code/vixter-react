import React, { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useUser } from '../../contexts/UserContext';
import { useEnhancedMessaging } from '../../contexts/EnhancedMessagingContext';
import './OnlineUsersList.css';

const OnlineUsersList = ({ onUserSelect, currentUser }) => {
  const { getUserById } = useUser();
  const { startConversation } = useEnhancedMessaging();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    console.log('🔄 Starting online users listener for user:', currentUser.uid);

    // Set timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('⏰ OnlineUsersList loading timeout - setting loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    // Listen to status changes
    const statusRef = ref(database, 'status');
    
    const unsubscribe = onValue(statusRef, async (snapshot) => {
      clearTimeout(loadingTimeout); // Clear timeout since we got data
      console.log('🌐 Status data received:', snapshot.exists());
      
      try {
        if (!snapshot.exists()) {
          console.log('📭 No status data available');
          setOnlineUsers([]);
          setLoading(false);
          return;
        }

        const statusData = snapshot.val();
        console.log('👥 Total users with status data:', Object.keys(statusData).length);
        console.log('📊 Status data structure:', statusData);
        
        const onlineUserIds = [];

        // Get all users with 'online' status and recent activity
        const now = Date.now();
        const OFFLINE_THRESHOLD = 3 * 60 * 1000; // 3 minutes in milliseconds (status updates every 2 minutes)
        
        Object.keys(statusData).forEach(userId => {
          const userStatus = statusData[userId];
          const lastChanged = userStatus?.last_changed;
          const isRecentActivity = lastChanged && (now - lastChanged) < OFFLINE_THRESHOLD;
          
          console.log(`👤 User ${userId.slice(0, 8)}:`, {
            fullUID: userId,
            status: userStatus?.state,
            lastChanged: lastChanged,
            timeSinceLastChange: lastChanged ? (now - lastChanged) / 1000 : 'unknown',
            isRecentActivity,
            isCurrentUser: userId === currentUser.uid
          });
          
          if (userId !== currentUser.uid && 
              userStatus?.state === 'online' && 
              isRecentActivity) {
            onlineUserIds.push(userId);
          }
        });

        console.log('✅ Found online users:', onlineUserIds.length);

        if (onlineUserIds.length === 0) {
          setOnlineUsers([]);
          setLoading(false);
          return;
        }

        // Load user data for online users
        const usersData = [];
        for (const userId of onlineUserIds) {
          try {
            console.log(`🔍 Fetching user data for UID: ${userId}`);
            const userData = await getUserById(userId);
            if (userData) {
              const combinedUserData = {
                ...userData,
                id: userId,
                lastSeen: statusData[userId].last_changed,
                status: statusData[userId].state
              };
              usersData.push(combinedUserData);
              console.log(`✅ Successfully loaded user:`, {
                uid: userId,
                displayName: userData.displayName || userData.name,
                status: statusData[userId].state,
                hasProfileData: !!userData.displayName || !!userData.name
              });
            } else {
              console.warn(`⚠️ No user data found in Firestore for UID: ${userId}`);
            }
          } catch (error) {
            console.error('❌ Error loading user data for', userId, ':', error);
          }
        }

        console.log('🎯 Final online users list:', usersData.length);
        setOnlineUsers(usersData);
        setLoading(false);
      } catch (error) {
        console.error('❌ Error processing status data:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('❌ Error listening to status changes:', error);
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    return () => {
      clearTimeout(loadingTimeout);
      off(statusRef, 'value', unsubscribe);
    };
  }, [currentUser?.uid, getUserById]);

  const handleStartConversation = async (user) => {
    try {
      const conversation = await startConversation(user.id);
      if (conversation) {
        onUserSelect(conversation);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const getAccountTypeBadge = (user) => {
    if (!user.accountType) return null;
    
    switch (user.accountType) {
      case 'provider':
        return <span className="account-badge provider">Vendedor</span>;
      case 'client':
        return <span className="account-badge client">Cliente</span>;
      case 'both':
        return <span className="account-badge both">Ambos</span>;
      default:
        return null;
    }
  };

  const getKycBadge = (user) => {
    if (user.kyc === true) {
      return <span className="kyc-badge">✓ Verificado</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="online-users-loading">
        <div className="spinner"></div>
        <p>Carregando usuários online...</p>
      </div>
    );
  }

  if (onlineUsers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <p>Nenhum usuário online no momento</p>
      </div>
    );
  }

  return (
    <div className="online-users-list">
      <div className="online-users-header">
        <h4>Usuários Online ({onlineUsers.length})</h4>
      </div>
      
      <div className="online-users-content">
        {onlineUsers.map((user) => (
          <div key={user.id} className="online-user-item">
            <div className="user-avatar-container">
              <div className="user-avatar">
                {user.profilePictureURL ? (
                  <img 
                    src={user.profilePictureURL} 
                    alt={user.displayName || user.name} 
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="default-avatar"
                  style={{ display: user.profilePictureURL ? 'none' : 'flex' }}
                >
                  {(user.displayName || user.name || 'U').charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="online-indicator"></div>
            </div>
            
            <div className="user-info">
              <div className="user-name">
                {user.displayName || user.name || 'Usuário sem nome'}
              </div>
              <div className="user-username">
                @{user.username || user.id.substring(0, 8)}
              </div>
              <div className="user-badges">
                {getAccountTypeBadge(user)}
                {getKycBadge(user)}
              </div>
              <div className="user-status-info">
                <span className="status-text">🟢 Online agora</span>
              </div>
            </div>
            
            <div className="user-actions">
              <button
                className="start-chat-button"
                onClick={() => handleStartConversation(user)}
                title="Iniciar conversa"
              >
                💬
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OnlineUsersList;
