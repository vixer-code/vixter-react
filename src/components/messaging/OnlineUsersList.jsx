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
    if (!currentUser?.uid) return;

    // Listen to status changes
    const statusRef = ref(database, 'status');
    
    const unsubscribe = onValue(statusRef, async (snapshot) => {
      console.log('🌐 Status data received:', snapshot.exists());
      
      if (!snapshot.exists()) {
        console.log('📭 No status data available');
        setOnlineUsers([]);
        setLoading(false);
        return;
      }

      const statusData = snapshot.val();
      console.log('👥 Total users with status data:', Object.keys(statusData).length);
      
      const onlineUserIds = [];

      // Get all users with 'online' status
      Object.keys(statusData).forEach(userId => {
        const userStatus = statusData[userId];
        console.log(`👤 User ${userId}: status = ${userStatus?.state}`);
        
        if (userId !== currentUser.uid && userStatus?.state === 'online') {
          onlineUserIds.push(userId);
        }
      });

      console.log('✅ Found online users:', onlineUserIds.length);

      // Load user data for online users
      const usersData = [];
      for (const userId of onlineUserIds) {
        try {
          const userData = await getUserById(userId);
          if (userData) {
            usersData.push({
              ...userData,
              id: userId,
              lastSeen: statusData[userId].last_changed,
              status: statusData[userId].state
            });
            console.log(`📝 Loaded data for online user: ${userData.displayName || userData.name}`);
          }
        } catch (error) {
          console.error('❌ Error loading user data for', userId, ':', error);
        }
      }

      console.log('🎯 Final online users list:', usersData.length);
      setOnlineUsers(usersData);
      setLoading(false);
    });

    return () => {
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
                <span className="status-text">Online agora</span>
                {user.current_page && (
                  <span className="current-page">
                    {user.current_page === '/messages' ? '💬 Mensagens' :
                     user.current_page === '/feed' ? '📱 Feed' :
                     user.current_page === '/profile' ? '👤 Perfil' :
                     user.current_page === '/wallet' ? '💰 Carteira' :
                     '🌐 Navegando'
                    }
                  </span>
                )}
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
