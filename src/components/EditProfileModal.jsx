import React, { useState, useEffect } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './EditProfileModal.css';

const EditProfileModal = ({ isOpen, onClose, profile, onProfileUpdated }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    location: '',
    languages: '',
    interests: '',
    skills: '',
    website: '',
    twitter: '',
    instagram: '',
    youtube: ''
  });

  // Initialize form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        languages: profile.languages || '',
        interests: profile.interests ? profile.interests.join(', ') : '',
        skills: profile.skills ? profile.skills.join(', ') : '',
        website: profile.website || '',
        twitter: profile.twitter || '',
        instagram: profile.instagram || '',
        youtube: profile.youtube || ''
      });
    }
  }, [profile]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const splitToArray = (str) => {
    return str
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    try {
      const updateData = {
        displayName: formData.displayName.trim(),
        username: formData.username.trim(),
        bio: formData.bio.trim(),
        location: formData.location.trim(),
        languages: formData.languages.trim(),
        interests: splitToArray(formData.interests),
        skills: splitToArray(formData.skills),
        website: formData.website.trim(),
        twitter: formData.twitter.trim(),
        instagram: formData.instagram.trim(),
        youtube: formData.youtube.trim(),
        updatedAt: Date.now()
      };

      const userRef = ref(database, `users/${currentUser.uid}`);
      await update(userRef, updateData);
      
      onProfileUpdated && onProfileUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        languages: profile.languages || '',
        interests: profile.interests ? profile.interests.join(', ') : '',
        skills: profile.skills ? profile.skills.join(', ') : '',
        website: profile.website || '',
        twitter: profile.twitter || '',
        instagram: profile.instagram || '',
        youtube: profile.youtube || ''
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="edit-profile-modal-overlay" onClick={onClose}>
      <div className="edit-profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="edit-profile-modal-header">
          <h2>
            <i className="fa-solid fa-pen"></i> Editar Perfil
          </h2>
          <button className="edit-profile-modal-close" onClick={onClose}>
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="edit-profile-form-grid">
            {/* Basic Information */}
            <div className="form-section">
              <h3>Informações Básicas</h3>
              
              <div className="form-group">
                <label htmlFor="username">Username (@)</label>
                <input
                  type="text"
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="form-input"
                  placeholder="@username"
                  maxLength="30"
                />
                <small className="form-hint">Seu nome de usuário único</small>
              </div>

              <div className="form-group">
                <label htmlFor="displayName">Nome para Exibição</label>
                <input
                  type="text"
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className="form-input"
                  placeholder="Seu nome"
                  maxLength="50"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="form-textarea"
                  placeholder="Conte um pouco sobre você..."
                  maxLength="500"
                  rows="4"
                />
                <small className="form-hint">{formData.bio.length}/500 caracteres</small>
              </div>

              <div className="form-group">
                <label htmlFor="location">Localização</label>
                <input
                  type="text"
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="form-input"
                  placeholder="Cidade, País"
                  maxLength="60"
                />
              </div>
            </div>

            {/* Skills & Interests */}
            <div className="form-section">
              <h3>Habilidades & Interesses</h3>
              
              <div className="form-group">
                <label htmlFor="languages">Idiomas Falados</label>
                <input
                  type="text"
                  id="languages"
                  value={formData.languages}
                  onChange={(e) => handleInputChange('languages', e.target.value)}
                  className="form-input"
                  placeholder="Português, Inglês, Espanhol"
                />
                <small className="form-hint">Separados por vírgula</small>
              </div>

              <div className="form-group">
                <label htmlFor="skills">Habilidades</label>
                <input
                  type="text"
                  id="skills"
                  value={formData.skills}
                  onChange={(e) => handleInputChange('skills', e.target.value)}
                  className="form-input"
                  placeholder="JavaScript, Design, Marketing"
                />
                <small className="form-hint">Separadas por vírgula</small>
              </div>

              <div className="form-group">
                <label htmlFor="interests">Interesses</label>
                <input
                  type="text"
                  id="interests"
                  value={formData.interests}
                  onChange={(e) => handleInputChange('interests', e.target.value)}
                  className="form-input"
                  placeholder="Gaming, Música, Tecnologia"
                />
                <small className="form-hint">Separados por vírgula</small>
              </div>
            </div>

            {/* Social Links */}
            <div className="form-section">
              <h3>Redes Sociais</h3>
              
              <div className="form-group">
                <label htmlFor="website">
                  <i className="fa-solid fa-globe"></i> Website
                </label>
                <input
                  type="url"
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="form-input"
                  placeholder="https://seu-site.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="twitter">
                  <i className="fa-brands fa-twitter"></i> Twitter
                </label>
                <input
                  type="text"
                  id="twitter"
                  value={formData.twitter}
                  onChange={(e) => handleInputChange('twitter', e.target.value)}
                  className="form-input"
                  placeholder="@seuusuario"
                />
              </div>

              <div className="form-group">
                <label htmlFor="instagram">
                  <i className="fa-brands fa-instagram"></i> Instagram
                </label>
                <input
                  type="text"
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  className="form-input"
                  placeholder="@seuusuario"
                />
              </div>

              <div className="form-group">
                <label htmlFor="youtube">
                  <i className="fa-brands fa-youtube"></i> YouTube
                </label>
                <input
                  type="text"
                  id="youtube"
                  value={formData.youtube}
                  onChange={(e) => handleInputChange('youtube', e.target.value)}
                  className="form-input"
                  placeholder="@seucanal"
                />
              </div>
            </div>
          </div>

          <div className="edit-profile-form-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              <i className="fa-solid fa-times"></i> Cancelar
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Salvando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-save"></i> Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;