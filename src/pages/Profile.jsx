import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get, update, set, remove, onValue, off } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultImage } from '../utils/defaultImages';
import { useEmailVerification } from '../hooks/useEmailVerification';
import StatusIndicator from '../components/StatusIndicator';
import './Profile.css';

const Profile = () => {
  const { userId } = useParams();
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
  const [userStatus, setUserStatus] = useState('offline');
  const [services, setServices] = useState([]);
  const [packs, setPacks] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

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

      // Load additional data
      await Promise.all([
        loadFollowers(targetUserId),
        loadPosts(targetUserId),
        loadUserStatus(targetUserId),
        loadServices(targetUserId),
        loadPacks(targetUserId),
        loadSubscriptions(targetUserId),
        loadReviews(targetUserId)
      ]);
      
      setLoading(false);
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

  const loadUserStatus = async (targetUserId) => {
    try {
      const statusRef = ref(database, `userStatus/${targetUserId}`);
      onValue(statusRef, (snapshot) => {
        if (snapshot.exists()) {
          setUserStatus(snapshot.val().status || 'offline');
        }
      });
    } catch (error) {
      console.error('Error loading user status:', error);
    }
  };

  const loadServices = async (targetUserId) => {
    try {
      const servicesRef = ref(database, `services/${targetUserId}`);
      const snapshot = await get(servicesRef);
      
      if (snapshot.exists()) {
        const servicesData = snapshot.val();
        const servicesArray = Object.entries(servicesData).map(([id, service]) => ({
          id,
          ...service
        }));
        setServices(servicesArray);
      }
    } catch (error) {
      console.error('Error loading services:', error);
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

  const loadSubscriptions = async (targetUserId) => {
    try {
      const subsRef = ref(database, `subscriptions/${targetUserId}`);
      const snapshot = await get(subsRef);
      
      if (snapshot.exists()) {
        const subsData = snapshot.val();
        const subsArray = Object.entries(subsData).map(([id, sub]) => ({
          id,
          ...sub
        }));
        setSubscriptions(subsArray);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  };

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
      const fileRef = storageRef(storage, type === 'avatar' ? `profilePictures/${currentUser.uid}` : `coverPhotos/${currentUser.uid}`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      
      const updateData = {};
      updateData[type === 'avatar' ? 'profilePictureURL' : 'coverPhotoURL'] = downloadURL;
      
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

  const renderStatusIndicator = () => {
    return (
      <StatusIndicator 
        userId={userId || currentUser?.uid}
        isOwner={isOwner}
        size="large"
        showText={false}
      />
    );
  };

  const isOwner = currentUser?.uid === (userId || currentUser?.uid);

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
        <div className="cover-photo" style={{ backgroundImage: profile.coverPhotoURL ? `url(${profile.coverPhotoURL})` : 'none' }}>
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
          <div className="status-indicator-floating">
            {renderStatusIndicator()}
          </div>
          <div className="profile-avatar">
            <img 
              src={profile.profilePictureURL || getDefaultImage('PROFILE_1')} 
              alt="Avatar de Perfil"
            />
            {isOwner && (
              <label className="avatar-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'avatar')}
                  style={{ display: 'none' }}
                />
                <i className="fas fa-camera"></i>
              </label>
            )}
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
            onClick={() => setActiveTab('perfil')}
          >
            Perfil
          </button>
          <button 
            className={`profile-tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            Sobre
          </button>
          <button 
            className={`profile-tab ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            Serviços
          </button>
          <button 
            className={`profile-tab ${activeTab === 'packs' ? 'active' : ''}`}
            onClick={() => setActiveTab('packs')}
          >
            Packs
          </button>
          <button 
            className={`profile-tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            Assinaturas
          </button>
          <button 
            className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            Avaliações
          </button>
        </div>
      </div>
      
      {/* Perfil Tab */}
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
                <div className="friends-grid">
                  {followers.slice(0, 6).map((follower) => (
                    <div key={follower.id} className="friend-item">
                      <div className="friend-avatar">
                        <img src={follower.profilePictureURL || getDefaultImage('PROFILE_2')} alt={follower.displayName} />
                        <StatusIndicator 
                          userId={follower.id}
                          isOwner={false}
                          size="small"
                        />
                      </div>
                      <div className="friend-name">{follower.displayName}</div>
                    </div>
                  ))}
                  {followers.length === 0 && (
                    <div className="empty-state">Nenhum seguidor ainda.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="profile-posts">
            {isOwner && (
              <div className="create-post-card">
                <div className="create-post-avatar">
                  <img src={profile.profilePictureURL || getDefaultImage('PROFILE_3')} alt="Avatar" />
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
                        <img src={post.authorPhoto || '/images/default-avatar.jpg'} alt={post.authorName} />
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
                            <img key={index} src={image} alt="Post" className="post-image" />
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
              <button className="btn primary">
                <i className="fa-solid fa-plus"></i> Criar Novo Serviço
              </button>
            )}
          </div>
          
          <div className="services-grid">
            {services.length > 0 ? (
              services.map((service) => (
                <div key={service.id} className="service-card">
                  <div className="service-cover">
                    <img src={service.coverImageURL || '/images/default-service.jpg'} alt={service.title} />
                  </div>
                  <div className="service-info">
                    <h3 className="service-title">{service.title}</h3>
                    <p className="service-price">R$ {service.price?.toFixed(2)}</p>
                  </div>
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
              <button className="btn primary">
                <i className="fa-solid fa-plus"></i> Criar Novo Pack
              </button>
            )}
          </div>
          
          <div className="packs-description">
            <p>Packs oferecem descontos especiais.</p>
          </div>
          
          <div className="packs-grid">
            {packs.length > 0 ? (
              packs.map((pack) => (
                <div key={pack.id} className="pack-card">
                  <div className="pack-cover">
                    <img src={pack.coverImage || '/images/default-pack.jpg'} alt={pack.title} />
                  </div>
                  <div className="pack-info">
                    <h3 className="pack-title">{pack.title}</h3>
                    <p className="pack-price">
                      R$ {pack.price?.toFixed(2)}
                      {pack.discount && <span className="pack-discount">(-{pack.discount}%)</span>}
                    </p>
                  </div>
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
              <button className="btn primary">
                <i className="fa-solid fa-plus"></i> Criar Nova Assinatura
              </button>
            )}
          </div>
          
          <div className="subscriptions-grid">
            {subscriptions.length > 0 ? (
              subscriptions.map((sub) => (
                <div key={sub.id} className="subscription-card">
                  <div className="subscription-cover">
                    <img src={sub.coverImageUrl || '/images/default-subscription.jpg'} alt={sub.title} />
                  </div>
                  <div className="subscription-info">
                    <h3 className="subscription-title">{sub.title}</h3>
                    <p className="subscription-price">R$ {sub.mensalPrice?.toFixed(2)} / mês</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="fa-solid fa-newspaper"></i>
                <p>Nenhuma assinatura cadastrada.</p>
              </div>
            )}
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
    </div>
  );
};

export default Profile;
