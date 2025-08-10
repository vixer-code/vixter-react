import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { ref, get, update, set, remove, onValue, off } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultImage } from '../utils/defaultImages';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { useServices } from '../hooks/useServices';
import StatusIndicator from '../components/StatusIndicator';
const CreateServiceModal = lazy(() => import('../components/CreateServiceModal'));
const CreatePackModal = lazy(() => import('../components/CreatePackModal'));
import CachedImage from '../components/CachedImage';
import './Profile.css';

const Profile = () => {
  const { userId } = useParams();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { isVerified, isChecking } = useEmailVerification();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('perfil');
  const [followers, setFollowers] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  // userStatus state removed; StatusIndicator handles it internally now
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  // subscriptions not yet rendered; keep local fetch but no state to avoid blocking render
  const [reviews, setReviews] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [showCreatePackModal, setShowCreatePackModal] = useState(false);
  const [editingPack, setEditingPack] = useState(null);

  // Feature switch: use in-app media API instead of Firebase Storage direct upload
  const useMediaApi = (import.meta?.env?.VITE_USE_MEDIA_API === 'true');

  // Client-side conversion for uploads (not LCP-critical)
  const convertImageToWebP = async (file, targetWidth) => {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, targetWidth / bitmap.width);
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
      return blob || file;
    } catch {
      return file;
    }
  };

  // Read cached profile early to reduce LCP resource delay
  useEffect(() => {
    const targetUserId = userId || currentUser?.uid;
    if (!targetUserId) return;
    try {
      const cached = localStorage.getItem(`profile:${targetUserId}`);
      if (cached) {
        const cachedProfile = JSON.parse(cached);
        if (cachedProfile && cachedProfile.coverPhotoURL) {
          // Paint ASAP with cached data
          setProfile(prev => prev || cachedProfile);
          setLoading(false);
        }
      }
    } catch {}
  }, [userId, currentUser]);

  // Services hook
  const { 
    services, 
    loading: servicesLoading, 
    setupServicesListener,
    deleteService, 
    updateServiceStatus 
  } = useServices();

  // Form state for editing
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    location: '',
    website: '',
    twitter: '',
    instagram: '',
    youtube: ''
  });

  useEffect(() => {
    loadProfile();
    return () => {
      // Cleanup listeners
      const userRef = ref(database, `users/${userId || currentUser?.uid}`);
      off(userRef);
    };
  }, [userId, currentUser]);

  // Set up real-time services listener
  useEffect(() => {
    const targetUserId = userId || currentUser?.uid;
    if (targetUserId) {
      const cleanup = setupServicesListener(targetUserId);
      return cleanup;
    }
  }, [userId, currentUser, setupServicesListener]);

  // Set up real-time packs listener
  useEffect(() => {
    const targetUserId = userId || currentUser?.uid;
    if (!targetUserId) return;
    const packsRef = ref(database, `packs/${targetUserId}`);
    setPacksLoading(true);
    onValue(packsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPacks([]);
      } else {
        const packsData = snapshot.val();
        const packsArray = Object.entries(packsData).map(([id, pack]) => ({ id, ...pack }));
        setPacks(packsArray);
      }
      setPacksLoading(false);
    });
    return () => off(packsRef);
  }, [userId, currentUser]);

  // Handle URL hash navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    const validTabs = ['perfil', 'about', 'services', 'packs', 'subscriptions', 'reviews'];
    
    if (hash && validTabs.includes(hash)) {
      setActiveTab(hash);
    } else if (hash === '' && location.pathname.includes('/profile')) {
      // Reset to default tab when no hash is present
      setActiveTab('perfil');
    }
  }, [location.hash, location.pathname]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const targetUserId = userId || currentUser?.uid;
      
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      // Check if current user is blocked
      if (currentUser && currentUser.uid !== targetUserId) {
        const blockedSnap = await get(ref(database, `blocked/${targetUserId}/${currentUser.uid}`));
        if (blockedSnap.exists()) {
          setLoading(false);
          return;
        }
      }

      const userRef = ref(database, `users/${targetUserId}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        setLoading(false);
        return;
      }

      const userData = snapshot.val();
      setProfile(userData);
      // Persist minimal profile to speed up subsequent visits (for LCP)
      try {
        localStorage.setItem(`profile:${targetUserId}`, JSON.stringify({
          displayName: userData.displayName || '',
          username: userData.username || '',
          bio: userData.bio || '',
          location: userData.location || '',
          profilePictureURL: userData.profilePictureURL || null,
          coverPhotoURL: userData.coverPhotoURL || null,
          createdAt: userData.createdAt || null,
          accountLevel: userData.accountLevel || null,
          admin: userData.admin || false
        }));
      } catch {}
      setFormData({
        displayName: userData.displayName || '',
        username: userData.username || '',
        bio: userData.bio || '',
        location: userData.location || '',
        website: userData.website || '',
        twitter: userData.twitter || '',
        instagram: userData.instagram || '',
        youtube: userData.youtube || ''
      });

      // Load critical data first (for LCP), then load secondary data
      setLoading(false); // Allow render with profile data first
      
      // Load less critical data after initial render
      setTimeout(() => {
        Promise.all([
          loadFollowers(targetUserId),
          loadPosts(targetUserId),
           // Status handled by component; remove extra RT listener
           loadPacks(targetUserId),
          loadReviews(targetUserId)
        ]).catch(error => {
          console.error('Error loading additional profile data:', error);
        });
      }, 0);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

  const loadFollowers = async (targetUserId) => {
    try {
      const followersRef = ref(database, `followers/${targetUserId}`);
      const snapshot = await get(followersRef);
      
      if (snapshot.exists()) {
        const followersData = snapshot.val();
        const followerIds = Object.keys(followersData);
        
        // Fetch follower profiles
        const followerPromises = followerIds.map(async (followerId) => {
          const userRef = ref(database, `users/${followerId}`);
          const userSnapshot = await get(userRef);
          if (userSnapshot.exists()) {
            return { id: followerId, ...userSnapshot.val() };
          }
          return null;
        });
        
        const followers = (await Promise.all(followerPromises)).filter(f => f !== null);
        setFollowers(followers);
        
        // Check if current user is following
        if (currentUser) {
          setIsFollowing(followerIds.includes(currentUser.uid));
        }
      }
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  };

  const loadPosts = async (targetUserId) => {
    try {
      const postsRef = ref(database, `posts/${targetUserId}`);
      const snapshot = await get(postsRef);
      
      if (snapshot.exists()) {
        const postsData = snapshot.val();
        const postsArray = Object.entries(postsData).map(([id, post]) => ({
          id,
          ...post
        })).sort((a, b) => b.timestamp - a.timestamp);
        setPosts(postsArray);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  // Removed loadUserStatus: StatusIndicator hook handles presence updates

  const handleServiceCreated = (newService) => {
    // The services hook will automatically update the services list
    console.log('Service created:', newService);
  };

  const handlePackCreated = (newPack) => {
    // Real-time listener will update the packs list
    console.log('Pack created:', newPack);
    setActiveTab('packs');
  };

  const handleEditPack = (pack) => {
    setEditingPack(pack);
    setShowCreatePackModal(true);
  };

  const handleDeletePack = async (packId) => {
    if (!currentUser) return;
    if (window.confirm('Tem certeza que deseja excluir este pack?')) {
      try {
        const packRef = ref(database, `packs/${currentUser.uid}/${packId}`);
        await remove(packRef);
      } catch (error) {
        console.error('Error deleting pack:', error);
        alert('Erro ao excluir pack. Tente novamente.');
      }
    }
  };

  const handlePackStatusChange = async (packId, newStatus) => {
    if (!currentUser) return;
    try {
      const packRef = ref(database, `packs/${currentUser.uid}/${packId}`);
      await update(packRef, { status: newStatus, updatedAt: Date.now() });
    } catch (error) {
      console.error('Error updating pack status:', error);
      alert('Erro ao atualizar status do pack. Tente novamente.');
    }
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setShowCreateServiceModal(true);
  };

  const handleDeleteService = async (serviceId) => {
    if (window.confirm('Tem certeza que deseja excluir este serviço?')) {
      try {
        await deleteService(serviceId);
      } catch (error) {
        console.error('Error deleting service:', error);
        alert('Erro ao excluir serviço. Tente novamente.');
      }
    }
  };

  const handleServiceStatusChange = async (serviceId, newStatus) => {
    try {
      await updateServiceStatus(serviceId, newStatus);
    } catch (error) {
      console.error('Error updating service status:', error);
      alert('Erro ao atualizar status do serviço. Tente novamente.');
    }
  };

  const loadPacks = async (targetUserId) => {
    try {
      const packsRef = ref(database, `packs/${targetUserId}`);
      const snapshot = await get(packsRef);
      
      if (snapshot.exists()) {
        const packsData = snapshot.val();
        const packsArray = Object.entries(packsData).map(([id, pack]) => ({
          id,
          ...pack
        }));
        setPacks(packsArray);
      }
    } catch (error) {
      console.error('Error loading packs:', error);
    }
  };

  // Removed loadSubscriptions state and fetch for now (feature coming soon)

  const loadReviews = async (targetUserId) => {
    try {
      const reviewsRef = ref(database, `reviews/${targetUserId}`);
      const snapshot = await get(reviewsRef);
      
      if (snapshot.exists()) {
        const reviewsData = snapshot.val();
        const reviewsArray = Object.entries(reviewsData).map(([id, review]) => ({
          id,
          ...review
        }));
        setReviews(reviewsArray);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file || !currentUser) return;

    try {
      setUploading(true);
      let finalURL = null;

      if (useMediaApi) {
        const form = new FormData();
        form.append('file', file);
        form.append('type', type === 'avatar' ? 'avatar' : 'cover');
        form.append('userId', currentUser.uid);

        const resp = await fetch('/api/convert', {
          method: 'POST',
          body: form
        });
        if (!resp.ok) throw new Error('Image convert failed');
        const data = await resp.json();
        // Prefer 1440 for cover, else 512 for avatar
        finalURL = (type === 'avatar') ? (data.urls?.[512] || Object.values(data.urls || {})[0]) : (data.urls?.[1440] || data.urls?.[720] || Object.values(data.urls || {})[0]);
      } else {
        // Convert to WebP client-side and upload WebP to Firebase Storage
        const targetWidth = type === 'avatar' ? 512 : 1440;
        const webpBlob = await convertImageToWebP(file, targetWidth);
        const path = type === 'avatar' ? `profilePictures/${currentUser.uid}.webp` : `coverPhotos/${currentUser.uid}.webp`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, webpBlob, {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable'
        });
        finalURL = await getDownloadURL(fileRef);
      }

      const updateData = {};
      updateData[type === 'avatar' ? 'profilePictureURL' : 'coverPhotoURL'] = finalURL;

      await update(ref(database, `users/${currentUser.uid}`), updateData);
      await loadProfile(); // Reload profile to show new image
      
      setUploading(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) return;

    try {
      const targetUserId = userId || currentUser.uid;
      const followRef = ref(database, `followers/${targetUserId}/${currentUser.uid}`);
      
      if (isFollowing) {
        await remove(followRef);
        setIsFollowing(false);
      } else {
        await set(followRef, {
          followedAt: Date.now()
        });
        setIsFollowing(true);
      }
      
      await loadFollowers(targetUserId);
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    try {
      await update(ref(database, `users/${currentUser.uid}`), formData);
      await loadProfile();
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleCancel = () => {
    setFormData({
      displayName: profile?.displayName || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      website: profile?.website || '',
      twitter: profile?.twitter || '',
      instagram: profile?.instagram || '',
      youtube: profile?.youtube || ''
    });
    setEditing(false);
  };

  const handleCreatePost = async () => {
    if (!currentUser || !newPostContent.trim()) return;

    try {
      const postData = {
        content: newPostContent,
        timestamp: Date.now(),
        authorId: currentUser.uid,
        authorName: profile?.displayName || currentUser.displayName,
        authorPhoto: profile?.profilePictureURL || currentUser.photoURL,
        images: selectedImages
      };

      const postsRef = ref(database, `posts/${currentUser.uid}`);
      const newPostRef = ref(postsRef);
      await set(newPostRef, postData);

      setNewPostContent('');
      setSelectedImages([]);
      await loadPosts(currentUser.uid);
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedImages(prev => [...prev, ...files]);
  };

  const renderAccountBadges = () => {
    if (!profile) return null;

    const levelMap = {
      iron: 'iron.png', bronze: 'bronze.png', silver: 'silver.png',
      gold: 'gold.png', platinum: 'platinum.png',
      emerald: 'emerald.png', diamond: 'diamond.png', master: 'master.png'
    };

    const badges = [];
    const levelKey = (profile.accountLevel || '').toLowerCase();
    
    if (levelMap[levelKey]) {
      badges.push({
        src: `/images/${levelMap[levelKey]}`,
        alt: `${profile.accountLevel} badge`,
        label: `Esse usuário é nível ${profile.accountLevel}!`
      });
    }

    if (profile.admin === true) {
      badges.push({
        src: '/images/admin.png',
        alt: 'Admin badge',
        label: 'Esse é um dos nossos administradores!'
      });
    }

    return (
      <div className="account-badges">
        {badges.map((badge, index) => (
          <span key={index} className="badge-icon" data-label={badge.label}>
            <img src={badge.src} alt={badge.alt} />
          </span>
        ))}
      </div>
    );
  };

  const isOwner = currentUser?.uid === (userId || currentUser?.uid);

  // Optimized tab switching to prevent INP issues
  const handleTabClick = useCallback((event) => {
    const tabName = event.currentTarget.dataset.tab;
    if (tabName && tabName !== activeTab) {
      // Use startTransition for better responsiveness
      if (React.startTransition) {
        React.startTransition(() => {
          setActiveTab(tabName);
        });
      } else {
        setActiveTab(tabName);
      }
    }
  }, [activeTab]);

  // Note: Removed manual preloading to avoid "preloaded but not used" warnings
  // The CachedImage component with priority={true} handles efficient loading

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-text">Carregando...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="error-message">Perfil não encontrado</div>
      </div>
    );
  }

  // Determine sizes for responsive images
  const avatarSizes = '(max-width: 768px) 100px, 140px';
  const serviceCoverSizes = '(max-width: 768px) 100vw, 280px';
  const packCoverSizes = '(max-width: 768px) 100vw, 280px';

  // Build responsive srcSet for cover if following optimized naming (no hooks to avoid order issues)
  const coverSrcSet = (() => {
    const url = profile?.coverPhotoURL || '';
    if (!url) return undefined;
    if (/_optimized_1440\.webp(\?.*)?$/.test(url)) {
      const url720 = url.replace('_optimized_1440.webp', '_optimized_720.webp');
      return `${url720} 720w, ${url} 1440w`;
    }
    return undefined;
  })();

  return (
    <div className="profile-container">
      {/* Email Verification Banner - Only show for unverified emails */}
      {isOwner && !isVerified && !isChecking && !bannerDismissed && (
        <div className="email-verification-banner">
          <div className="banner-content">
            <div className="banner-icon">📧</div>
            <div className="banner-text">
              <strong>E-mail não verificado</strong>
              <p>Verifique sua caixa de entrada e clique no link de verificação para acessar todos os recursos.</p>
            </div>
            <div className="banner-actions">
              <button className="btn-verify" onClick={() => window.location.href = '/verify-email'}>
                Verificar agora
              </button>
              <button className="btn-dismiss" onClick={() => setBannerDismissed(true)}>×</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="profile-card">
        <div className="cover-photo">
          {profile.coverPhotoURL ? (
            <CachedImage
              src={profile.coverPhotoURL}
              alt="Capa do Perfil"
              className="cover-photo-img"
              priority={true}
              sizes="(max-width: 768px) 100vw, 1440px"
              srcSet={coverSrcSet}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="cover-photo-placeholder" />
          )}
          {isOwner && (
            <label className="cover-upload-btn">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'cover')}
                style={{ display: 'none' }}
              />
              <i className="fas fa-camera"></i>
            </label>
          )}
        </div>
        
        <div className="profile-header">
          <div className="profile-avatar">
            <label className="avatar-upload-btn">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'avatar')}
                style={{ display: 'none' }}
              />
              <CachedImage 
                src={profile.profilePictureURL}
                defaultType="PROFILE_1"
                alt="Avatar de Perfil"
                className="profile-avatar-img"
                priority={false}
                sizes={avatarSizes}
                showLoading={true}
              />
              {isOwner && (
                <i className="fas fa-camera"></i>
              )}
            </label>
          </div>
          
          <div className="profile-info">
            {renderAccountBadges()}
            <h1 className="profile-name">
              {editing ? (
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="edit-input"
                />
              ) : (
                profile.displayName || 'Nome do Usuário'
              )}
            </h1>
            <p className="profile-username">
              {editing ? (
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="edit-input"
                  placeholder="@username"
                />
              ) : (
                `@${profile.username || 'username'}`
              )}
            </p>
            <p className="profile-status">
              {editing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="edit-textarea"
                  placeholder="Mensagem de status aqui"
                />
              ) : (
                profile.bio || 'Mensagem de status aqui'
              )}
            </p>
            
            <div className="profile-meta">
              <span className="profile-location">
                <i className="fa-solid fa-location-dot"></i>
                {editing ? (
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="edit-input"
                    placeholder="Nenhuma localização especificada"
                  />
                ) : (
                  profile.location || 'Nenhuma localização especificada'
                )}
              </span>
              <span className="profile-joined">
                <i className="fa-solid fa-calendar"></i>
                Entrou em {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'janeiro de 2025'}
              </span>
            </div>
            
            <div className="profile-rating">
              <div className="profile-stars">★★★★☆</div>
              <span className="profile-rating-value">{profile.rating || 4.0}</span>
              <span className="profile-rating-count">({profile.reviewsCount || 0} avaliações)</span>
            </div>
          </div>
          
          <div className="profile-actions">
            {isOwner ? (
              editing ? (
                <>
                  <button className="save-profile-btn" onClick={handleSave}>
                    <i className="fa-solid fa-check"></i> Salvar
                  </button>
                  <button className="cancel-profile-btn" onClick={handleCancel}>
                    <i className="fa-solid fa-times"></i> Cancelar
                  </button>
                </>
              ) : (
                <button className="edit-profile-btn" onClick={() => setEditing(true)}>
                  <i className="fa-solid fa-pen"></i> Editar Perfil
                </button>
              )
            ) : (
              currentUser && (
                <div className="visitor-actions">
                  <button 
                    className={`follow-btn ${isFollowing ? 'following' : ''}`}
                    onClick={handleFollow}
                  >
                    <i className={`fa-solid ${isFollowing ? 'fa-user-check' : 'fa-user-plus'}`}></i>
                    {isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
                  <button className="message-btn">
                    <i className="fa-solid fa-envelope"></i> Mensagem
                  </button>
                </div>
              )
            )}
          </div>
        </div>
        
        <div className="profile-tabs">
          <button 
            className={`profile-tab ${activeTab === 'perfil' ? 'active' : ''}`}
            onClick={handleTabClick}
            data-tab="perfil"
          >
            Perfil
          </button>
          <button 
            className={`profile-tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={handleTabClick}
            data-tab="about"
          >
            Sobre
          </button>
          <button 
            className={`profile-tab ${activeTab === 'services' ? 'active' : ''}`}
            onClick={handleTabClick}
            data-tab="services"
          >
            Serviços
          </button>
          <button 
            className={`profile-tab ${activeTab === 'packs' ? 'active' : ''}`}
            onClick={handleTabClick}
            data-tab="packs"
          >
            Packs
          </button>
          <button 
            className={`profile-tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={handleTabClick}
            data-tab="subscriptions"
          >
            Assinaturas
          </button>
          <button 
            className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={handleTabClick}
            data-tab="reviews"
          >
            Avaliações
          </button>
        </div>
      </div>
      
      {/* Tab Contents */}
      <div className={`tab-content ${activeTab === 'perfil' ? 'active' : ''}`}>
        <div className="perfil-tab-content">
          <div className="profile-sidebar">
            <div className="interests-section">
              <div className="section-header">
                <i className="fa-solid fa-tags"></i> Interesses
              </div>
              <div className="section-content">
                <div className="interest-tags">
                  {profile.interests && profile.interests.length > 0 ? (
                    profile.interests.map((interest, index) => (
                      <span key={index} className="interest-tag">{interest}</span>
                    ))
                  ) : (
                    <span className="no-interests">Nenhum interesse adicionado</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="friends-section">
              <div className="section-header friends-header">
                <div>
                  <i className="fa-solid fa-users"></i> Seguidores
                  <div className="friend-count">{followers.length} Seguidores</div>
                </div>
                {followers.length > 0 && (
                  <button className="view-all-link" onClick={() => setShowFollowersModal(true)}>
                    Todos os seguidores
                  </button>
                )}
              </div>
              <div className="section-content">
                {followers.length > 0 ? (
                  <div className="friends-grid">
                    {followers.slice(0, 6).map((follower) => (
                      <div key={follower.id} className="friend-item">
                        <div className="friend-avatar">
                        <CachedImage 
                            src={follower.profilePictureURL}
                            defaultType="PROFILE_2"
                            alt={follower.displayName}
                            className="friend-avatar-img"
                            sizes="60px"
                            showLoading={false}
                            loading="lazy"
                          />
                          <StatusIndicator 
                            userId={follower.id}
                            isOwner={false}
                            size="small"
                          />
                        </div>
                        <div className="friend-name">{follower.displayName}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">Nenhum seguidor ainda.</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="profile-posts">
            {isOwner && (
              <div className="create-post-card">
                <div className="create-post-avatar">
                  <CachedImage 
                    src={profile.profilePictureURL}
                    defaultType="PROFILE_3"
                    alt="Avatar"
                    className="create-post-avatar-img"
                    showLoading={false}
                  />
                </div>
                <div className="create-post-body">
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="O que você está pensando?"
                    maxLength={1000}
                    rows={3}
                  />
                  <div className="create-post-actions">
                    <label className="action-btn">
                      <i className="fa-solid fa-image"></i> Imagem
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button onClick={handleCreatePost} className="btn primary">
                      Publicar
                    </button>
                  </div>
                  {selectedImages.length > 0 && (
                    <div className="selected-images-preview">
                      {selectedImages.map((image, index) => (
                         <img
                           key={index}
                           src={URL.createObjectURL(image)}
                           alt="Preview"
                           width={64}
                           height={64}
                           style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px' }}
                         />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="posts-container">
              {posts.length > 0 ? (
                posts.map((post) => (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div className="post-author-avatar">
                        <CachedImage
                          src={post.authorPhoto}
                          fallbackSrc="/images/default-avatar.jpg"
                          alt={post.authorName}
                          sizes="48px"
                          showLoading={false}
                        />
                      </div>
                      <div className="post-meta">
                        <div className="post-author-name">{post.authorName}</div>
                        <div className="post-date">
                          {new Date(post.timestamp).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <div className="post-content">
                      <p>{post.content}</p>
                          {post.images && post.images.length > 0 && (
                        <div className="post-image-container">
                          {post.images.map((image, index) => (
                            <CachedImage
                              key={index}
                              src={image}
                              alt="Post"
                              className="post-image"
                              sizes="(max-width: 768px) 100vw, 400px"
                              showLoading={false}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">Nenhuma publicação ainda.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* About Tab */}
      <div className={`tab-content ${activeTab === 'about' ? 'active' : ''}`}>
        <div className="about-tab-content">
          <h3>Sobre mim</h3>
          <p className="bio-text">{profile.bio || 'Nenhuma bio disponível.'}</p>
          
          <div className="profile-details">
            <div className="detail-group">
              <h3>Idiomas</h3>
              <p>{profile.languages || 'Não especificado'}</p>
            </div>
            
            <div className="detail-group">
              <h3>Habilidades</h3>
              <div className="skills-container">
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">{skill}</span>
                  ))
                ) : (
                  <span className="empty-state">Nenhuma habilidade adicionada ainda</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Services Tab */}
      <div className={`tab-content ${activeTab === 'services' ? 'active' : ''}`}>
        <div className="services-tab-content">
          <div className="services-header">
            <h3>Serviços</h3>
            {isOwner && (
              <button 
                className="btn primary"
                onClick={() => {
                  setEditingService(null);
                  setShowCreateServiceModal(true);
                }}
              >
                <i className="fa-solid fa-plus"></i> Criar Novo Serviço
              </button>
            )}
          </div>
          
          <div className="services-grid">
            {servicesLoading ? (
              <div className="loading-state">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <p>Carregando serviços...</p>
              </div>
            ) : services.length > 0 ? (
              services.map((service) => (
                <div 
                  key={service.id} 
                  className={`pack-card ${isOwner ? 'editable' : ''}`}
                  onClick={isOwner ? () => handleEditService(service) : undefined}
                  style={isOwner ? { cursor: 'pointer' } : {}}
                  title={isOwner ? 'Clique para editar este serviço' : ''}
                >
                          <div className="pack-cover">
                    <CachedImage 
                      src={service.coverImageURL}
                      fallbackSrc="/images/default-service.jpg"
                      alt={service.title}
                      sizes={serviceCoverSizes}
                    />
                    {service.status && service.status !== 'active' && (
                      <div className={`service-status-badge ${service.status}`}>
                        {service.status}
                      </div>
                    )}
                  </div>
                  <div className="pack-info">
                    <h3 className="pack-title">{service.title}</h3>
                    <p className="pack-price">VP {(service.price != null ? (service.price * 1.5).toFixed(2) : '0.00')}</p>
                  </div>
                  {isOwner && (
                    <div className="service-actions" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="action-btn edit-btn"
                        onClick={() => handleEditService(service)}
                        title="Editar"
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button 
                        className="action-btn status-btn"
                        onClick={() => {
                          const newStatus = service.status === 'active' ? 'paused' : 'active';
                          handleServiceStatusChange(service.id, newStatus);
                        }}
                        title="Alterar Status"
                      >
                        <i className="fa-solid fa-toggle-on"></i>
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteService(service.id)}
                        title="Excluir"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="fa-solid fa-briefcase"></i>
                <p>Nenhum serviço cadastrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Packs Tab */}
      <div className={`tab-content ${activeTab === 'packs' ? 'active' : ''}`}>
        <div className="packs-tab-content">
          <div className="packs-header">
            <h3>Packs</h3>
            {isOwner && (
              <button 
                className="btn primary"
                onClick={() => {
                  setEditingPack(null);
                  setShowCreatePackModal(true);
                }}
              >
                <i className="fa-solid fa-plus"></i> Criar Novo Pack
              </button>
            )}
          </div>
          
          <div className="packs-description">
            <p>Packs oferecem descontos especiais.</p>
          </div>
          
          <div className="packs-grid">
            {packsLoading ? (
              <div className="loading-state">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <p>Carregando packs...</p>
              </div>
            ) : packs.length > 0 ? (
              packs.map((pack) => (
                <div 
                  key={pack.id} 
                  className={`pack-card ${isOwner ? 'editable' : ''}`}
                  onClick={isOwner ? () => handleEditPack(pack) : undefined}
                  style={isOwner ? { cursor: 'pointer' } : {}}
                  title={isOwner ? 'Clique para editar este pack' : ''}
                >
                  <div className="pack-cover">
                    <CachedImage 
                      src={pack.coverImage}
                      fallbackSrc="/images/default-pack.jpg"
                      alt={pack.title}
                      sizes={packCoverSizes}
                    />
                    {pack.status && pack.status !== 'active' && (
                      <div className={`service-status-badge ${pack.status}`}>
                        {pack.status}
                      </div>
                    )}
                  </div>
                  <div className="pack-info">
                    <h3 className="pack-title">{pack.title}</h3>
                    <p className="pack-price">
                      VP {(pack.price != null ? (pack.price * 1.5).toFixed(2) : '0.00')}
                      {pack.discount && <span className="pack-discount">(-{pack.discount}%)</span>}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="service-actions" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="action-btn edit-btn"
                        onClick={() => handleEditPack(pack)}
                        title="Editar"
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button 
                        className="action-btn status-btn"
                        onClick={() => {
                          const newStatus = pack.status === 'active' ? 'paused' : 'active';
                          handlePackStatusChange(pack.id, newStatus);
                        }}
                        title="Alterar Status"
                      >
                        <i className="fa-solid fa-toggle-on"></i>
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeletePack(pack.id)}
                        title="Excluir"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="fa-solid fa-box-open"></i>
                <p>Nenhum pack cadastrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Subscriptions Tab */}
      <div className={`tab-content ${activeTab === 'subscriptions' ? 'active' : ''}`}>
        <div className="subscriptions-tab-content">
          <div className="subscriptions-header">
            <h3>Assinaturas</h3>
            {isOwner && (
              <button className="btn blocked" disabled title="Em breve">
                <i className="fa-solid fa-plus"></i> Criar Nova Assinatura
              </button>
            )}
          </div>
          
          <div className="subscriptions-grid">
            <div className="subscriptions-coming-soon">
              <span className="coming-soon-badge">Em breve</span>
              <div className="coming-soon-icon">
                <i className="fa-regular fa-clock"></i>
              </div>
              <div className="coming-soon-title">Assinaturas em desenvolvimento</div>
              <div className="coming-soon-subtitle">Estamos preparando algo especial para você. Volte em breve.</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Reviews Tab */}
      <div className={`tab-content ${activeTab === 'reviews' ? 'active' : ''}`}>
        <div className="reviews-tab-content">
          <h3>Avaliações</h3>
          
          <div className="reviews-summary">
            <div className="rating-breakdown">
              <div className="rating-value-large">{profile.rating || 0.0}</div>
              <div className="rating-stars-large">
                <div className="stars-display-large">★★★★★</div>
                <div className="reviews-count">({reviews.length} avaliações)</div>
              </div>
            </div>
          </div>
          
          <div className="reviews-list">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <div className="reviewer-avatar">
                      <img src={review.reviewerPhoto || getDefaultImage('PROFILE_3')} alt={review.reviewerName} />
                    </div>
                    <div className="review-meta">
                      <div className="reviewer-name">{review.reviewerName}</div>
                      <div className="review-date">
                        {new Date(review.timestamp).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="review-rating">
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </div>
                  </div>
                  <div className="review-content">
                    <p>{review.comment}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">Nenhuma avaliação ainda.</div>
            )}
          </div>
        </div>
      </div>

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="modal-overlay" onClick={() => setShowFollowersModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Seguidores</h2>
              <button className="modal-close" onClick={() => setShowFollowersModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="modal-followers-grid">
                {followers.map((follower) => (
                  <div key={follower.id} className="modal-follower-item">
                    <div className="modal-follower-avatar">
                      <img src={follower.profilePictureURL || getDefaultImage('PROFILE_1')} alt={follower.displayName} />
                      <StatusIndicator 
                        userId={follower.id}
                        isOwner={false}
                        size="small"
                      />
                    </div>
                    <div className="modal-follower-name">{follower.displayName}</div>
                    <div className="modal-follower-username">@{follower.username}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lazy modals - only load when actually needed */}
      {(showCreateServiceModal || showCreatePackModal) && (
        <Suspense fallback={<div>Loading...</div>}>
          {showCreateServiceModal && (
            <CreateServiceModal
              isOpen={showCreateServiceModal}
              onClose={() => {
                setShowCreateServiceModal(false);
                setEditingService(null);
              }}
              onServiceCreated={handleServiceCreated}
              editingService={editingService}
            />
          )}
          {showCreatePackModal && (
            <CreatePackModal
              isOpen={showCreatePackModal}
              onClose={() => {
                setShowCreatePackModal(false);
                setEditingPack(null);
              }}
              onPackCreated={handlePackCreated}
              editingPack={editingPack}
            />
          )}
        </Suspense>
      )}
    </div>
  );
};

export default Profile;
