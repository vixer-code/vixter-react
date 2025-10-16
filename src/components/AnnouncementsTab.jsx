import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { useNotification } from '../contexts/NotificationContext';
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

  // Determina a coleção no Firestore baseado no tipo de feed
  const getAnnouncementsCollection = () => {
    switch (feedType) {
      case 'vixies':
        return 'announcements_vixies';
      case 'vixink':
        return 'announcements_vixink';
      case 'lobby':
      default:
        return 'announcements_lobby';
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
    const announcementsCollection = getAnnouncementsCollection();
    
    // Carrega avisos do Firestore
    const announcementsRef = collection(db, announcementsCollection);
    const announcementsQuery = query(announcementsRef, orderBy('createdAt', 'desc'));
    
    const announcementsUnsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      const announcementsData = [];
      snapshot.forEach((doc) => {
        const announcement = {
          id: doc.id,
          ...doc.data()
        };
        announcementsData.push(announcement);
      });
      
      setAnnouncements(announcementsData);
      setLoading(false);
    }, (error) => {
      console.error(`Error loading ${feedType} announcements:`, error);
      setLoading(false);
    });

    return () => {
      announcementsUnsubscribe();
    };
  }, [feedType]);

  const handleCreateAnnouncement = () => {
    // O PostCreator agora cuida de salvar o aviso diretamente
    // Esta função apenas fecha o modal e atualiza a lista
    setShowPostCreator(false);
    
    // As notificações serão enviadas pelo PostCreator quando o aviso for criado
    // A lista de avisos será atualizada automaticamente pelo listener do Firestore
  };

  const formatTimestamp = (timestamp) => {
    // Se for um Timestamp do Firestore, converter para Date
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
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

    return (
      <div key={announcement.id} className="post-card announcement-card">
        <div className="post-header">
          <div className="post-author">
            <img
              src={announcement.authorPhotoURL || '/images/defpfp1.png'}
              alt={authorName}
              className="author-avatar"
              onError={(e) => {
                e.target.src = '/images/defpfp1.png';
              }}
            />
            <div className="author-info">
              <div className="author-name-container">
                <span className="author-name">{authorName}</span>
                <span className="announcement-admin-badge">
                  <i className="fas fa-crown"></i> Administrador
                </span>
              </div>
              <span className="post-time">{formatTimestamp(announcement.createdAt)}</span>
            </div>
          </div>
        </div>
        
        <div className="post-content">
          {(announcement.content || announcement.text) && (
            <p>{announcement.content || announcement.text}</p>
          )}
          
          {announcement.media && announcement.media.length > 0 && (
            <div className="post-media">
              {announcement.media.map((m, index) => (
                <React.Fragment key={index}>
                  {m.type === 'image' && (
                    <img
                      src={m.url}
                      alt="Mídia do aviso"
                      className="post-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  {m.type === 'video' && (
                    <video
                      src={m.url}
                      controls
                      className="post-video"
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
              mode={feedType === 'lobby' ? 'general_feed' : feedType}
              onPostCreated={handleCreateAnnouncement}
              placeholder="Digite seu aviso oficial aqui..."
              showAttachment={false}
              isAnnouncement={true}
            />
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowPostCreator(false)}
              >
                Cancelar
              </button>
            </div>
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
