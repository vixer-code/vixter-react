import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../config/firebase';
import { ref, get, update } from 'firebase/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './EditProfile.css';

const EditProfile = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    status: '',
    bio: '',
    location: '',
    languages: '',
    interests: '',
    skills: ''
  });

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const loadUserData = async () => {
      try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setFormData({
            username: userData.username || '',
            displayName: userData.displayName || '',
            status: userData.status || '',
            bio: userData.bio || '',
            location: userData.location || '',
            languages: Array.isArray(userData.languages) ? userData.languages.join(', ') : userData.languages || '',
            interests: Array.isArray(userData.interests) ? userData.interests.join(', ') : userData.interests || '',
            skills: Array.isArray(userData.skills) ? userData.skills.join(', ') : userData.skills || ''
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [currentUser, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const userRef = ref(database, `users/${currentUser.uid}`);
      const updateData = {
        displayName: formData.displayName,
        status: formData.status,
        bio: formData.bio,
        location: formData.location,
        languages: formData.languages.split(',').map(lang => lang.trim()).filter(lang => lang),
        interests: formData.interests.split(',').map(interest => interest.trim()).filter(interest => interest),
        skills: formData.skills.split(',').map(skill => skill.trim()).filter(skill => skill),
        updatedAt: Date.now()
      };

      await update(userRef, updateData);
      navigate('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Erro ao salvar as alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/profile');
  };

  if (isLoading) {
    return (
      <div className="edit-profile-loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Carregando dados do perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-page">
      <Header />
      
      <main className="edit-profile-container">
        <div className="edit-profile-header">
          <h1>
            <i className="fas fa-edit"></i>
            Editar Perfil
          </h1>
          <p>Personalize suas informações públicas</p>
        </div>

        <form className="edit-profile-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Informações Básicas</h3>
            
            <div className="form-group">
              <label htmlFor="username">Username (@)</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                disabled
                className="disabled"
              />
              <small className="hint">O @ de usuário não pode ser alterado.</small>
            </div>

            <div className="form-group">
              <label htmlFor="displayName">Nome para exibição *</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                maxLength="32"
                required
                placeholder="Como você quer ser conhecido"
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <input
                type="text"
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                maxLength="70"
                placeholder="Sua mensagem de status"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Sobre Você</h3>
            
            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows="4"
                maxLength="500"
                placeholder="Conte um pouco sobre você..."
              />
              <small className="char-count">{formData.bio.length}/500</small>
            </div>

            <div className="form-group">
              <label htmlFor="location">Localização</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                maxLength="60"
                placeholder="Cidade, Estado/País"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Habilidades e Interesses</h3>
            
            <div className="form-group">
              <label htmlFor="languages">Idiomas falados</label>
              <input
                type="text"
                id="languages"
                name="languages"
                value={formData.languages}
                onChange={handleInputChange}
                placeholder="Português, Inglês, Japonês"
              />
              <small className="hint">Separe os idiomas por vírgula</small>
            </div>

            <div className="form-group">
              <label htmlFor="interests">Interesses</label>
              <input
                type="text"
                id="interests"
                name="interests"
                value={formData.interests}
                onChange={handleInputChange}
                placeholder="gaming, desenvolvimento, música"
              />
              <small className="hint">Separe os interesses por vírgula</small>
            </div>

            <div className="form-group">
              <label htmlFor="skills">Habilidades</label>
              <input
                type="text"
                id="skills"
                name="skills"
                value={formData.skills}
                onChange={handleInputChange}
                placeholder="JavaScript, Ilustração, Coaching"
              />
              <small className="hint">Separe as habilidades por vírgula</small>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <i className="fas fa-times"></i>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i>
                  Salvar alterações
                </>
              )}
            </button>
          </div>
        </form>

        {isSaving && (
          <div className="saving-overlay">
            <div className="saving-loader">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Salvando alterações...</span>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default EditProfile;