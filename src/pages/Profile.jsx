import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';

const Profile = () => {
  const { userId } = useParams();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('perfil');

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
  }, [userId, currentUser]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const targetUserId = userId || currentUser?.uid;
      
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      const userRef = ref(database, `users/${targetUserId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
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
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file || !currentUser) return;

    try {
      setUploading(true);
      const fileRef = storageRef(storage, `profiles/${currentUser.uid}/${type}_${Date.now()}`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      
      const updateData = {};
      updateData[type === 'avatar' ? 'photoURL' : 'coverURL'] = downloadURL;
      
      await update(ref(database, `users/${currentUser.uid}`), updateData);
      await loadProfile(); // Reload profile to show new image
      
      setUploading(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploading(false);
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

  const isOwner = currentUser?.uid === (userId || currentUser?.uid);

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-spinner">Carregando...</div>
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
      <div className="profile-card">
        <div className="cover-photo" style={{ backgroundImage: `url(${profile.coverURL || '/images/default-cover.jpg'})` }}>
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
            <img 
              src={profile.photoURL || '/images/default-avatar.jpg'} 
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
          
          {isOwner && (
            <div className="profile-actions">
              {editing ? (
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
              )}
            </div>
          )}
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
              <div className="section-header">
                <i className="fa-solid fa-users"></i> Amigos
              </div>
              <div className="section-content">
                <div className="friends-count">
                  <span className="friends-number">{profile.friendsCount || 0}</span>
                  <span className="friends-label">amigos</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="profile-main">
            <div className="profile-details">
              <h3>Detalhes do Perfil</h3>
              <div className="detail-item">
                <span className="detail-label">Website:</span>
                {editing ? (
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="edit-input"
                    placeholder="https://..."
                  />
                ) : (
                  <span className="detail-value">
                    {profile.website ? (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer">
                        {profile.website}
                      </a>
                    ) : (
                      'Não especificado'
                    )}
                  </span>
                )}
              </div>
              
              <div className="social-links">
                <h4>Redes Sociais</h4>
                <div className="social-item">
                  <i className="fab fa-twitter"></i>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.twitter}
                      onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                      className="edit-input"
                      placeholder="@username"
                    />
                  ) : (
                    <span className="social-value">
                      {profile.twitter ? (
                        <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer">
                          @{profile.twitter}
                        </a>
                      ) : (
                        'Não especificado'
                      )}
                    </span>
                  )}
                </div>
                
                <div className="social-item">
                  <i className="fab fa-instagram"></i>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.instagram}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                      className="edit-input"
                      placeholder="@username"
                    />
                  ) : (
                    <span className="social-value">
                      {profile.instagram ? (
                        <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer">
                          @{profile.instagram}
                        </a>
                      ) : (
                        'Não especificado'
                      )}
                    </span>
                  )}
                </div>
                
                <div className="social-item">
                  <i className="fab fa-youtube"></i>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.youtube}
                      onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                      className="edit-input"
                      placeholder="Canal do YouTube"
                    />
                  ) : (
                    <span className="social-value">
                      {profile.youtube ? (
                        <a href={`https://youtube.com/${profile.youtube}`} target="_blank" rel="noopener noreferrer">
                          {profile.youtube}
                        </a>
                      ) : (
                        'Não especificado'
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Other tab contents would go here */}
      <div className={`tab-content ${activeTab === 'about' ? 'active' : ''}`}>
        <div className="about-tab-content">
          <h3>Sobre</h3>
          <p>Conteúdo sobre o usuário será exibido aqui.</p>
        </div>
      </div>
      
      <div className={`tab-content ${activeTab === 'services' ? 'active' : ''}`}>
        <div className="services-tab-content">
          <h3>Serviços</h3>
          <p>Lista de serviços oferecidos será exibida aqui.</p>
        </div>
      </div>
      
      <div className={`tab-content ${activeTab === 'packs' ? 'active' : ''}`}>
        <div className="packs-tab-content">
          <h3>Packs</h3>
          <p>Packs disponíveis serão exibidos aqui.</p>
        </div>
      </div>
      
      <div className={`tab-content ${activeTab === 'subscriptions' ? 'active' : ''}`}>
        <div className="subscriptions-tab-content">
          <h3>Assinaturas</h3>
          <p>Assinaturas ativas serão exibidas aqui.</p>
        </div>
      </div>
      
      <div className={`tab-content ${activeTab === 'reviews' ? 'active' : ''}`}>
        <div className="reviews-tab-content">
          <h3>Avaliações</h3>
          <p>Avaliações recebidas serão exibidas aqui.</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
