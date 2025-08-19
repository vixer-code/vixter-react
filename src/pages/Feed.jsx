import React, { useEffect, useMemo, useState } from 'react';
import {
  ref,
  get,
  set,
  remove,
  push
} from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import CachedImage from '../components/CachedImage';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import './Feed.css';

function extractHashTags(text) {
  return (text || '').match(/#(\w+)/g)?.map(t => t.replace('#', '')) || [];
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Agora';
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);
  if (diff < 60) return 'Agora mesmo';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  const d = new Date(timestamp);
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function formatExactDateTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const Feed = () => {
  const { currentUser } = useAuth();

  const [currentTab, setCurrentTab] = useState('recent');
  const [allPosts, setAllPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [trending, setTrending] = useState([]);
  const [stars, setStars] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create post modal state
  const [isCreating, setIsCreating] = useState(false);
  const [postText, setPostText] = useState('');
  const [postFile, setPostFile] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);

  useEffect(() => {
    loadInitial();
    const interval = setInterval(buildCommunityStars, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Recompute filters/trending when tab or posts change
    filterAndDecorate(currentTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, allPosts]);

  async function loadInitial() {
    setLoading(true);
    try {
      await Promise.all([loadPosts(), buildCommunityStars()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    // TODO: Load posts from Firestore instead of RTDB
    console.log('🚧 Posts will be loaded from Firestore in the next update');
    setAllPosts([]);
  }

  async function ensureUsersLoaded(userIds) {
    // TODO: Load users from Firestore UserContext
    console.log('🚧 User data will be loaded from UserContext/Firestore');
    setUsers({});
  }

  async function filterAndDecorate(tab) {
    // TODO: Implement filtering with Firestore posts and Firestore followers
    console.log('🚧 Post filtering will be implemented with Firestore data');
    setFilteredPosts([]);
    setTrending([]);
  }

  async function buildCommunityStars() {
    // TODO: Build community stars from Firestore followers analytics
    console.log('🚧 Community stars will be built from Firestore analytics');
    setStars([]);
  }

  async function handlePublish() {
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }
    const content = postText.trim();
    if (!content && !postFile) return;
    
    // TODO: Implement via Cloud Function createPost
    alert('🚧 Criação de posts será implementada via Cloud Functions em breve!');
    setIsCreating(false);
    setPostText('');
    setPostFile(null);
  }

  async function toggleLike(postId, liked) {
    if (!currentUser) return;
    // TODO: Implement via Cloud Function togglePostLike
    alert('🚧 Likes serão implementados via Cloud Functions em breve!');
  }

  async function deletePost(postId) {
    if (!currentUser) {
      console.log('No current user found');
      return;
    }
    
    console.log('Current user:', currentUser.uid);
    console.log('Attempting to delete post:', postId);
    
    // Find the post to show its content in the modal
    const post = allPosts.find(p => p.id === postId);
    if (post) {
      console.log('Found post to delete:', post);
      console.log('Post author ID:', post.userId);
      console.log('Current user ID:', currentUser.uid);
      console.log('Can delete?', post.userId === currentUser.uid);
      
      setPostToDelete({ id: postId, content: post.content });
      setShowDeleteModal(true);
    } else {
      console.log('Post not found in local state');
    }
  }

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    
    // TODO: Implement via Cloud Function deletePost
    alert('🚧 Exclusão de posts será implementada via Cloud Functions em breve!');
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const cancelDeletePost = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const postsWithAuthors = useMemo(() => {
    return filteredPosts.map(p => ({
      ...p,
      author: users[p.userId] || {}
    }));
  }, [filteredPosts, users]);

  if (loading) {
    return (
      <div className="feed-container">
        <div className="loading-spinner">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1>Comunidade Vixter</h1>
        <p>Publicações da comunidade, contas oficiais e pessoas que você segue</p>
      </div>

      <div className="feed-tabs">
        <button
          className={`tab-btn ${currentTab === 'recent' ? 'active' : ''}`}
          onClick={() => setCurrentTab('recent')}
        >
          Recentes
        </button>
        <button
          className={`tab-btn ${currentTab === 'following' ? 'active' : ''}`}
          onClick={() => setCurrentTab('following')}
        >
          Seguindo
        </button>
        <button
          className={`tab-btn ${currentTab === 'official' ? 'active' : ''}`}
          onClick={() => setCurrentTab('official')}
        >
          Oficial
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 20 }}>
        {/* Left sidebar */}
        <aside className="left-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="sidebar-card all-games" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
            <button className="search-btn" style={{ width: '100%' }} onClick={() => (currentUser ? setIsCreating(true) : (window.location.href = '/login'))}>
              Criar Publicação
            </button>
          </div>

          <div className="sidebar-card" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Tópicos em Alta</h2>
            <div className="trend-topics" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {trending.length === 0 ? (
                <span className="hashtag">Sem tendências</span>
              ) : (
                trending.map(tag => (
                  <span key={tag} className="hashtag" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 10px' }}>#{tag}</span>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          <div className="posts-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {postsWithAuthors.length === 0 && (
              <div className="no-results"><p>Nenhuma publicação disponível.</p></div>
            )}

            {postsWithAuthors.map(post => {
              const likesObj = post.likes || {};
              const likeCount = Object.keys(likesObj).length;
              const liked = currentUser ? !!likesObj[currentUser.uid] : false;
              const author = post.author || {};
              const ts = post.timestamp || post.createdAt;
              return (
                <div key={post.id} className="post-card" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
                                      <div className="post-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div className="post-author-avatar" style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden' }}>
                        <CachedImage src={author.profilePictureURL} defaultType="PROFILE_1" alt={author.displayName || 'Usuário'} showLoading={false} />
                      </div>
                      <div className="post-meta" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="post-author-name" style={{ fontWeight: 600 }}>{author.displayName || 'Usuário'}</div>
                        <div className="post-date" title={new Date(ts).toLocaleString('pt-BR')} style={{ color: '#B8B8B8', fontSize: 12 }}>
                          {formatTimeAgo(ts)} · {formatExactDateTime(ts)}
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {currentUser && currentUser.uid === post.userId && (
                          <button
                            className="delete-post-btn"
                            onClick={() => deletePost(post.id)}
                            title="Excluir publicação"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ff4757',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              opacity: 0.8
                            }}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        )}
                        <div style={{ opacity: 0.7 }}>
                          <i className="fa-solid fa-ellipsis"></i>
                        </div>
                      </div>
                    </div>

                  <div className="post-content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(post.content || '').trim() && <p style={{ whiteSpace: 'pre-wrap', color: '#DDD' }}>{post.content}</p>}
                    {Array.isArray(post.images) && post.images.length > 0 && (
                      <div className="post-image-container" style={{ borderRadius: 12, overflow: 'hidden' }}>
                        <CachedImage src={post.images[0]} alt="Imagem da publicação" className="post-image" showLoading={false} />
                      </div>
                    )}
                    {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
                      <div className="post-hashtags" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {post.hashtags.map(tag => (
                          <span key={tag} className="hashtag" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 10px' }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="post-actions" style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
                    <button
                      className="action-button like-button"
                      onClick={() => toggleLike(post.id, liked)}
                      style={{ background: 'transparent', border: 'none', color: liked ? '#e83f5b' : '#fff', cursor: 'pointer' }}
                    >
                      <i className={`${liked ? 'fas' : 'far'} fa-heart`} /> {likeCount}
                    </button>
                    <button className="action-button" style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.8 }}>
                      <i className="far fa-comment" /> {typeof post.comments === 'object' ? Object.keys(post.comments).length : (post.comments || 0)}
                    </button>
                    <button className="action-button" style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.8 }}>
                      <i className="far fa-share-square" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="right-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="sidebar-card community-stars" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Estrelas da Comunidade</h2>
            {stars.map(s => (
              <div key={s.id} className="star-user" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="star-user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CachedImage src={s.profilePictureURL} defaultType="PROFILE_2" alt={s.displayName || 'Usuário'} className="star-user-avatar" showLoading={false} />
                  <div className="star-user-details">
                    <div className="star-user-name" style={{ fontWeight: 600 }}>
                      {s.displayName || 'Usuário'} <i className="fas fa-star" style={{ color: '#ffc107' }}></i>
                    </div>
                    <div className="star-user-followers" style={{ color: '#B8B8B8' }}>Seguidores: {s.totalFollowers}</div>
                  </div>
                </div>
                <div className="game-badges" style={{ display: 'flex', gap: 8 }}>
                  {s.accountLevel && <span className="game-badge" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '3px 8px' }}>{s.accountLevel}</span>}
                  {s.location && <span className="game-badge" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '3px 8px' }}>{s.location}</span>}
                </div>
              </div>
            ))}
            {stars.length === 0 && <div style={{ color: '#B8B8B8' }}>Sem destaques ainda</div>}
          </div>
        </aside>
      </div>

      {/* Create Post Modal */}
      {isCreating && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal" style={{ background: '#fff', color: '#111', borderRadius: 12, padding: 16, width: '92%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Criar Publicação</h2>
            <textarea
              value={postText}
              onChange={e => setPostText(e.target.value)}
              placeholder="O que você está pensando?"
              maxLength={280}
              style={{ minHeight: 120, padding: 8, fontSize: 14 }}
            />
            <input type="file" accept="image/*" onChange={e => setPostFile(e.target.files?.[0] || null)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setIsCreating(false)}>Cancelar</button>
              <button className="search-btn" disabled={isPublishing} onClick={handlePublish}>
                {isPublishing ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDeletePost}
        onConfirm={confirmDeletePost}
        postContent={postToDelete?.content}
      />
    </div>
  );
};

export default Feed;

 
