import React, { useState, useEffect } from 'react';
import { ref, onValue, off, query, orderByChild, push, set } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { useNotification } from '../contexts/NotificationContext';
import { sendAnnouncementNotification } from '../services/notificationService';
import PostCreator from './PostCreator';
import './AnnouncementsTab.css';

const AnnouncementsTab = ({ feedType }) => {
  const { currentUser } = useAuth();
  const isAdmin = useAdminStatus();
  const { showSuccess, showError } = useNotification();
  
  const [announcements, setAnnouncements] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showPostCreator, setShowPostCreator] = useState(false);

  // Determina o caminho no banco de dados baseado no tipo de feed
  const getAnnouncementsPath = () => {
    switch (feedType) {
      case 'vixies':
        return 'vixies_announcements';
      case 'vixink':
        return 'vixink_announcements';
      case 'lobby':
      default:
        return 'announcements';
    }
  };

  const getFeedDisplayName = () => {
    switch (feedType) {
      case 'vixies':
        return 'Vixies';
      case 'vixink':
        return 'Vixink';
      case 'lobby':
      default:
        return 'Lobby';
    }
  };

  useEffect(() => {
    const announcementsPath = getAnnouncementsPath();
    
    // Carrega avisos
    const announcementsRef = ref(database, announcementsPath);
    const announcementsQuery = query(announcementsRef, orderByChild('timestamp'));
    
    const announcementsUnsubscribe = onValue(announcementsQuery, (snapshot) => {
      const announcementsData = [];
      snapshot.forEach((childSnapshot) => {
        const announcement = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        announcementsData.push(announcement);
      });
      
      // Ordena por timestamp (mais recentes primeiro)
      announcementsData.sort((a, b) => b.timestamp - a.timestamp);
      setAnnouncements(announcementsData);
      setLoading(false);
    }, (error) => {
      console.error(`Error loading ${feedType} announcements:`, error);
      setLoading(false);
    });

    // Carrega dados dos usuários
    const usersRef = ref(database, 'users');
    const usersUnsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = {};
      snapshot.forEach((childSnapshot) => {
        usersData[childSnapshot.key] = childSnapshot.val();
      });
      setUsers(usersData);
    });

    return () => {
      announcementsUnsubscribe();
      usersUnsubscribe();
    };
  }, [feedType]);

  const handleCreateAnnouncement = async (postData) => {
    if (!isAdmin) {
      showError('Apenas administradores podem criar avisos.');
      return;
    }

    try {
      const announcementsPath = getAnnouncementsPath();
      const announcementsRef = ref(database, announcementsPath);
      
      const announcementData = {
        ...postData,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Administrador',
        timestamp: Date.now(),
        type: 'announcement',
        feedType: feedType
      };

      const newAnnouncementRef = await push(announcementsRef, announcementData);
      
      // Enviar notificação para todos os usuários
      await sendAnnouncementNotification(
        feedType,
        newAnnouncementRef.key,
        postData.text || '',
        currentUser.uid,
        currentUser.displayName || 'Administrador'
      );
      
      showSuccess(`Aviso criado com sucesso no ${getFeedDisplayName()}!`);
      setShowPostCreator(false);
    } catch (error) {
      console.error('Error creating announcement:', error);
      showError('Erro ao criar aviso.');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderAnnouncement = (announcement) => {
    const author = users[announcement.authorId];
    const authorName = author?.name || announcement.authorName || 'Administrador';
    const authorPhoto = author?.profilePictureURL || author?.photoURL;

    return (
      <div key={announcement.id} className="announcement-card">
        <div className="announcement-header">
          <div className="announcement-author">
            {authorPhoto && (
              <img 
                src={authorPhoto} 
                alt={authorName}
                className="announcement-author-photo"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div className="announcement-author-info">
              <span className="announcement-author-name">{authorName}</span>
              <span className="announcement-admin-badge">
                <i className="fas fa-crown"></i> Administrador
              </span>
            </div>
          </div>
          <span className="announcement-timestamp">
            {formatTimestamp(announcement.timestamp)}
          </span>
        </div>
        
        <div className="announcement-content">
          {announcement.text && (
            <p className="announcement-text">{announcement.text}</p>
          )}
          
          {announcement.media && announcement.media.length > 0 && (
            <div className="announcement-media">
              {announcement.media.map((m, index) => (
                <React.Fragment key={index}>
                  {m.type === 'image' && (
                    <img
                      src={m.url}
                      alt="Mídia do aviso"
                      className="announcement-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  {m.type === 'video' && (
                    <video
                      src={m.url}
                      controls
                      className="announcement-video"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        
        <div className="announcement-footer">
          <span className="announcement-type">
            <i className="fas fa-bullhorn"></i> Aviso Oficial
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="announcements-tab">
        <div className="loading-spinner">Carregando avisos...</div>
      </div>
    );
  }

  return (
    <div className="announcements-tab">
      <div className="announcements-header">
        <h2 className="announcements-title">
          <i className="fas fa-bullhorn"></i>
          Avisos Oficiais - {getFeedDisplayName()}
        </h2>
        {isAdmin && (
          <button 
            className="create-announcement-btn"
            onClick={() => setShowPostCreator(true)}
          >
            <i className="fas fa-plus"></i>
            Criar Aviso
          </button>
        )}
      </div>

      {showPostCreator && (
        <div className="announcement-creator-overlay">
          <div className="announcement-creator-modal">
            <div className="modal-header">
              <h3>Criar Novo Aviso</h3>
              <button 
                className="close-btn"
                onClick={() => setShowPostCreator(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <PostCreator
              onSubmit={handleCreateAnnouncement}
              placeholder="Digite seu aviso oficial aqui..."
              showLocation={false}
              maxLength={500}
            />
          </div>
        </div>
      )}

      <div className="announcements-list">
        {announcements.length === 0 ? (
          <div className="no-announcements">
            <i className="fas fa-bullhorn"></i>
            <p>Nenhum aviso oficial ainda.</p>
            {isAdmin && (
              <p className="admin-hint">Como administrador, você pode criar avisos clicando no botão acima.</p>
            )}
          </div>
        ) : (
          announcements.map(renderAnnouncement)
        )}
      </div>
    </div>
  );
};

export default AnnouncementsTab;
