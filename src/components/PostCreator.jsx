import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { database, storage, firestore } from '../../config/firebase';
import { ref, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './PostCreator.css';

const PostCreator = ({ 
  mode = 'feed', // 'feed', 'vixies', 'vixink'
  onPostCreated = () => {},
  placeholder = "O que você está pensando?",
  showAttachment = false,
  categories = []
}) => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { showSuccess, showError, showWarning } = useNotification();
  
  // Post content state
  const [postText, setPostText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [attachment, setAttachment] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Attachment modal state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [userServices, setUserServices] = useState([]);
  const [userPacks, setUserPacks] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Load user's services and packs for attachment
  useEffect(() => {
    console.log('PostCreator useEffect - showAttachment:', showAttachment, 'currentUser:', !!currentUser, 'userProfile:', userProfile, 'accountType:', userProfile?.accountType);
    if (showAttachment && currentUser) {
      loadUserAttachments();
    }
  }, [showAttachment, currentUser, userProfile]);

  // Load attachments when component mounts and user is available
  useEffect(() => {
    if (currentUser && showAttachment) {
      console.log('PostCreator: Component mounted, loading attachments');
      loadUserAttachments();
    }
  }, [currentUser, showAttachment]);

  // Debug: Log when showAttachment changes
  useEffect(() => {
    console.log('PostCreator: showAttachment changed:', showAttachment);
  }, [showAttachment]);

  // Load attachments when modal is opened
  useEffect(() => {
    if (showAttachmentModal && currentUser) {
      console.log('PostCreator: Modal opened, loading attachments');
      loadUserAttachments();
    }
  }, [showAttachmentModal, currentUser]);

  // Load attachments when modal is opened (alternative approach)
  const handleModalOpen = async () => {
    console.log('PostCreator: Modal opening, loading attachments');
    if (currentUser) {
      await loadUserAttachments();
    }
    setShowAttachmentModal(true);
  };

  // Debug: Log when modal state changes
  useEffect(() => {
    console.log('PostCreator: Modal state changed:', showAttachmentModal);
  }, [showAttachmentModal]);

  // Debug: Log when userServices or userPacks change
  useEffect(() => {
    console.log('PostCreator: userServices changed:', userServices.length, 'userPacks changed:', userPacks.length);
  }, [userServices, userPacks]);

  const loadUserAttachments = async () => {
    if (!currentUser) return;
    
    console.log('PostCreator: Loading attachments for user:', currentUser.uid);
    setLoadingAttachments(true);
    try {
      // Load services
      const servicesQuery = query(
        collection(firestore, 'services'),
        where('sellerId', '==', currentUser.uid)
      );
      const servicesSnapshot = await getDocs(servicesQuery);
      console.log('PostCreator: Services query result:', servicesSnapshot.docs.length, 'docs');
      const allServices = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('PostCreator: Service found:', doc.id, data.title, data.status, 'sellerId:', data.sellerId);
        return {
          id: doc.id,
          ...data,
          type: 'service'
        };
      });
      
      const services = allServices.filter(service => service.status === 'active'); // Only show active services
      console.log('PostCreator: Active services:', services.length, 'out of', allServices.length);

      // Load packs
      const packsQuery = query(
        collection(firestore, 'packs'),
        where('sellerId', '==', currentUser.uid)
      );
      const packsSnapshot = await getDocs(packsQuery);
      console.log('PostCreator: Packs query result:', packsSnapshot.docs.length, 'docs');
      const allPacks = packsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('PostCreator: Pack found:', doc.id, data.title, data.status, 'sellerId:', data.sellerId);
        return {
          id: doc.id,
          ...data,
          type: 'pack'
        };
      });
      
      const packs = allPacks.filter(pack => pack.status === 'active'); // Only show active packs
      console.log('PostCreator: Active packs:', packs.length, 'out of', allPacks.length);

      console.log('PostCreator: Setting services:', services.length, 'packs:', packs.length);
      setUserServices(services);
      setUserPacks(packs);
    } catch (error) {
      console.error('Error loading attachments:', error);
      showError('Erro ao carregar serviços e packs');
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleAttachmentSelect = (item) => {
    setAttachment({
      kind: item.type,
      id: item.id,
      title: item.title,
      coverUrl: item.coverImageURL || item.coverImage
    });
    setShowAttachmentModal(false);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
  };

  const handlePublish = async () => {
    if (!currentUser) {
      showError('Você precisa estar logado para postar');
      return;
    }

    if (mode === 'vixies' && (!userProfile || userProfile.accountType !== 'provider')) {
      showWarning('Apenas provedores podem postar em Vixies');
      return;
    }

    const content = postText.trim();
    
    // Validate content
    if (!content && !mediaFile) {
      showWarning('Posts devem conter texto ou uma mídia');
      return;
    }

    // Check for links
    const hasUrl = /(https?:\/\/|www\.)/i.test(content);
    if (hasUrl) {
      showWarning('Links não são permitidos no post');
      return;
    }

    try {
      setIsPublishing(true);
      
      let mediaData = null;
      
      // Upload media if provided
      if (mediaFile) {
        const path = `${mode}/${currentUser.uid}/${Date.now()}_${mediaFile.name}`;
        const sref = storageRef(storage, path);
        const snap = await uploadBytes(sref, mediaFile);
        const url = await getDownloadURL(snap.ref);
        mediaData = [{ type: mediaType, url }];
      }

      // Create post data based on mode
      const postData = {
        content,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Usuário',
        authorPhotoURL: currentUser.photoURL || '/images/defpfp1.png',
        timestamp: Date.now(),
        media: mediaData,
        attachment: attachment || null
      };

      // Add mode-specific fields
      if (mode === 'vixies' || mode === 'vixink') {
        postData.category = selectedCategory;
      }

      // Publish to appropriate database location
      const postsRef = ref(database, `${mode}_posts`);
      await push(postsRef, postData);

      // Reset form
      setPostText('');
      setMediaFile(null);
      setAttachment(null);
      setSelectedCategory('all');
      
      showSuccess('Post criado com sucesso!');
      onPostCreated();
      
    } catch (error) {
      console.error('Error creating post:', error);
      showError('Erro ao criar post');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setMediaFile(file);
  };

  const handleRemoveFile = () => {
    setMediaFile(null);
  };

  return (
    <div className="post-creator">
      <div className="post-creator-header">
        <img
          src={currentUser?.photoURL || '/images/defpfp1.png'}
          alt={currentUser?.displayName || 'User'}
          className="user-avatar"
          onError={(e) => {
            e.target.src = '/images/defpfp1.png';
          }}
        />
        <div className="post-creator-input-container">
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder={placeholder}
            className="post-creator-input"
            rows="3"
            maxLength={2000}
          />
        </div>
      </div>

      {/* Attachment Display */}
      {attachment && (
        <div className="selected-attachment">
          <div className="attachment-preview">
            <img 
              src={attachment.coverUrl} 
              alt={attachment.title}
              className="attachment-cover"
            />
            <div className="attachment-info">
              <span className="attachment-type">
                {attachment.kind === 'service' ? 'Serviço' : 'Pack'}
              </span>
              <span className="attachment-title">{attachment.title}</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleRemoveAttachment}
            className="remove-attachment-btn"
          >
            ×
          </button>
        </div>
      )}

      {/* Selected File Display */}
      {mediaFile && (
        <div className="selected-file">
          <span>Arquivo selecionado: {mediaFile.name}</span>
          <button type="button" onClick={handleRemoveFile}>Remover</button>
        </div>
      )}

      <div className="post-creator-options">
        {/* Media Upload */}
        <div className="media-picker">
          <label>
            <span>Tipo de mídia (opcional):</span>
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
              <option value="image">Imagem</option>
              <option value="video">Vídeo</option>
              <option value="audio">Áudio</option>
            </select>
          </label>
          <input 
            type="file" 
            accept={mediaType+"/*"} 
            onChange={handleFileChange}
            placeholder="Escolha um arquivo (opcional)"
          />
        </div>

        {/* Category Selection (for Vixies/Vixink) */}
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        )}

        {/* Attachment Button (for Vixies/Vixink) */}
        {showAttachment && currentUser && (
          <button
            type="button"
            onClick={handleModalOpen}
            className="attach-service-btn"
          >
            <i className="fa-solid fa-paperclip"></i>
            Anexar Serviço
          </button>
        )}
      </div>

      <div className="post-creator-actions">
        <button
          onClick={handlePublish}
          disabled={isPublishing || (!postText.trim() && !mediaFile)}
          className="publish-btn"
        >
          {isPublishing ? 'Publicando...' : 'Publicar'}
        </button>
      </div>

      {/* Attachment Modal */}
      {showAttachmentModal && (
        <div className="modal-overlay">
          <div className="attachment-modal">
            <div className="modal-header">
              <h3>Anexar Serviço ou Pack</h3>
              <button 
                onClick={() => {
                  console.log('PostCreator: Modal closed');
                  setShowAttachmentModal(false);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <div className="attachment-grid">
              {loadingAttachments ? (
                <div className="loading">Carregando...</div>
              ) : (
                <>
                  {/* Services */}
                  {userServices.length > 0 && (
                    <div className="attachment-section">
                      <h4>Seus Serviços ({userServices.length})</h4>
                      <div className="items-grid">
                        {userServices.map(service => (
                          <div
                            key={service.id}
                            className="attachment-item"
                            onClick={() => handleAttachmentSelect(service)}
                          >
                            <img 
                              src={service.coverImageURL || service.coverImage} 
                              alt={service.title}
                              className="item-cover"
                            />
                            <span className="item-title">{service.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Packs */}
                  {userPacks.length > 0 && (
                    <div className="attachment-section">
                      <h4>Seus Packs ({userPacks.length})</h4>
                      <div className="items-grid">
                        {userPacks.map(pack => (
                          <div
                            key={pack.id}
                            className="attachment-item"
                            onClick={() => handleAttachmentSelect(pack)}
                          >
                            <img 
                              src={pack.coverImageURL || pack.coverImage} 
                              alt={pack.title}
                              className="item-cover"
                            />
                            <span className="item-title">{pack.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userServices.length === 0 && userPacks.length === 0 && (
                    <div className="no-attachments">
                      <p>Você ainda não tem serviços ou packs para anexar.</p>
                      <p>Crie alguns serviços ou packs primeiro!</p>
                      <p>Debug: userServices.length = {userServices.length}, userPacks.length = {userPacks.length}</p>
                      <p>Debug: loadingAttachments = {loadingAttachments.toString()}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCreator;
