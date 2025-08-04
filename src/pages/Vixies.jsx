import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { database } from '../config/firebase';
import { ref, onValue, push, set, off, query, orderByChild } from 'firebase/database';
import { Link } from 'react-router-dom';
import './Vixies.css';

const Vixies = () => {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'art', label: 'Arte' },
    { value: 'music', label: 'Música' },
    { value: 'tech', label: 'Tecnologia' },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'other', label: 'Outros' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Mais Recentes' },
    { value: 'oldest', label: 'Mais Antigos' },
    { value: 'popular', label: 'Mais Populares' },
    { value: 'trending', label: 'Em Alta' }
  ];

  useEffect(() => {
    loadPosts();
    loadUsers();

    return () => {
      const postsRef = ref(database, 'posts');
      const usersRef = ref(database, 'users');
      off(postsRef);
      off(usersRef);
    };
  }, []);

  const loadPosts = () => {
    const postsRef = ref(database, 'posts');
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

  const createPost = async () => {
    if (!newPost.trim() || !currentUser) return;

    try {
      const postData = {
        content: newPost.trim(),
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Usuário',
        authorPhotoURL: currentUser.photoURL || '/images/defpfp1.png',
        category: selectedCategory,
        timestamp: Date.now(),
        likes: 0,
        comments: 0,
        shares: 0,
        likedBy: []
      };

      const postsRef = ref(database, 'posts');
      await push(postsRef, postData);

      setNewPost('');
      showNotification('Post criado com sucesso!', 'success');
    } catch (error) {
      console.error('Error creating post:', error);
      showNotification('Erro ao criar post', 'error');
    }
  };

  const likePost = async (postId, currentLikes, likedBy) => {
    if (!currentUser) return;

    try {
      const isLiked = likedBy.includes(currentUser.uid);
      const newLikedBy = isLiked 
        ? likedBy.filter(id => id !== currentUser.uid)
        : [...likedBy, currentUser.uid];
      
      const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;

      const postRef = ref(database, `posts/${postId}`);
      await set(postRef, {
        ...posts.find(p => p.id === postId),
        likes: newLikes,
        likedBy: newLikedBy
      });
    } catch (error) {
      console.error('Error liking post:', error);
      showNotification('Erro ao curtir post', 'error');
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

  const getCategoryIcon = (category) => {
    const icons = {
      gaming: 'fas fa-gamepad',
      art: 'fas fa-palette',
      music: 'fas fa-music',
      tech: 'fas fa-microchip',
      lifestyle: 'fas fa-heart',
      other: 'fas fa-star'
    };
    return icons[category] || 'fas fa-star';
  };

  const getCategoryColor = (category) => {
    const colors = {
      gaming: '#ff6b6b',
      art: '#4ecdc4',
      music: '#ff9ff3',
      tech: '#54a0ff',
      lifestyle: '#ff7675',
      other: '#5f27cd'
    };
    return colors[category] || '#5f27cd';
  };

  const filteredPosts = posts.filter(post => {
    if (selectedCategory !== 'all' && post.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="vixies-container">
        <div className="loading-spinner">Carregando posts...</div>
      </div>
    );
  }

  return (
    <div className="vixies-container">
      <div className="vixies-header">
        <div className="vixies-title">
          <h1>Vixies</h1>
          <p>Compartilhe suas experiências e descubra conteúdo incrível</p>
        </div>
      </div>

      <div className="vixies-content">
        <div className="vixies-sidebar">
          <div className="create-post-section">
            {currentUser ? (
              <div className="create-post-card">
                <div className="create-post-header">
                  <img
                    src={currentUser.photoURL || '/images/defpfp1.png'}
                    alt={currentUser.displayName || 'User'}
                    className="user-avatar"
                    onError={(e) => {
                      e.target.src = '/images/defpfp1.png';
                    }}
                  />
                  <div className="create-post-input-container">
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="O que você quer compartilhar?"
                      className="create-post-input"
                      rows="3"
                    />
                  </div>
                </div>
                
                <div className="create-post-options">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="category-select"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={createPost}
                    disabled={!newPost.trim()}
                    className="create-post-btn"
                  >
                    <i className="fas fa-paper-plane"></i>
                    Publicar
                  </button>
                </div>
              </div>
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
              <label>Ordenar por:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="vixies-feed">
          {filteredPosts.length === 0 ? (
            <div className="no-posts">
              <i className="fas fa-comments"></i>
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
                  </div>

                  <div className="post-actions">
                    <button
                      onClick={() => likePost(post.id, post.likes, post.likedBy || [])}
                      className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
                    >
                      <i className={`fas fa-heart ${isLiked ? 'fas' : 'far'}`}></i>
                      <span>{post.likes || 0}</span>
                    </button>
                    
                    <button className="action-btn comment-btn">
                      <i className="fas fa-comment"></i>
                      <span>{post.comments || 0}</span>
                    </button>
                    
                    <button className="action-btn share-btn">
                      <i className="fas fa-share"></i>
                      <span>{post.shares || 0}</span>
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

export default Vixies; 