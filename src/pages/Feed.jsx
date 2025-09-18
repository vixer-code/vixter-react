import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { getProfileUrlById } from '../utils/profileUrls';
import { database } from '../../config/firebase';
import { ref, onValue, off, query, orderByChild, set, update, push, get, remove } from 'firebase/database';
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
  const [commentsByPost, setCommentsByPost] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

  useEffect(() => {
    let postsUnsubscribe, usersUnsubscribe, followingUnsubscribe;

    // Load posts from RTDB /posts
    const postsRef = ref(database, 'posts');
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
      const postRef = ref(database, `posts/${postId}`);
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
        setFollowing(prevFollowing => prevFollowing.filter(id => id !== userId));
        showSuccess('Deixou de seguir');
      } else {
        // Follow
        await set(followingRef, true);
        await set(followerRef, true);
        setFollowing(prevFollowing => [...prevFollowing, userId]);
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
      const postRef = ref(database, `posts/${postId}`);
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

  const repostPost = useCallback(async (post) => {
    if (!currentUser) return;
    try {
      const postRepostsRef = ref(database, `generalReposts/${post.id}/${currentUser.uid}`);
      const snap = await get(postRepostsRef).catch(() => null);
      if (snap && snap.exists()) {
        showInfo('Você já repostou este conteúdo.');
        return;
      }

      const repostData = {
        authorId: currentUser.uid,
        authorName: userProfile?.displayName || userProfile?.name || 'Usuário',
        authorPhotoURL: userProfile?.profilePictureURL || userProfile?.photoURL || '/images/defpfp1.png',
        authorUsername: userProfile?.username || '',
        content: post.content || post.text || '',
        timestamp: Date.now(),
        media: post.media || (post.imageUrl ? [{ type: 'image', url: post.imageUrl }] : null),
        attachment: post.attachment || null,
        likes: 0,
        likedBy: [],
        isRepost: true,
        originalPostId: post.id,
        originalAuthorId: post.userId || post.authorId,
        originalAuthorName: post.userName || post.authorName,
        repostCount: 0
      };

      const repostRef = ref(database, 'posts');
      await push(repostRef, repostData);
      await set(postRepostsRef, Date.now());
      const userRepostsRef = ref(database, `userReposts/${currentUser.uid}/${post.id}`);
      await set(userRepostsRef, Date.now());

      const originalPostRef = ref(database, `posts/${post.id}`);
      const originalPostSnap = await get(originalPostRef);
      if (originalPostSnap.exists()) {
        const originalData = originalPostSnap.val();
        const newRepostCount = (originalData.repostCount || 0) + 1;
        await update(originalPostRef, { repostCount: newRepostCount });
      }

      showSuccess('Post repostado com sucesso!');
    } catch (error) {
      console.error('Error reposting:', error);
      showError('Erro ao repostar conteúdo');
    }
  }, [currentUser, userProfile, showSuccess, showError, showInfo]);

  const loadComments = useCallback(async (postId) => {
    setCommentsByPost(prev => ({ ...prev, [postId]: { ...(prev[postId] || {}), loading: true } }));
    try {
      const commentsRef = ref(database, `comments/${postId}`);
      const snap = await get(commentsRef);
      let items = [];
      if (snap.exists()) {
        const val = snap.val();
        items = Object.entries(val).map(([id, c]) => ({ id, ...c }));
        items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }
      setCommentsByPost(prev => ({ ...prev, [postId]: { items, loading: false } }));
    } catch (e) {
      console.error('Error loading comments', e);
      setCommentsByPost(prev => ({ ...prev, [postId]: { items: [], loading: false } }));
    }
  }, []);

  const toggleComments = useCallback((postId) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    const isExpanded = expandedComments[postId];
    if (!isExpanded && !commentsByPost[postId]?.items) {
      loadComments(postId);
    }
  }, [expandedComments, commentsByPost, loadComments]);

  const updateInput = useCallback((key, text) => {
    setCommentInputs(prev => ({ ...prev, [key]: text }));
  }, []);

  const addComment = useCallback(async (postId, parentId = null) => {
    if (!currentUser) return;
    const key = parentId ? `${postId}:${parentId}` : postId;
    const text = (commentInputs[key] || '').trim();
    if (!text) return;
    try {
      const commentData = {
        authorId: currentUser.uid,
        authorName: userProfile?.displayName || userProfile?.name || 'Usuário',
        authorUsername: userProfile?.username || '',
        authorPhotoURL: userProfile?.profilePictureURL || currentUser.photoURL || '/images/defpfp1.png',
        content: text,
        timestamp: Date.now(),
        likes: 0,
        likedBy: [],
        parentId: parentId || null
      };
      const commentsRef = ref(database, `comments/${postId}`);
      await push(commentsRef, commentData);
      setCommentInputs(prev => ({ ...prev, [key]: '' }));
      await loadComments(postId);
    } catch (e) {
      console.error('Error adding comment', e);
      showError('Erro ao comentar');
    }
  }, [currentUser, userProfile, commentInputs, loadComments, showError]);

  const likeComment = useCallback(async (postId, comment) => {
    if (!currentUser) return;
    try {
      const commentRef = ref(database, `comments/${postId}/${comment.id}`);
      const likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
      const isLiked = likedBy.includes(currentUser.uid);
      const newLikedBy = isLiked ? likedBy.filter(id => id !== currentUser.uid) : [...likedBy, currentUser.uid];
      const newLikes = isLiked ? Math.max(0, (comment.likes || 0) - 1) : (comment.likes || 0) + 1;
      await update(commentRef, { likes: newLikes, likedBy: newLikedBy });
      await loadComments(postId);
    } catch (e) {
      console.error('Error liking comment', e);
    }
  }, [currentUser, loadComments]);

  const deleteComment = useCallback(async (postId, comment) => {
    if (!currentUser || comment.authorId !== currentUser.uid) return;
    try {
      const commentRef = ref(database, `comments/${postId}/${comment.id}`);
      await remove(commentRef);
      await loadComments(postId);
    } catch (e) {
      console.error('Error deleting comment', e);
    }
  }, [currentUser, loadComments]);

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
      return posts.filter(post => following.includes(post.userId || post.authorId));
    }
    return posts;
  };

  const buildCommentTree = (items) => {
    const byParent = new Map();
    items.forEach(c => {
      const key = c.parentId || 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    });
    return byParent;
  };

  const renderComments = (postId) => {
    const state = commentsByPost[postId] || { items: [], loading: false };
    const tree = buildCommentTree(state.items || []);
    const roots = tree.get('root') || [];

    const renderNode = (comment, depth = 0) => (
      <div key={comment.id} className="comment-item" style={{ marginLeft: depth * 16 }}>
        <div className="comment-header">
          <img src={comment.authorPhotoURL || '/images/defpfp1.png'} alt={comment.authorName} className="comment-avatar" />
          <div className="comment-meta">
            <span className="comment-author">{comment.authorName}</span>
            <span className="comment-time">{formatTimeAgo(comment.timestamp)}</span>
          </div>
        </div>
        <div className="comment-content">{comment.content}</div>
        <div className="comment-actions">
          <button className={`action-btn like-btn ${comment.likedBy?.includes(currentUser?.uid) ? 'liked' : ''}`} onClick={() => likeComment(postId, comment)}>
            <i className="fas fa-heart"></i>
            <span>{comment.likes || 0}</span>
          </button>
          <button className="action-btn reply-btn" onClick={() => { /* keep input focused */ }}>
            <i className="fas fa-reply"></i>
          </button>
          {comment.authorId === currentUser?.uid && (
            <button className="action-btn delete-btn" onClick={() => deleteComment(postId, comment)}>
              <i className="fas fa-trash"></i>
            </button>
          )}
        </div>
        <div className="comment-reply">
          <input
            type="text"
            placeholder="Responder..."
            value={commentInputs[`${postId}:${comment.id}`] || ''}
            onChange={(e) => setCommentInputs(prev => ({ ...prev, [`${postId}:${comment.id}`]: e.target.value }))}
          />
          <button className="btn small" onClick={() => addComment(postId, comment.id)}>Enviar</button>
        </div>
        {(tree.get(comment.id) || []).map(child => renderNode(child, depth + 1))}
      </div>
    );

    return (
      <div className="comments-section">
        {state.loading ? (
          <div className="loading-spinner">Carregando comentários...</div>
        ) : (
          <>
            {roots.length === 0 ? (
              <div className="no-comments">Seja o primeiro a comentar</div>
            ) : (
              roots.map(c => renderNode(c))
            )}
          </>
        )}
        <div className="comment-input">
          <input
            type="text"
            placeholder="Escreva um comentário..."
            value={commentInputs[postId] || ''}
            onChange={(e) => setCommentInputs(prev => ({ ...prev, [postId]: e.target.value }))}
          />
          <button className="btn small" onClick={() => addComment(postId, null)}>Comentar</button>
        </div>
      </div>
    );
  };

  const renderPost = (post) => {
    const user = users[post.userId || post.authorId];
    if (!user && !post.authorName) return null;

    const isLiked = (Array.isArray(post.likedBy) ? post.likedBy : []).includes(currentUser?.uid);
    const isFollowing = following.includes(post.userId || post.authorId);
    const isOwnPost = (post.userId || post.authorId) === currentUser?.uid;
    const contentText = post.content || post.text || '';
    const mediaArray = Array.isArray(post.media) ? post.media : (post.imageUrl ? [{ type: 'image', url: post.imageUrl }] : []);

    return (
      <div key={post.id} className="post-card">
        <div className="post-header">
          <div className="post-author">
            <img
              src={post.authorPhotoURL || user?.profilePictureURL || '/images/defpfp1.png'}
              alt={post.authorName || user?.displayName || user?.email}
              className="author-avatar"
              onError={(e) => { e.target.src = '/images/defpfp1.png'; }}
            />
            <div className="author-info">
              <Link to={isOwnPost ? '/profile' : getProfileUrlById(post.userId || post.authorId, post.authorUsername)} className="author-name">
                {post.authorName || user?.displayName || user?.email}
              </Link>
              <span className="post-time">{formatTimeAgo(post.timestamp)}</span>
            </div>
          </div>
          <div className="post-actions">
            {!isOwnPost && (
              <button className={`follow-btn ${isFollowing ? 'following' : ''}`} onClick={() => handleFollow(post.userId || post.authorId)}>
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </button>
            )}
            {isOwnPost && (
              <button className="delete-btn" onClick={() => handleDeletePost(post.id)}>
                ✕
              </button>
            )}
          </div>
        </div>

        {post.isRepost && (
          <div className="repost-indicator">
            <i className="fas fa-retweet"></i>
            <span>
              <Link to={isOwnPost ? '/profile' : getProfileUrlById(post.userId || post.authorId, post.authorUsername)}>
                {post.authorName || user?.displayName || user?.email}
              </Link> repostou
            </span>
          </div>
        )}

        <div className="post-content">
          {contentText && <p>{contentText}</p>}
          {mediaArray.length > 0 && (
            <div className="post-media">
              {mediaArray.map((m, idx) => (
                <React.Fragment key={idx}>
                  {m.type === 'image' && (<img src={m.url} alt="conteúdo" />)}
                  {m.type === 'video' && (<video src={m.url} controls />)}
                  {m.type === 'audio' && (<audio src={m.url} controls />)}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="post-actions">
          <button onClick={() => handleLike(post.id)} className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}>
            <i className={`fas fa-heart ${isLiked ? 'fas' : 'far'}`}></i>
            <span>{post.likes || post.likeCount || 0}</span>
          </button>
          <button className="action-btn share-btn" onClick={() => repostPost(post)}>
            <i className="fas fa-retweet"></i>
            <span>{post.repostCount || 0}</span>
          </button>
          <button className="action-btn comment-toggle" onClick={() => toggleComments(post.id)}>
            <i className="fas fa-comment"></i>
          </button>
        </div>

        {expandedComments[post.id] && renderComments(post.id)}
      </div>
    );
  };

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
          <h1>Feed</h1>
        </div>
      </div>

      <div className="vixies-content">
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
        </div>

        <div className="vixies-sidebar">
          <div className="create-post-section">
            {currentUser ? (
              <PostCreator
                mode="general_feed"
                onPostCreated={() => {}}
                placeholder="O que você está pensando?"
                showAttachment={false}
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
        </div>

        <div className="vixies-feed">
          {getFilteredPosts().length === 0 ? (
            <div className="no-posts">
              <i className="fas fa-stream"></i>
              <h3>Nenhum post encontrado</h3>
              <p>
                {activeTab === 'following'
                  ? 'Você não está seguindo ninguém ainda'
                  : 'Seja o primeiro a compartilhar algo!'}
              </p>
            </div>
          ) : (
            getFilteredPosts().map(renderPost)
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;