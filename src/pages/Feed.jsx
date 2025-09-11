import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { getProfileUrlById } from '../utils/profileUrls';
import { database } from '../../config/firebase';
import { ref, onValue, off, query, orderByChild, set, update, push, get } from 'firebase/database';
import { Link } from 'react-router-dom';
import PostCreator from '../components/PostCreator';
import './Feed.css';

const Feed = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('main'); // main | following
  const [dismissedClientRestriction, setDismissedClientRestriction] = useState(false);

  useEffect(() => {
    let postsUnsubscribe, usersUnsubscribe, followingUnsubscribe;

    // Load posts from general feed
    const postsRef = ref(database, 'general_feed_posts');
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
    }, (error) => {
      console.error('Feed: Error loading posts', error);
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

    // Load following list
    if (currentUser?.uid) {
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
    };
  }, [currentUser?.uid]);

  const handleLike = useCallback(async (postId) => {
    if (!currentUser?.uid) return;

    try {
      const postRef = ref(database, `general_feed_posts/${postId}`);
      const postSnapshot = await get(postRef);
      
      if (!postSnapshot.exists()) return;

      const post = postSnapshot.val();
      const likes = post.likes || {};
      const isLiked = likes[currentUser.uid];

      if (isLiked) {
        // Unlike
        delete likes[currentUser.uid];
        await update(postRef, {
          likes,
          likeCount: Math.max(0, (post.likeCount || 0) - 1)
        });
      } else {
        // Like
        likes[currentUser.uid] = true;
        await update(postRef, {
          likes,
          likeCount: (post.likeCount || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      showError('Erro ao curtir post');
    }
  }, [currentUser?.uid, showError]);

  const handleFollow = useCallback(async (userId) => {
    if (!currentUser?.uid || userId === currentUser.uid) return;

    try {
      const followingRef = ref(database, `users/${currentUser.uid}/following/${userId}`);
      const followerRef = ref(database, `users/${userId}/followers/${currentUser.uid}`);
      
      const isFollowing = following.includes(userId);
      
      if (isFollowing) {
        // Unfollow
        await set(followingRef, null);
        await set(followerRef, null);
        showSuccess('Deixou de seguir');
      } else {
        // Follow
        await set(followingRef, true);
        await set(followerRef, true);
        showSuccess('Agora você está seguindo');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      showError('Erro ao seguir/parar de seguir');
    }
  }, [currentUser?.uid, following, showSuccess, showError]);

  const handleDeletePost = useCallback(async (postId) => {
    if (!currentUser?.uid) return;

    try {
      const postRef = ref(database, `general_feed_posts/${postId}`);
      await get(postRef).then(async (snapshot) => {
        if (snapshot.exists()) {
          const post = snapshot.val();
          if (post.userId === currentUser.uid) {
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
    }
  }, [currentUser?.uid, showSuccess, showError]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Agora';
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    const d = new Date(timestamp);
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  };

  const getFilteredPosts = () => {
    if (activeTab === 'following') {
      return posts.filter(post => following.includes(post.userId));
    }
    return posts;
  };

  const renderPost = (post) => {
    const user = users[post.userId];
    if (!user) return null;

    const isLiked = post.likes?.[currentUser?.uid] || false;
    const isFollowing = following.includes(post.userId);
    const isOwnPost = post.userId === currentUser?.uid;

    return (
      <div key={post.id} className="post">
        <div className="post-header">
          <Link to={`/profile/${post.userId}`} className="post-user">
            <img
              src={getProfileUrlById(post.userId)}
              alt={user.displayName || user.email}
              className="post-avatar"
            />
            <div className="post-user-info">
              <span className="post-username">
                {user.displayName || user.email}
              </span>
              <span className="post-time">
                {formatTimeAgo(post.timestamp)}
              </span>
            </div>
          </Link>
          <div className="post-actions">
            {!isOwnPost && (
              <button
                className={`follow-btn ${isFollowing ? 'following' : ''}`}
                onClick={() => handleFollow(post.userId)}
              >
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </button>
            )}
            {isOwnPost && (
              <button
                className="delete-btn"
                onClick={() => handleDeletePost(post.id)}
              >
                🗑️
              </button>
            )}
          </div>
        </div>
        
        <div className="post-content">
          <p className="post-text">{post.text}</p>
          {post.imageUrl && (
            <img src={post.imageUrl} alt="Post" className="post-image" />
          )}
        </div>
        
        <div className="post-footer">
          <button
            className={`like-btn ${isLiked ? 'liked' : ''}`}
            onClick={() => handleLike(post.id)}
          >
            ❤️ {post.likeCount || 0}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="feed-container">
        <div className="loading">Carregando feed...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1>Feed Geral</h1>
        <div className="feed-tabs">
          <button
            className={`tab ${activeTab === 'main' ? 'active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Todos
          </button>
          <button
            className={`tab ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => setActiveTab('following')}
          >
            Seguindo
          </button>
        </div>
      </div>

      <div className="feed-content">
        {getFilteredPosts().length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>
              {activeTab === 'following' 
                ? 'Nenhum post dos usuários que você segue'
                : 'Nenhum post ainda'
              }
            </p>
            {activeTab === 'main' && (
              <p>Seja o primeiro a postar no feed geral!</p>
            )}
          </div>
        ) : (
          getFilteredPosts().map(renderPost)
        )}
      </div>

      <PostCreator
        onPostCreated={() => {
          showSuccess('Post criado com sucesso!');
        }}
        postType="general_feed"
      />
    </div>
  );
};

export default Feed;