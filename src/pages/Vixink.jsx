import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useBlock } from '../contexts/BlockContext';
import { useNotification } from '../contexts/NotificationContext';
import { getProfileUrlById } from '../utils/profileUrls';
import { database } from '../../config/firebase';
import { ref, onValue, off, query, orderByChild, set, update, push, get } from 'firebase/database';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PostCreator from '../components/PostCreator';
import VixtipModal from '../components/VixtipModal';
import VixtipSupporters from '../components/VixtipSupporters';
import PurpleSpinner from '../components/PurpleSpinner';
import MediaViewer from '../components/MediaViewer';
import AnnouncementsTab from '../components/AnnouncementsTab';
import UserBadge from '../components/UserBadge';
import './Vixies.css';

// Component for displaying attachments with validation
const AttachmentDisplay = ({ attachment, checkAttachmentExists, getImageUrl }) => {
  const [attachmentExists, setAttachmentExists] = useState(null);
  
  useEffect(() => {
    checkAttachmentExists(attachment).then(setAttachmentExists);
  }, [attachment, checkAttachmentExists]);
  
  if (attachmentExists === false) {
    return (
      <div className="attached-item unavailable">
        <div className="attached-cover unavailable-cover">
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        <div className="attached-info">
          <span className="unavailable-text">Serviço não está mais disponível</span>
        </div>
      </div>
    );
  }
  
  if (attachmentExists === null) {
    return (
      <div className="attached-item loading">
        <div className="attached-cover loading-cover">
          <PurpleSpinner size="small" />
        </div>
        <div className="attached-info">
          <span className="loading-text">Verificando disponibilidade...</span>
        </div>
      </div>
    );
  }
  
  const imageUrl = getImageUrl(
    attachment.coverImage?.publicUrl || 
    attachment.coverUrl || 
    attachment.coverImage || 
    attachment.image ||
    attachment.cover ||
    attachment.imageUrl ||
    '/images/default-service.jpg'
  );
  
  return (
    <div className="attached-item">
      <div 
        className="attached-cover" 
        style={{ 
          backgroundImage: `url(${imageUrl})` 
        }}
        onLoad={() => console.log('Vixink - Image loaded successfully')}
        onError={() => console.log('Vixink - Image failed to load')}
      ></div>
      <div className="attached-info">
        <Link to={`/${attachment.kind === 'service' ? 'service' : 'pack'}/${attachment.id}`} className="view-more">Ver mais</Link>
      </div>
    </div>
  );
};

const Vixink = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { hasBlockBetween } = useBlock();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('main'); // main | following | myposts | announcements
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [showVixtipModal, setShowVixtipModal] = useState(false);
  const [selectedPostForTip, setSelectedPostForTip] = useState(null);
  const [likes, setLikes] = useState({}); // New state for likes
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaToView, setMediaToView] = useState(null);

  // Check if user is logged in, redirect to login if not
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    // Check URL parameters for tab
    const tabParam = searchParams.get('tab');
    if (tabParam && ['main', 'following', 'myposts', 'announcements'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    let postsUnsubscribe, usersUnsubscribe, followingUnsubscribe;

    // Load posts
    const postsRef = ref(database, 'vixink_posts');
    const postsQuery = query(postsRef, orderByChild('timestamp'));
    postsUnsubscribe = onValue(postsQuery, (snapshot) => {
      const postsData = [];
      snapshot.forEach((childSnapshot) => {
        const post = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        postsData.push(post);
      });
      
      // Sort by timestamp (newest first)
      postsData.sort((a, b) => b.timestamp - a.timestamp);
      setPosts(postsData);
      setLoading(false);
    });

    // Load users
    const usersRef = ref(database, 'users');
    usersUnsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = {};
      snapshot.forEach((childSnapshot) => {
        usersData[childSnapshot.key] = childSnapshot.val();
      });
      setUsers(usersData);
    });

    // Load likes
    const likesRef = ref(database, 'vixink_likes');
    const likesUnsubscribe = onValue(likesRef, (snapshot) => {
      const likesData = {};
      snapshot.forEach((postSnapshot) => {
        const postId = postSnapshot.key;
        const postLikes = {};
        postSnapshot.forEach((userSnapshot) => {
          postLikes[userSnapshot.key] = userSnapshot.val();
        });
        likesData[postId] = postLikes;
      });
      setLikes(likesData);
    });

    // Load following
    if (currentUser) {
      const followingRef = ref(database, `users/${currentUser.uid}/following`);
      followingUnsubscribe = onValue(followingRef, (snapshot) => {
        const followingData = [];
        snapshot.forEach((childSnapshot) => {
          followingData.push(childSnapshot.key);
        });
        setFollowing(followingData);
      });
    }

    return () => {
      if (postsUnsubscribe) postsUnsubscribe();
      if (usersUnsubscribe) usersUnsubscribe();
      if (followingUnsubscribe) followingUnsubscribe();
      if (likesUnsubscribe) likesUnsubscribe();
    };
  }, [currentUser]);

  const handlePostCreated = useCallback(() => {
    // Refresh posts or perform any other action after post creation
    // The posts will be automatically updated via the real-time listener
  }, []);



  const likePost = async (postId, currentLikes, likedBy) => {
    if (!currentUser) return;

    try {
      const isLiked = likedBy?.includes(currentUser.uid);
      
      if (isLiked) {
        // Unlike: remove from likes
        const likeRef = ref(database, `vixink_likes/${postId}/${currentUser.uid}`);
        await set(likeRef, null);
      } else {
        // Like: add to likes
        const likeRef = ref(database, `vixink_likes/${postId}/${currentUser.uid}`);
        await set(likeRef, Date.now());
      }
    } catch (error) {
      console.error('Error liking post:', error);
      showError('Erro ao curtir post');
    }
  };


  const tipPost = async (post) => {
    if (!currentUser) return;
    
    // Verificar se o perfil está carregado
    if (!userProfile) {
      showWarning('Carregando perfil do usuário...');
      return;
    }
    
    if (userProfile.accountType !== 'client') {
      showWarning('Somente contas de cliente podem dar gorjeta.');
      return;
    }
    
    // Sem barreiras - qualquer usuário pode receber gorjetas
    setSelectedPostForTip(post);
    setShowVixtipModal(true);
  };

  const handleDeletePost = (postId) => {
    if (!currentUser) return;
    
    // Find the post to get its content for confirmation
    const post = posts.find(p => p.id === postId);
    if (post) {
      setPostToDelete({ id: postId, content: post.content });
      setShowDeleteModal(true);
    }
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    
    try {
      const postRef = ref(database, `vixink_posts/${postToDelete.id}`);
      await get(postRef).then(async (snapshot) => {
        if (snapshot.exists()) {
          const post = snapshot.val();
          if (post.authorId === currentUser.uid) {
            await set(postRef, null);
            showSuccess('Post deletado');
          } else {
            showError('Você só pode deletar seus próprios posts');
          }
        }
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      showError('Erro ao deletar post');
    } finally {
      setShowDeleteModal(false);
      setPostToDelete(null);
    }
  };

  const cancelDeletePost = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const handleFollow = async (userId) => {
    if (!currentUser || !userId) return;
    
    try {
      const isCurrentlyFollowing = following.includes(userId);
      
      if (isCurrentlyFollowing) {
        // Unfollow
        const followRef = ref(database, `users/${currentUser.uid}/following/${userId}`);
        await set(followRef, null);
        showSuccess('Deixou de seguir');
      } else {
        // Follow
        const followRef = ref(database, `users/${currentUser.uid}/following/${userId}`);
        await set(followRef, Date.now());
        showSuccess('Agora você está seguindo');
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      showError('Erro ao seguir/deixar de seguir');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString('pt-BR');
  };

  const handleOpenMediaViewer = (mediaUrl, mediaType, caption = '') => {
    setMediaToView({ url: mediaUrl, type: mediaType, caption });
    setShowMediaViewer(true);
  };

  // Function to handle WebP compatibility and R2 URLs
  const getImageUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    
    // Handle R2 URLs - already have https protocol
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return url;
    }
    
    // Fix URL construction for media.vixter.com.br
    if (url.startsWith('media.vixter.com.br/')) {
      url = `https://${url}`;
    }
    
    // For WebP images, add a timestamp to force refresh (only for local images)
    if (url.includes('.webp') && !url.includes('https://')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}t=${Date.now()}`;
    }
    
    return url;
  };

  // Function to check if attachment service/pack exists
  const checkAttachmentExists = async (attachment) => {
    if (!attachment || !attachment.id || !attachment.kind) return false;
    
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { firestore } = await import('../../config/firebase');
      
      const collectionName = attachment.kind === 'service' ? 'services' : 'packs';
      const attachmentRef = doc(firestore, collectionName, attachment.id);
      const snapshot = await getDoc(attachmentRef);
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking attachment existence:', error);
      return false;
    }
  };


  const calculateEngagementScore = (post) => {
    const likes = post.likes || 0;
    const age = Date.now() - post.timestamp;
    const ageInHours = age / (1000 * 60 * 60);
    
    // Engagement score with time decay
    const engagement = likes;
    const timeDecay = Math.max(0.1, 1 - (ageInHours / 168)); // Decay over 7 days
    return engagement * timeDecay;
  };

  const filteredPosts = posts.filter(post => {
    // Filter out blocked users
    if (post.authorId && hasBlockBetween(post.authorId)) {
      return false;
    }
    
    // Following filter
    if (activeTab === 'following') {
      return following.includes(post.authorId);
    }
    
    // My posts filter
    if (activeTab === 'myposts') {
      return post.authorId === currentUser?.uid;
    }
    
    return true;
  }).sort((a, b) => {
    if (activeTab === 'following') {
      // Following tab: time-based only
      return b.timestamp - a.timestamp;
    } else {
      // Main tab: engagement-based with time boost
      const scoreA = calculateEngagementScore(a);
      const scoreB = calculateEngagementScore(b);
      return scoreB - scoreA;
    }
  });

  if (loading) {
    return (
      <div className="vixies-container">
        <PurpleSpinner text="Carregando posts..." size="large" />
      </div>
    );
  }

  // Don't render if user is not logged in
  if (!currentUser) {
    return null;
  }

  return (
    <div className="vixink-page">
      <div className="vixies-container">
      <div className="vixies-header">
        <div className="vixies-title">
          <h1 data-text="Vixink">Vixink</h1>
        </div>
      </div>

      <div className="vixies-content">
        <div className="vixies-tabs-container">
          <div className="vixies-tabs">
            <button 
              className={`tab-btn ${activeTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              Principal
            </button>
            <button 
              className={`tab-btn ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Seguindo
            </button>
            <button 
              className={`tab-btn ${activeTab === 'announcements' ? 'active' : ''}`}
              onClick={() => setActiveTab('announcements')}
            >
              <i className="fas fa-bullhorn"></i>
              Avisos
            </button>
            {userProfile && userProfile.accountType !== 'client' && (
              <button 
                className={`tab-btn tab-btn-myposts ${activeTab === 'myposts' ? 'active' : ''}`}
                onClick={() => setActiveTab('myposts')}
              >
                Meus posts
              </button>
            )}
          </div>
          {/* Botão separado para mobile */}
          {userProfile && userProfile.accountType !== 'client' && (
            <div className="vixies-tabs-myposts-mobile">
              <button 
                className={`tab-btn-myposts ${activeTab === 'myposts' ? 'active' : ''}`}
                onClick={() => setActiveTab('myposts')}
              >
                Meus posts
              </button>
            </div>
          )}
        </div>

        {/* PostCreator moved to top of feed - ocultar na tab de avisos */}
        {activeTab !== 'announcements' && (
          <div className="create-post-section">
            {currentUser ? (
              userProfile?.accountType === 'client' ? (
                <div className="client-feed-only">
                  <div className="feed-only-content">
                    <div className="feed-only-icon">
                      <i className="fas fa-eye"></i>
                    </div>
                    <div className="feed-only-text">
                      <p>Essa área é de divulgação de conteúdo de serviços e packs. Portanto, somente criadores podem publicar.</p>
                      <small>Conheça novos serviços e apoie seus criadores favoritos.</small>
                    </div>
                  </div>
                </div>
              ) : (
                <PostCreator
                  mode="vixink"
                  onPostCreated={handlePostCreated}
                  placeholder="O que você está pensando?"
                  showAttachment={true}
                />
              )
            ) : (
              <div className="login-prompt">
                <h3>Faça login para compartilhar</h3>
                <p>Entre na sua conta para criar posts e interagir com a comunidade</p>
                <Link to="/login" className="login-btn">
                  Entrar
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="vixies-feed">
          {activeTab === 'announcements' ? (
            <AnnouncementsTab feedType="vixink" />
          ) : filteredPosts.length === 0 ? (
            <div className="no-posts">
              <i className="fas fa-link"></i>
              <h3>Nenhum post encontrado</h3>
              <p>
                {activeTab === 'following'
                  ? 'Você não está seguindo ninguém ainda'
                  : activeTab === 'myposts'
                  ? 'Você ainda não fez nenhum post'
                  : 'Seja o primeiro a compartilhar algo!'
                }
              </p>
            </div>
          ) : (
            filteredPosts.map((post) => {
              // Use current user profile if it's the current user's post
              const isCurrentUser = currentUser && post.authorId === currentUser.uid;
              const author = isCurrentUser ? userProfile : (users[post.authorId] || {});
              const isLiked = currentUser && likes[post.id] && likes[post.id][currentUser.uid];
              const likeCount = likes[post.id] ? Object.keys(likes[post.id]).length : (post.likes || 0);
              
              return (
                <div key={post.id} className="post-card">
                  <div className="post-header">
                    <div className="post-author">
                      <img
                        src={post.authorPhotoURL || '/images/defpfp1.png'}
                        alt={post.authorName}
                        className="author-avatar"
                        onError={(e) => {
                          e.target.src = '/images/defpfp1.png';
                        }}
                      />
                      <div className="author-info">
                        <div className="author-name-container">
                          <Link 
                            to={isCurrentUser ? '/profile' : getProfileUrlById(post.authorId, post.authorUsername)} 
                            className="author-name"
                          >
                            {post.authorName}
                          </Link>
                          <UserBadge user={author} />
                        </div>
                        <span className="post-time">{formatTime(post.timestamp)}</span>
                      </div>
                    </div>
                    <div className="post-actions">
                      {!isCurrentUser && (
                        <button className={`follow-btn ${following.includes(post.authorId) ? 'following' : ''}`} onClick={() => handleFollow(post.authorId)}>
                          {following.includes(post.authorId) ? 'Seguindo' : 'Seguir'}
                        </button>
                      )}
                      {isCurrentUser && (
                        <button className="delete-btn" onClick={() => handleDeletePost(post.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>


                  <div className="post-content">
                    <p>{post.content}</p>
                    {Array.isArray(post.media) && post.media.length > 0 && (
                      <div className="post-media">
                        {post.media.map((m, idx) => (
                          <React.Fragment key={idx}>
                            {m.type === 'image' && (
                              <img 
                                src={m.url} 
                                alt="conteúdo" 
                                onClick={() => handleOpenMediaViewer(m.url, 'image', post.content)}
                                style={{ cursor: 'pointer' }}
                              />
                            )}
                            {m.type === 'video' && (
                              <video 
                                src={m.url} 
                                controls 
                                controlsList="nodownload"
                                style={{ maxHeight: '70vh', width: '100%', objectFit: 'contain' }}
                              />
                            )}
                            {m.type === 'audio' && (<audio src={m.url} controls />)}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    {post.attachment && <AttachmentDisplay attachment={post.attachment} checkAttachmentExists={checkAttachmentExists} getImageUrl={getImageUrl} />}
                  </div>

                  <div className="post-actions">
                    <button
                      onClick={() => likePost(post.id, likeCount, likes[post.id] ? Object.keys(likes[post.id]) : [])}
                      className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
                    >
                      <i className={`fas fa-heart ${isLiked ? 'fas' : 'far'}`}></i>
                      <span>{likeCount}</span>
                    </button>
                    
                    <button className="action-btn tip-btn" onClick={() => tipPost(post)}>
                      <i className="fas fa-hand-holding-usd"></i>
                    </button>
                  </div>

                  {/* Top Apoiadores */}
                  <VixtipSupporters postId={post.id} postType="vixink" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Vixtip Modal */}
      <VixtipModal
        isOpen={showVixtipModal}
        onClose={() => {
          setShowVixtipModal(false);
          setSelectedPostForTip(null);
        }}
        post={selectedPostForTip}
        postType="vixink"
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <h3>Confirmar Exclusão</h3>
              <button className="modal-close" onClick={cancelDeletePost}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Tem certeza que deseja deletar este post?</p>
              {postToDelete?.content && (
                <div className="post-preview">
                  <p>"{postToDelete.content.substring(0, 100)}{postToDelete.content.length > 100 ? '...' : ''}"</p>
                </div>
              )}
              <p className="warning-text">Esta ação não pode ser desfeita.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={cancelDeletePost}>
                Cancelar
              </button>
              <button className="btn-delete" onClick={confirmDeletePost}>
                <i className="fas fa-trash"></i>
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer Modal */}
      {showMediaViewer && mediaToView && (
        <MediaViewer
          mediaUrl={mediaToView.url}
          mediaType={mediaToView.type}
          caption={mediaToView.caption}
          onClose={() => {
            setShowMediaViewer(false);
            setMediaToView(null);
          }}
        />
      )}
      </div>
    </div>
  );
};

export default Vixink; 