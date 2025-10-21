import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useBlock } from '../contexts/BlockContext';
import { useNotification } from '../contexts/NotificationContext';
import { sendPostInteractionNotification } from '../services/notificationService';
import { getProfileUrlById } from '../utils/profileUrls';
import useKycStatus from '../hooks/useKycStatus';
import { database, firestore } from '../../config/firebase';
import { ref, onValue, off, query, orderByChild, set, update, push, get, remove } from 'firebase/database';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, increment, collection, getDocs } from 'firebase/firestore';
import { Link, useSearchParams } from 'react-router-dom';
import PostCreator from '../components/PostCreator';
import MediaViewer from '../components/MediaViewer';
import AnnouncementsTab from '../components/AnnouncementsTab';
import UserBadge from '../components/UserBadge';
import EloBadge from '../components/EloBadge';
import ExpandableText from '../components/ExpandableText';
import './Feed.css';

const Feed = () => {
  const { currentUser } = useAuth();
  const { userProfile, getUserById } = useUser();
  const { hasBlockBetween } = useBlock();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  const { isKycVerified } = useKycStatus();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('main'); // main | following | myposts | announcements
  const [dismissedClientRestriction, setDismissedClientRestriction] = useState(false);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [showReplyInputs, setShowReplyInputs] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaToView, setMediaToView] = useState(null);

  useEffect(() => {
    // Check URL parameters for tab
    const tabParam = searchParams.get('tab');
    if (tabParam && ['main', 'following', 'myposts', 'announcements'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

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

    // Load following list from Firestore
    if (currentUser?.uid) {
      const loadFollowing = async () => {
        try {
          const followingCollection = collection(firestore, 'users', currentUser.uid, 'following');
          const followingSnapshot = await getDocs(followingCollection);
          
          const followingIds = [];
          followingSnapshot.forEach((doc) => {
            followingIds.push(doc.id);
          });
          
          setFollowing(followingIds);
        } catch (error) {
          console.error('Error loading following:', error);
          setFollowing([]);
        }
      };
      
      loadFollowing();
    }

    return () => {
      if (postsUnsubscribe) postsUnsubscribe();
      if (usersUnsubscribe) usersUnsubscribe();
      if (followingUnsubscribe) followingUnsubscribe();
    };
  }, [currentUser?.uid]);

  // Load comment counts for all posts automatically
  useEffect(() => {
    if (posts.length === 0) return;

    const loadAllCommentCounts = async () => {
      const commentPromises = posts.map(async (post) => {
        try {
          const commentsRef = ref(database, `comments/${post.id}`);
          const snap = await get(commentsRef);
          let items = [];
          if (snap.exists()) {
            const val = snap.val();
            items = Object.entries(val).map(([id, c]) => ({ id, ...c }));
            items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          }
          return { postId: post.id, items };
        } catch (error) {
          console.error(`Error loading comments for post ${post.id}:`, error);
          return { postId: post.id, items: [] };
        }
      });

      const commentResults = await Promise.all(commentPromises);
      const newCommentsByPost = {};
      commentResults.forEach(({ postId, items }) => {
        newCommentsByPost[postId] = { items, loading: false };
      });
      setCommentsByPost(newCommentsByPost);
    };

    loadAllCommentCounts();
  }, [posts]);

  const handleLike = useCallback(async (postId) => {
    if (!currentUser?.uid) {
      showWarning('Você precisa estar logado para curtir posts');
      return;
    }

    try {
      const postRef = ref(database, `posts/${postId}`);
      const postSnapshot = await get(postRef);
      
      if (!postSnapshot.exists()) {
        showError('Post não encontrado');
        return;
      }

      const post = postSnapshot.val();
      const likes = post.likes || {};
      const isLiked = likes[currentUser.uid];

      if (isLiked) {
        // Unlike
        const newLikes = { ...likes };
        delete newLikes[currentUser.uid];
        await update(postRef, {
          likes: newLikes,
          likeCount: Math.max(0, (post.likeCount || 0) - 1)
        });
      } else {
        // Like
        const newLikes = { ...likes, [currentUser.uid]: true };
        await update(postRef, {
          likes: newLikes,
          likeCount: (post.likeCount || 0) + 1
        });

        // Send notification to post author
        const userProfile = users[post.authorId];
        const actorName = userProfile?.displayName || currentUser.displayName || 'Usuário';
        const actorUsername = userProfile?.username || '';
        
        await sendPostInteractionNotification(
          post.authorId,
          currentUser.uid,
          actorName,
          actorUsername,
          'like',
          postId,
          post.content || post.text || ''
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      showError('Erro ao curtir post: ' + error.message);
    }
  }, [currentUser?.uid, showError, showWarning]);

  const handleFollow = useCallback(async (userId) => {
    if (!currentUser?.uid || userId === currentUser.uid) return;

    try {
      const isFollowing = following.includes(userId);
      
      // Get references to the documents
      const followerRef = doc(firestore, 'users', userId, 'followers', currentUser.uid);
      const followingRef = doc(firestore, 'users', currentUser.uid, 'following', userId);
      const targetUserDocRef = doc(firestore, 'users', userId);
      const currentUserDocRef = doc(firestore, 'users', currentUser.uid);
      
      // Check if user documents exist first
      const [targetUserDoc, currentUserDoc] = await Promise.all([
        getDoc(targetUserDocRef),
        getDoc(currentUserDocRef)
      ]);
      
      const batch = writeBatch(firestore);
      
      if (isFollowing) {
        // Unfollow
        batch.delete(followerRef);
        batch.delete(followingRef);
        
        // Only update counts if documents exist
        if (targetUserDoc.exists()) {
          batch.update(targetUserDocRef, { 
            followersCount: increment(-1), 
            updatedAt: new Date() 
          });
        }
        if (currentUserDoc.exists()) {
          batch.update(currentUserDocRef, { 
            followingCount: increment(-1), 
            updatedAt: new Date() 
          });
        }
        
        await batch.commit();
        setFollowing(prevFollowing => prevFollowing.filter(id => id !== userId));
        showSuccess('Deixou de seguir');
      } else {
        // Follow
        batch.set(followerRef, { followedAt: Date.now(), followerId: currentUser.uid });
        batch.set(followingRef, { followedAt: Date.now(), followingId: userId });
        
        // Only update counts if documents exist
        if (targetUserDoc.exists()) {
          batch.update(targetUserDocRef, { 
            followersCount: increment(1), 
            updatedAt: new Date() 
          });
        }
        if (currentUserDoc.exists()) {
          batch.update(currentUserDocRef, { 
            followingCount: increment(1), 
            updatedAt: new Date() 
          });
        }
        
        await batch.commit();
        setFollowing(prevFollowing => [...prevFollowing, userId]);
        showSuccess('Agora você está seguindo');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      showError('Erro ao seguir/parar de seguir: ' + error.message);
    }
  }, [currentUser?.uid, following, showSuccess, showError]);

  const handleDeletePost = useCallback((postId) => {
    if (!currentUser?.uid) return;
    
    // Find the post to get its content for confirmation
    const post = posts.find(p => p.id === postId);
    if (post) {
      setPostToDelete({ id: postId, content: post.content });
      setShowDeleteModal(true);
    }
  }, [currentUser?.uid, posts]);

  const confirmDeletePost = useCallback(async () => {
    if (!postToDelete || !currentUser?.uid) return;
    
    try {
      const postRef = ref(database, `posts/${postToDelete.id}`);
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
    } finally {
      setShowDeleteModal(false);
      setPostToDelete(null);
    }
  }, [postToDelete, currentUser?.uid, showSuccess, showError]);

  const cancelDeletePost = useCallback(() => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  }, []);


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

  const toggleReplyInput = useCallback((postId, commentId) => {
    const key = `${postId}:${commentId}`;
    setShowReplyInputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);



  const updateInput = useCallback((key, text) => {
    setCommentInputs(prev => ({ ...prev, [key]: text }));
  }, []);

  const addComment = useCallback(async (postId, parentId = null) => {
    if (!currentUser) return;
    
    // Check if post author is blocked
    const post = posts.find(p => p.id === postId);
    if (post) {
      const authorId = post.userId || post.authorId;
      if (authorId && hasBlockBetween(authorId)) {
        showError('Não é possível comentar em posts de usuários bloqueados');
        return;
      }
    }
    
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

      // Send notification to post author (only for top-level comments, not replies)
      if (!parentId) {
        // Get post data to find the author
        const postRef = ref(database, `posts/${postId}`);
        const postSnap = await get(postRef);
        if (postSnap.exists()) {
          const postData = postSnap.val();
          const actorName = userProfile?.displayName || userProfile?.name || 'Usuário';
          const actorUsername = userProfile?.username || '';
          
          await sendPostInteractionNotification(
            postData.userId || postData.authorId,
            currentUser.uid,
            actorName,
            actorUsername,
            'comment',
            postId,
            postData.content || postData.text || '',
            text
          );
        }
      }
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

  const handleOpenMediaViewer = (mediaUrl, mediaType, caption = '') => {
    setMediaToView({ url: mediaUrl, type: mediaType, caption });
    setShowMediaViewer(true);
  };

  const getFilteredPosts = () => {
    let filtered = posts;
    
    // Filter out posts from blocked users
    filtered = filtered.filter(post => {
      const authorId = post.userId || post.authorId;
      return authorId && !hasBlockBetween(authorId);
    });
    
    // Filter out adult content if user doesn't have KYC verified
    filtered = filtered.filter(post => {
      if (post.isAdultContent && !isKycVerified) {
        return false; // Hide adult content for non-KYC users
      }
      return true;
    });
    
    if (activeTab === 'following') {
      return filtered.filter(post => following.includes(post.userId || post.authorId));
    }
    if (activeTab === 'myposts') {
      return filtered.filter(post => (post.userId || post.authorId) === currentUser?.uid);
    }
    return filtered;
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
          <div className="comment-author">
            <img 
              src={comment.authorPhotoURL || '/images/defpfp1.png'} 
              alt={comment.authorName} 
              className="comment-avatar"
              onError={(e) => { e.target.src = '/images/defpfp1.png'; }}
            />
            <div className="comment-info">
              <span className="comment-author-name">{comment.authorName}</span>
              <span className="comment-time">{formatTimeAgo(comment.timestamp)}</span>
            </div>
          </div>
          {comment.authorId === currentUser?.uid && (
            <button className="comment-delete-btn" onClick={() => deleteComment(postId, comment)}>
              ✕
            </button>
          )}
        </div>
        <div className="comment-content">{comment.content}</div>
        <div className="comment-actions">
          <button className={`comment-action-btn like-btn ${comment.likedBy?.includes(currentUser?.uid) ? 'liked' : ''}`} onClick={() => likeComment(postId, comment)}>
            <span className="pumpkin-icon">🎃</span>
            <span>{comment.likes || 0}</span>
          </button>
          <button className="comment-action-btn reply-btn" onClick={() => toggleReplyInput(postId, comment.id)}>
            <i className="fas fa-reply"></i>
          </button>
        </div>
        {showReplyInputs[`${postId}:${comment.id}`] && (
          <div className="comment-reply">
            <input
              type="text"
              placeholder="Responder..."
              value={commentInputs[`${postId}:${comment.id}`] || ''}
              onChange={(e) => setCommentInputs(prev => ({ ...prev, [`${postId}:${comment.id}`]: e.target.value }))}
            />
            <button className="btn small send-btn" onClick={() => addComment(postId, comment.id)} title="Enviar">
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        )}
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
          <button className="btn small comment-btn" onClick={() => addComment(postId, null)} title="Comentar">
            <i className="fas fa-comment"></i>
          </button>
        </div>
      </div>
    );
  };

  // Função para carregar dados completos do usuário se necessário
  const loadUserDataIfNeeded = useCallback(async (userId) => {
    if (!userId || users[userId]?.stats?.xp !== undefined) return;
    
    try {
      const userData = await getUserById(userId);
      if (userData) {
        setUsers(prev => ({
          ...prev,
          [userId]: userData
        }));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [users, getUserById]);

  const renderPost = (post) => {
    const isCurrentUser = currentUser && (post.userId || post.authorId) === currentUser.uid;
    const userId = post.userId || post.authorId;
    const user = isCurrentUser ? userProfile : (users[userId] || {});
    
    // Carregar dados completos do usuário se necessário
    if (!isCurrentUser && userId && (!user.stats || user.stats.xp === undefined)) {
      loadUserDataIfNeeded(userId);
    }
    
    if (!user && !post.authorName) return null;

    const isLiked = post.likes && post.likes[currentUser?.uid];
    const isFollowing = following.includes(post.userId || post.authorId);
    const isOwnPost = (post.userId || post.authorId) === currentUser?.uid;
    const contentText = post.content || post.text || '';
    const mediaArray = Array.isArray(post.media) ? post.media : (post.imageUrl ? [{ type: 'image', url: post.imageUrl }] : []);

    return (
      <div key={post.id} className="post-card">
        <div className="post-header">
          <div className="post-author">
            <img
              src={(() => {
                const photoURL = post.authorPhotoURL || user?.profilePictureURL;
                // Validate URL before using it
                if (photoURL && typeof photoURL === 'string' && photoURL.trim()) {
                  try {
                    // Test if URL is valid
                    new URL(photoURL);
                    return photoURL;
                  } catch (urlError) {
                    console.warn('Invalid author photo URL in feed:', photoURL, urlError);
                  }
                }
                return '/images/defpfp1.png';
              })()}
              alt={post.authorName || user?.displayName || user?.email}
              className="author-avatar"
              onError={(e) => { e.target.src = '/images/defpfp1.png'; }}
            />
            <div className="author-info">
              <div className="author-name-container">
                <Link to={isOwnPost ? '/profile' : getProfileUrlById(post.userId || post.authorId, post.authorUsername)} className="author-name">
                  {post.authorName || user?.displayName || user?.email}
                </Link>
                <UserBadge user={user} />
                <EloBadge userXp={user?.stats?.xp || user?.xp} size="compact" />
                {post.isAdultContent && isKycVerified && (
                  <span className="adult-content-badge">
                    <i className="fas fa-exclamation-triangle"></i>
                    +18
                  </span>
                )}
              </div>
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

        <div className="post-content">
          {contentText && (
            <ExpandableText 
              text={contentText} 
              maxLines={3}
              className="post-text-content"
            />
          )}
          {mediaArray.length > 0 && (
            <div className="post-media">
              {mediaArray.map((m, idx) => (
                <React.Fragment key={idx}>
                  {m.type === 'image' && (
                    <img
                      src={m.url}
                      alt="Post content"
                      className="post-image"
                      onClick={() => handleOpenMediaViewer(m.url, 'image', contentText)}
                      onError={(e) => { e.target.style.display = 'none'; }}
                      style={{ cursor: 'pointer' }}
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
                  {m.type === 'audio' && (
                    <audio
                      src={m.url}
                      controls
                      className="post-audio"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="post-actions">
          <button onClick={() => handleLike(post.id)} className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}>
            <span className="pumpkin-icon">🎃</span>
            <span>{post.likeCount || Object.keys(post.likes || {}).length || 0}</span>
          </button>
          <button className="action-btn comment-toggle" onClick={() => toggleComments(post.id)}>
            <i className="fas fa-comment"></i>
            <span>{commentsByPost[post.id]?.items?.length || 0}</span>
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
    <div className="feed-page">
      <div className="vixies-container">
      <div className="vixies-header">
        <div className="vixies-title">
          <h1 data-text="Lobby">Lobby</h1>
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
            {currentUser && (
              <button 
                className={`tab-btn tab-btn-myposts ${activeTab === 'myposts' ? 'active' : ''}`}
                onClick={() => setActiveTab('myposts')}
              >
                Meus posts
              </button>
            )}
          </div>
          {/* Botão separado para mobile */}
          {currentUser && (
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
        )}

        <div className="vixies-feed">
          {activeTab === 'announcements' ? (
            <AnnouncementsTab feedType="lobby" />
          ) : getFilteredPosts().length === 0 ? (
            <div className="no-posts">
              <i className="fas fa-stream"></i>
              <h3>Nenhum post encontrado</h3>
              <p>
                {activeTab === 'following'
                  ? 'Você não está seguindo ninguém ainda'
                  : activeTab === 'myposts'
                  ? 'Você ainda não fez nenhum post'
                  : 'Seja o primeiro a compartilhar algo!'}
              </p>
            </div>
          ) : (
            getFilteredPosts().map(renderPost)
          )}
        </div>
      </div>

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

export default Feed;