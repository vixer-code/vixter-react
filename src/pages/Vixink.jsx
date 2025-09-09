import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { database } from '../../config/firebase';
import { ref, onValue, off, query, orderByChild, set, get } from 'firebase/database';
import { Link } from 'react-router-dom';
import PostCreator from '../components/PostCreator';
import './Vixink.css';

const Vixink = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { showNotification } = useNotification();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('main'); // main | following

  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'news', label: 'Notícias' },
    { value: 'tutorial', label: 'Tutoriais' },
    { value: 'review', label: 'Reviews' },
    { value: 'guide', label: 'Guias' },
    { value: 'other', label: 'Outros' }
  ];

  useEffect(() => {
    loadPosts();
    loadUsers();
    loadFollowing();

    return () => {
      const postsRef = ref(database, 'vixink_posts');
      const usersRef = ref(database, 'users');
      const followingRef = ref(database, `users/${currentUser?.uid}/following`);
      off(postsRef);
      off(usersRef);
      off(followingRef);
    };
  }, [currentUser]);

  const loadPosts = () => {
    const postsRef = ref(database, 'vixink_posts');
    const postsQuery = query(postsRef, orderByChild('timestamp'));

    const unsubscribe = onValue(postsQuery, (snapshot) => {
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

    return unsubscribe;
  };

  const loadUsers = () => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = {};
      snapshot.forEach((childSnapshot) => {
        usersData[childSnapshot.key] = childSnapshot.val();
      });
      setUsers(usersData);
    });

    return unsubscribe;
  };

  const loadFollowing = () => {
    if (!currentUser) return;
    const followingRef = ref(database, `users/${currentUser.uid}/following`);
    const unsubscribe = onValue(followingRef, (snapshot) => {
      const followingData = [];
      snapshot.forEach((childSnapshot) => {
        followingData.push(childSnapshot.key);
      });
      setFollowing(followingData);
    });

    return unsubscribe;
  };

  const handlePostCreated = () => {
    // Refresh posts or perform any other action after post creation
    loadPosts();
  };

  const likePost = async (postId, currentLikes, likedBy) => {
    if (!currentUser) return;

    try {
      const isLiked = likedBy?.includes(currentUser.uid);
      const newLikedBy = isLiked ? (likedBy || []).filter(id => id !== currentUser.uid) : [...(likedBy || []), currentUser.uid];
      const newLikes = isLiked ? (currentLikes || 0) - 1 : (currentLikes || 0) + 1;
      const postRef = ref(database, `vixink_posts/${postId}`);
      await set(postRef, { ...posts.find(p => p.id === postId), likes: newLikes, likedBy: newLikedBy });
    } catch (error) {
      console.error('Error liking post:', error);
      showNotification('Erro ao curtir post', 'error');
    }
  };

  const repostPost = async (post) => {
    if (!currentUser) return;
    const self = post.authorId === currentUser.uid;
    const postRepostsRef = ref(database, `vixinkReposts/${post.id}/${currentUser.uid}`);
    const userRepostsRef = ref(database, `userReposts/${currentUser.uid}/${post.id}`);
    if (self) {
      const snap = await get(userRepostsRef).catch(() => null);
      const prev = snap && snap.exists() ? snap.val() : null;
      const prevCount = typeof prev === 'object' && prev ? Number(prev.count || 0) : (prev ? 1 : 0);
      if (prevCount >= 3) { showNotification('Limite de 3 reposts atingido.', 'info'); return; }
      const next = { count: prevCount + 1, lastAt: Date.now() };
      await set(userRepostsRef, next);
      await set(postRepostsRef, next.lastAt);
    } else {
      const snap = await get(postRepostsRef).catch(() => null);
      if (snap && snap.exists()) { showNotification('Você já repostou este conteúdo.', 'info'); return; }
      await set(postRepostsRef, Date.now());
      await set(userRepostsRef, Date.now());
    }
  };

  const tipPost = async (post) => {
    if (!currentUser) return;
    if (!userProfile || userProfile.accountType !== 'client') {
      showNotification('Somente contas de cliente podem dar gorjeta.', 'warning');
      return;
    }
    showNotification('Funcionalidade de gorjeta será integrada em breve.', 'info');
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

  const getCategoryIcon = (category) => {
    const icons = {
      news: 'fas fa-newspaper',
      tutorial: 'fas fa-graduation-cap',
      review: 'fas fa-star',
      guide: 'fas fa-map',
      other: 'fas fa-link'
    };
    return icons[category] || 'fas fa-link';
  };

  const getCategoryColor = (category) => {
    const colors = {
      news: '#ff6b6b',
      tutorial: '#4ecdc4',
      review: '#feca57',
      guide: '#54a0ff',
      other: '#5f27cd'
    };
    return colors[category] || '#5f27cd';
  };

  const calculateEngagementScore = (post) => {
    const likes = post.likes || 0;
    const reposts = post.reposts || 0;
    const comments = post.comments || 0;
    const age = Date.now() - post.timestamp;
    const ageInHours = age / (1000 * 60 * 60);
    
    // Engagement score with time decay
    const engagement = likes + (reposts * 2) + (comments * 1.5);
    const timeDecay = Math.max(0.1, 1 - (ageInHours / 168)); // Decay over 7 days
    return engagement * timeDecay;
  };

  const filteredPosts = posts.filter(post => {
    // Category filter
    if (selectedCategory !== 'all' && post.category !== selectedCategory) {
      return false;
    }
    
    // Following filter
    if (activeTab === 'following') {
      return following.includes(post.authorId);
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
      <div className="vixink-container">
        <div className="loading-spinner">Carregando posts...</div>
      </div>
    );
  }

  return (
    <div className="vixink-container">
      <div className="vixink-header">
        <div className="vixink-title">
          <h1>Vixink</h1>
          <p>Compartilhe links, notícias e conteúdo interessante</p>
        </div>
      </div>

      <div className="vixink-content">
        <div className="vixink-tabs">
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
        </div>

        <div className="vixink-sidebar">
          <div className="create-post-section">
            {currentUser ? (
              <PostCreator
                mode="vixink"
                onPostCreated={handlePostCreated}
                placeholder="Descreva seu conteúdo (sem links)"
                showAttachment={true}
                categories={categories}
              />
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

          <div className="filters-section">
            <h3>Filtros</h3>
            <div className="filter-group">
              <label>Categoria:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-filter"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="vixink-feed">
          {filteredPosts.length === 0 ? (
            <div className="no-posts">
              <i className="fas fa-link"></i>
              <h3>Nenhum post encontrado</h3>
              <p>
                {selectedCategory !== 'all' 
                  ? 'Não há posts nesta categoria ainda'
                  : 'Seja o primeiro a compartilhar algo!'
                }
              </p>
            </div>
          ) : (
            filteredPosts.map((post) => {
              const author = users[post.authorId] || {};
              const isLiked = post.likedBy?.includes(currentUser?.uid);
              
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
                        <Link to={`/profile/${post.authorId}`} className="author-name">
                          {post.authorName}
                        </Link>
                        <span className="post-time">{formatTime(post.timestamp)}</span>
                      </div>
                    </div>
                    
                    <div 
                      className="post-category"
                      style={{ backgroundColor: getCategoryColor(post.category) }}
                    >
                      <i className={getCategoryIcon(post.category)}></i>
                    </div>
                  </div>

                  <div className="post-content">
                    <p>{post.content}</p>
                    {Array.isArray(post.media) && post.media.length > 0 && (
                      <div className="post-media">
                        {post.media.map((m, idx) => (
                          <div key={idx} className="media-item">
                            {m.type === 'image' && (<img src={m.url} alt="conteúdo" />)}
                            {m.type === 'video' && (<video src={m.url} controls />)}
                            {m.type === 'audio' && (<audio src={m.url} controls />)}
                          </div>
                        ))}
                      </div>
                    )}
                    {post.attachment && (
                      <div className="attached-item">
                        <div className="attached-cover" style={{ backgroundImage: `url(${post.attachment.coverUrl || '/images/default-service.jpg'})` }}></div>
                        <div className="attached-info">
                          <div className="attached-title">{post.attachment.title}</div>
                          <Link to={`/${post.attachment.kind === 'service' ? 'service' : 'pack'}/${post.attachment.id}`} className="view-more">Ver mais</Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="post-actions">
                    <button
                      onClick={() => likePost(post.id, post.likes, post.likedBy || [])}
                      className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
                    >
                      <i className={`fas fa-heart ${isLiked ? 'fas' : 'far'}`}></i>
                      <span>{post.likes || 0}</span>
                    </button>
                    
                    <button className="action-btn share-btn" onClick={() => repostPost(post)}>
                      <i className="fas fa-retweet"></i>
                    </button>
                    <button className="action-btn tip-btn" onClick={() => tipPost(post)}>
                      <i className="fas fa-hand-holding-usd"></i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Vixink; 