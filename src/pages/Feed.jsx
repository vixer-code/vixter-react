import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { sendPostInteractionNotification } from '../services/notificationService';
import { getProfileUrlById } from '../utils/profileUrls';
import { database, firestore } from '../../config/firebase';
import { ref, onValue, off, query, orderByChild, set, update, push, get, remove } from 'firebase/database';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, increment, collection, getDocs } from 'firebase/firestore';
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
  const [activeTab, setActiveTab] = useState('main'); // main | following | myposts
  const [dismissedClientRestriction, setDismissedClientRestriction] = useState(false);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [showReplyInputs, setShowReplyInputs] = useState({});
  const [repostStatus, setRepostStatus] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);

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
        const originalPostId = post.isRepost ? post.originalPostId : post.id;
        try {
          const commentsRef = ref(database, `comments/${originalPostId}`);
          const snap = await get(commentsRef);
          let items = [];
          if (snap.exists()) {
            const val = snap.val();
            items = Object.entries(val).map(([id, c]) => ({ id, ...c }));
            items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          }
          return { postId: originalPostId, items };
        } catch (error) {
          console.error(`Error loading comments for post ${originalPostId}:`, error);
          return { postId: originalPostId, items: [] };
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

  const repostPost = useCallback(async (post) => {
    if (!currentUser) {
      showWarning('Você precisa estar logado para repostar');
      return;
    }

    try {
      // Check if user already reposted this post
      const postRepostsRef = ref(database, `generalReposts/${post.id}/${currentUser.uid}`);
      const snap = await get(postRepostsRef).catch(() => null);
      
      if (snap && snap.exists()) {
        // User already reposted - remove the repost (unrepost)
        await remove(postRepostsRef);
        
        // Find and remove the repost from posts collection
        const postsRef = ref(database, 'posts');
        const postsSnapshot = await get(postsRef);
        const posts = postsSnapshot.val() || {};
        
        let repostToDelete = null;
        for (const [postId, postData] of Object.entries(posts)) {
          if (postData.isRepost && 
              postData.userId === currentUser.uid && 
              postData.originalPostId === post.id) {
            repostToDelete = postId;
            break;
          }
        }
        
        if (repostToDelete) {
          await remove(ref(database, `posts/${repostToDelete}`));
        }
        
        // Update repost status in state
        setRepostStatus(prev => ({
          ...prev,
          [post.id]: false
        }));
        
        // Update original post repost count
        const originalPostRef = ref(database, `posts/${post.id}`);
        const originalPostSnap = await get(originalPostRef);
        if (originalPostSnap.exists()) {
          const originalData = originalPostSnap.val();
          const newRepostCount = Math.max(0, (originalData.repostCount || 0) - 1);
          await update(originalPostRef, { repostCount: newRepostCount });
        }

        showSuccess('Repost removido com sucesso!');
        return;
      }

      // Create repost data - compatible with profile page
      const repostData = {
        // Profile-compatible fields
        userId: currentUser.uid,
        text: post.content || post.text || '', // Use original content for profile compatibility
        imageUrl: post.imageUrl || (post.media?.[0]?.type === 'image' ? post.media[0].url : null),
        createdAt: Date.now(),
        timestamp: Date.now(),
        
        // Repost-specific fields
        isRepost: true,
        originalPostId: post.id,
        originalAuthorId: post.userId || post.authorId,
        originalAuthorName: post.authorName || post.userName,
        originalAuthorPhotoURL: post.authorPhotoURL || post.userPhotoURL,
        originalAuthorUsername: post.authorUsername || post.username,
        originalContent: post.content || post.text || '',
        originalMedia: post.media || (post.imageUrl ? [{ type: 'image', url: post.imageUrl }] : null),
        originalTimestamp: post.timestamp || post.createdAt,
        
        // Interaction fields
        likes: {},
        likeCount: 0,
        repostCount: 0
      };

      // Save repost to posts collection
      const repostRef = ref(database, 'posts');
      await push(repostRef, repostData);
      
      // Mark as reposted by this user
      await set(postRepostsRef, Date.now());
      
      // Update repost status in state
      setRepostStatus(prev => ({
        ...prev,
        [post.id]: true
      }));
      
      // Update original post repost count
      const originalPostRef = ref(database, `posts/${post.id}`);
      const originalPostSnap = await get(originalPostRef);
      if (originalPostSnap.exists()) {
        const originalData = originalPostSnap.val();
        const newRepostCount = (originalData.repostCount || 0) + 1;
        await update(originalPostRef, { repostCount: newRepostCount });
      }

      // Send notification to original post author
      const userProfile = users[currentUser.uid];
      const actorName = userProfile?.displayName || currentUser.displayName || 'Usuário';
      const actorUsername = userProfile?.username || '';
      
      await sendPostInteractionNotification(
        post.userId || post.authorId,
        currentUser.uid,
        actorName,
        actorUsername,
        'repost',
        post.id,
        post.content || post.text || ''
      );

      showSuccess('Post repostado com sucesso!');
    } catch (error) {
      console.error('Error reposting:', error);
      showError('Erro ao repostar conteúdo: ' + error.message);
    }
  }, [currentUser, showSuccess, showError, showInfo, showWarning]);

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

  const checkRepostStatus = useCallback(async (postId) => {
    if (!currentUser?.uid) return false;
    
    try {
      const repostRef = ref(database, `generalReposts/${postId}/${currentUser.uid}`);
      const snapshot = await get(repostRef);
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking repost status:', error);
      return false;
    }
  }, [currentUser?.uid]);

  // Load repost status for all posts
  useEffect(() => {
    if (!currentUser?.uid || posts.length === 0) return;

    const loadRepostStatus = async () => {
      const statusPromises = posts.map(async (post) => {
        const originalPostId = post.isRepost ? post.originalPostId : post.id;
        const isReposted = await checkRepostStatus(originalPostId);
        return { postId: originalPostId, isReposted };
      });

      const results = await Promise.all(statusPromises);
      const newRepostStatus = {};
      results.forEach(({ postId, isReposted }) => {
        newRepostStatus[postId] = isReposted;
      });
      setRepostStatus(newRepostStatus);
    };

    loadRepostStatus();
  }, [posts, currentUser?.uid, checkRepostStatus]);

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

  const getFilteredPosts = () => {
    if (activeTab === 'following') {
      return posts.filter(post => following.includes(post.userId || post.authorId));
    }
    if (activeTab === 'myposts') {
      return posts.filter(post => (post.userId || post.authorId) === currentUser?.uid);
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
            <i className="fas fa-heart"></i>
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
            <button className="btn small" onClick={() => addComment(postId, comment.id)}>Enviar</button>
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
          <button className="btn small" onClick={() => addComment(postId, null)}>Comentar</button>
        </div>
      </div>
    );
  };

  const renderPost = (post) => {
    const user = users[post.userId || post.authorId];
    if (!user && !post.authorName) return null;

    const isRepost = post.isRepost;
    const originalPostId = isRepost ? post.originalPostId : post.id;
    
    // For reposts, show as post from reposter but with original content
    const displayPost = isRepost ? {
      ...post,
      // Keep reposter info for header
      authorId: post.userId,
      authorName: post.authorName || user?.displayName || user?.email,
      authorPhotoURL: post.authorPhotoURL || user?.profilePictureURL || '/images/defpfp1.png',
      authorUsername: post.authorUsername || user?.username,
      // Use original content for display (override the text field for profile compatibility)
      content: post.originalContent,
      text: post.originalContent,
      media: post.originalMedia,
      imageUrl: post.originalMedia?.[0]?.url,
      // Use original timestamp for content
      originalTimestamp: post.originalTimestamp,
      // Use original post data for interactions
      likes: post.likes,
      likeCount: post.likeCount,
      repostCount: post.repostCount
    } : post;

    const isLiked = displayPost.likes && displayPost.likes[currentUser?.uid];
    const isReposted = repostStatus[originalPostId] || false;
    const isFollowing = following.includes(displayPost.userId || displayPost.authorId);
    const isOwnPost = (post.userId || post.authorId) === currentUser?.uid;
    const contentText = displayPost.content || displayPost.text || '';
    const mediaArray = Array.isArray(displayPost.media) ? displayPost.media : (displayPost.imageUrl ? [{ type: 'image', url: displayPost.imageUrl }] : []);

    return (
      <div key={post.id} className="post-card">
        {isRepost && (
          <div className="repost-indicator">
            <i className="fas fa-retweet"></i>
            <span>
              <Link to={isOwnPost ? '/profile' : getProfileUrlById(post.userId || post.authorId, post.authorUsername)}>
                {post.authorName || user?.displayName || user?.email}
              </Link> repostou
            </span>
          </div>
        )}

        <div className="post-header">
          <div className="post-author">
            <img
              src={displayPost.authorPhotoURL || user?.profilePictureURL || '/images/defpfp1.png'}
              alt={displayPost.authorName || user?.displayName || user?.email}
              className="author-avatar"
              onError={(e) => { e.target.src = '/images/defpfp1.png'; }}
            />
            <div className="author-info">
              <Link to={isOwnPost ? '/profile' : getProfileUrlById(displayPost.userId || displayPost.authorId, displayPost.authorUsername)} className="author-name">
                {displayPost.authorName || user?.displayName || user?.email}
              </Link>
              <span className="post-time">{formatTimeAgo(isRepost ? post.timestamp : displayPost.timestamp)}</span>
            </div>
          </div>
          <div className="post-actions">
            {!isOwnPost && (
              <button className={`follow-btn ${isFollowing ? 'following' : ''}`} onClick={() => handleFollow(displayPost.userId || displayPost.authorId)}>
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
          {contentText && <p>{contentText}</p>}
          {mediaArray.length > 0 && (
            <div className="post-media">
              {mediaArray.map((m, idx) => (
                <React.Fragment key={idx}>
                  {m.type === 'image' && (
                    <img
                      src={m.url}
                      alt="Post content"
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
          <button onClick={() => handleLike(originalPostId)} className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}>
            <i className={`fas fa-heart ${isLiked ? 'fas' : 'far'}`}></i>
            <span>{displayPost.likeCount || Object.keys(displayPost.likes || {}).length || 0}</span>
          </button>
          <button 
            className={`action-btn share-btn ${isReposted ? 'reposted' : ''}`} 
            onClick={() => repostPost(displayPost)}
            title={isReposted ? 'Remover repost' : 'Repostar'}
          >
            <i className="fas fa-retweet"></i>
            <span>{displayPost.repostCount || 0}</span>
          </button>
          <button className="action-btn comment-toggle" onClick={() => toggleComments(originalPostId)}>
            <i className="fas fa-comment"></i>
            <span>{commentsByPost[originalPostId]?.items?.length || 0}</span>
          </button>
        </div>

        {expandedComments[originalPostId] && renderComments(originalPostId)}
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
          <button 
            className={`tab-btn ${activeTab === 'myposts' ? 'active' : ''}`}
            onClick={() => setActiveTab('myposts')}
          >
            Meus posts
          </button>
        </div>

        {/* PostCreator moved to top of feed */}
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

        <div className="vixies-feed">
          {getFilteredPosts().length === 0 ? (
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
      </div>
    </div>
  );
};

export default Feed;