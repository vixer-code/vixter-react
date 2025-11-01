import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { sendAnnouncementNotification } from '../services/notificationService';
import { database, storage, firestore } from '../../config/firebase';
import { ref, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import Portal from './Portal';
import VixiesWarningModal from './VixiesWarningModal';
import './PostCreator.css';

const PostCreator = ({ 
  mode = 'general_feed', // 'general_feed', 'vixies', 'vixink'
  onPostCreated = () => {},
  placeholder = "O que você está pensando?",
  showAttachment = false,
  categories = [],
  isAnnouncement = false // Novo parâmetro para indicar se é um aviso
}) => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { showSuccess, showError, showWarning } = useNotification();
  
  // Lista de tags que indicam conteúdo +18 (adulto)
  const adultTags = ['vixies', '+18', '18+', 'adulto', 'nsfw', 'adult', 'xxx', 'sexual', 'sexy', 'nude', 'nudes', 'droga', 'sexo', 'vagina', 'buceta', 'buraquinho', 'molhadinha'];
  
  // Post content state
  const [postText, setPostText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [attachment, setAttachment] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAdultContent, setIsAdultContent] = useState(false);
  
  // Attachment modal state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [userServices, setUserServices] = useState([]);
  const [userPacks, setUserPacks] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Vixies warning modal state
  const [showVixiesWarning, setShowVixiesWarning] = useState(false);
  const [pendingPublish, setPendingPublish] = useState(false);

  // Load user's services and packs for attachment
  useEffect(() => {
    if (showAttachment && currentUser) {
      loadUserAttachments();
    }
  }, [showAttachment, currentUser, userProfile]);

  // Load attachments when modal is opened
  useEffect(() => {
    if (showAttachmentModal && currentUser) {
      loadUserAttachments();
    }
  }, [showAttachmentModal, currentUser]);

  // Bloquear scroll do body quando modal está aberto
  useEffect(() => {
    if (showAttachmentModal) {
      // Salvar posição atual do scroll
      const scrollY = window.scrollY;
      
      // Bloquear scroll do body
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      // Cleanup: restaurar scroll quando modal fechar
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        
        // Restaurar posição do scroll
        window.scrollTo(0, scrollY);
      };
    }
  }, [showAttachmentModal]);

  // Load attachments when modal is opened (alternative approach)
  const handleModalOpen = async () => {
    if (currentUser) {
      await loadUserAttachments();
    }
    setShowAttachmentModal(true);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.setAttribute('tabindex', '-1');
        modal.focus();
      }
    }, 50);
  };

  const loadUserAttachments = async () => {
    if (!currentUser) return;
    
    setLoadingAttachments(true);
    try {
      // Função auxiliar para verificar se item tem conteúdo +18
      const hasAdultContent = (item) => {
        // Verificar categorias +18
        const adultCategories = ['conteudo-18', 'webnamoro']; // conteudo-18 para packs, webnamoro para serviços
        if (item.category && adultCategories.includes(item.category)) {
          return true;
        }
        
        // Verificar tags +18
        if (!item.tags || !Array.isArray(item.tags)) return false;
        return item.tags.some(tag => 
          adultTags.some(adultTag => 
            tag.toLowerCase().includes(adultTag.toLowerCase())
          )
        );
      };

      // Load services
      const servicesQuery = query(
        collection(firestore, 'services'),
        where('providerId', '==', currentUser.uid),
        where('isActive', '==', true)
      );
      const servicesSnapshot = await getDocs(servicesQuery);
      let services = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Service data loaded:', {
          id: doc.id,
          title: data.title,
          category: data.category,
          coverImageURL: data.coverImageURL,
          coverImage: data.coverImage,
          image: data.image,
          tags: data.tags,
          allFields: Object.keys(data)
        });
        return {
          id: doc.id,
          ...data,
          type: 'service'
        };
      });

      // Load packs
      const packsQuery = query(
        collection(firestore, 'packs'),
        where('authorId', '==', currentUser.uid),
        where('isActive', '==', true)
      );
      const packsSnapshot = await getDocs(packsQuery);
      let packs = packsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Pack data loaded:', {
          id: doc.id,
          title: data.title,
          category: data.category,
          coverImageURL: data.coverImageURL,
          coverImage: data.coverImage,
          image: data.image,
          tags: data.tags,
          allFields: Object.keys(data)
        });
        return {
          id: doc.id,
          ...data,
          type: 'pack'
        };
      });

      // Se o modo for vixink, filtrar conteúdo +18
      if (mode === 'vixink') {
        const originalServicesCount = services.length;
        const originalPacksCount = packs.length;
        
        services = services.filter(service => !hasAdultContent(service));
        packs = packs.filter(pack => !hasAdultContent(pack));
        
        const filteredServicesCount = originalServicesCount - services.length;
        const filteredPacksCount = originalPacksCount - packs.length;
        
        console.log(`Vixink mode: Filtered out ${filteredServicesCount} services and ${filteredPacksCount} packs with adult content (category or tags)`);
      }

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
    console.log('Selected attachment item:', {
      id: item.id,
      title: item.title,
      type: item.type,
      coverImageURL: item.coverImageURL,
      coverImage: item.coverImage,
      image: item.image,
      allFields: Object.keys(item)
    });
    
    const imageUrl = item.coverImageURL || item.coverImage || item.image;
    console.log('Selected image URL:', imageUrl);
    
    setAttachment({
      kind: item.type,
      id: item.id,
      title: item.title,
      coverUrl: imageUrl,
      coverImage: imageUrl,
      image: imageUrl
    });
    setShowAttachmentModal(false);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
  };

  // Function to handle WebP compatibility
  const getImageUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    
    // Fix URL construction for media.vixter.com.br
    if (url.startsWith('media.vixter.com.br/')) {
      url = `https://${url}`;
    }
    
    // For WebP images, we can add a fallback or ensure proper headers
    if (url.includes('.webp')) {
      // Add a timestamp to force refresh and ensure proper content-type
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}t=${Date.now()}`;
    }
    
    return url;
  };

  // Verifica se o usuário precisa ver o aviso Vixies
  const needsVixiesWarning = () => {
    if (mode !== 'vixies') return false;
    if (!userProfile || userProfile.accountType !== 'provider') return false;
    
    const lastAccepted = userProfile.vixiesWarningAcceptedAt;
    if (!lastAccepted) return true; // Nunca aceitou
    
    // Verifica se aceitou há mais de 7 dias (1 semana)
    const lastAcceptedDate = lastAccepted.toDate ? lastAccepted.toDate() : new Date(lastAccepted.seconds * 1000);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return lastAcceptedDate < oneWeekAgo;
  };

  const handlePublish = async () => {
    if (!currentUser) {
      showError('Você precisa estar logado para postar');
      return;
    }

    // Debug authentication and user data
    console.log('Current user:', {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL
    });
    console.log('User profile:', userProfile);
    console.log('User profile photo fields:', {
      profilePictureURL: userProfile?.profilePictureURL,
      photoURL: userProfile?.photoURL,
      avatar: userProfile?.avatar,
      image: userProfile?.image,
      allFields: userProfile ? Object.keys(userProfile) : 'No profile'
    });

    if (mode === 'vixies' && (!userProfile || userProfile.accountType !== 'provider')) {
      showWarning('Apenas provedores podem postar em Vixies');
      return;
    }

    if (mode === 'vixink' && (!userProfile || userProfile.accountType !== 'provider')) {
      showWarning('Apenas provedores podem postar em Vixink');
      return;
    }

    // General feed allows all users to post
    if (mode === 'general_feed') {
      // No restrictions - all users can post
    }

    // Verifica se precisa mostrar o aviso Vixies
    if (needsVixiesWarning()) {
      setPendingPublish(true);
      setShowVixiesWarning(true);
      return;
    }

    // Prossegue com a publicação normalmente
    await proceedWithPublish();
  };

  const proceedWithPublish = async () => {
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
        try {
          // Verify authentication token
          const token = await currentUser.getIdToken();
          console.log('Auth token exists:', !!token);
          console.log('Token details:', { uid: currentUser.uid, email: currentUser.email });
          
          const path = `${mode}/${currentUser.uid}/${Date.now()}_${mediaFile.name}`;
          console.log('Uploading media to path:', path);
          console.log('User UID:', currentUser.uid);
          console.log('User account type:', userProfile?.accountType);
          console.log('Mode:', mode);
          console.log('File details:', { 
            name: mediaFile.name, 
            size: mediaFile.size, 
            type: mediaFile.type 
          });
          
          const sref = storageRef(storage, path);
          console.log('Storage reference created:', sref.fullPath);
          
          const snap = await uploadBytes(sref, mediaFile);
          console.log('Upload completed, getting download URL...');
          
          const url = await getDownloadURL(snap.ref);
          mediaData = [{ type: mediaType, url }];
          console.log('Media uploaded successfully:', url);
        } catch (uploadError) {
          console.error('Error uploading media:', uploadError);
          console.error('Error code:', uploadError.code);
          console.error('Error message:', uploadError.message);
          showError(`Erro ao fazer upload da mídia: ${uploadError.message}`);
          return;
        }
      }

      // Get user photo URL from profile or auth
      const userPhotoURL = userProfile?.profilePictureURL || currentUser.photoURL || '/images/defpfp1.png';
      const userName = userProfile?.username || currentUser.displayName || 'Usuário';
      
      console.log('User photo sources:', {
        userProfilePhoto: userProfile?.profilePictureURL,
        currentUserPhoto: currentUser.photoURL,
        finalPhotoURL: userPhotoURL
      });

      // Create post data based on mode
      const isGeneralFeed = mode === 'general_feed';
      const baseTimestamp = Date.now();
      const firstImageUrl = Array.isArray(mediaData) && mediaData[0]?.type === 'image' ? mediaData[0].url : null;
      const postData = {
        content,
        authorId: currentUser.uid,
        authorName: userName,
        authorPhotoURL: userPhotoURL,
        authorUsername: userProfile?.username || '',
        timestamp: baseTimestamp,
        media: mediaData,
        attachment: isGeneralFeed ? null : (attachment || null),
        isAdultContent: isAdultContent,
        // Compatibility fields for /posts consumed by Profile.jsx
        ...(isGeneralFeed ? {
          userId: currentUser.uid,
          text: content,
          imageUrl: firstImageUrl,
          createdAt: baseTimestamp
        } : {})
      };

      // Add mode-specific fields
      if (mode === 'vixies' || mode === 'vixink') {
        postData.category = selectedCategory || 'all';
      }

      console.log('Post data to be sent:', postData);
      console.log('Database path:', mode === 'general_feed' ? 'posts' : `${mode}_posts`);
      console.log('Attachment data:', attachment);
      console.log('Media data:', mediaData);
      console.log('Attachment coverUrl:', attachment?.coverUrl);
      console.log('Attachment coverImage:', attachment?.coverImage);
      console.log('Attachment image:', attachment?.image);

      // Publish to appropriate database location
      if (isAnnouncement) {
        // Para avisos, usar Firestore
        const announcementsCollection = mode === 'general_feed' ? 'announcements_lobby' : 
                                       mode === 'vixies' ? 'announcements_vixies' : 
                                       mode === 'vixink' ? 'announcements_vixink' : 'announcements_lobby';
        
        const announcementsRef = collection(firestore, announcementsCollection);
        const announcementData = {
          ...postData,
          createdAt: Timestamp.now(),
          type: 'announcement',
          feedType: mode === 'general_feed' ? 'lobby' : mode
        };
        
        const newAnnouncementRef = await addDoc(announcementsRef, announcementData);
        
        // Enviar notificação para todos os usuários
        await sendAnnouncementNotification(
          mode === 'general_feed' ? 'lobby' : mode,
          newAnnouncementRef.id,
          content,
          currentUser.uid,
          userName
        );
        
        showSuccess('Aviso criado com sucesso!');
      } else {
        // Para posts normais, usar Realtime Database
        const postsRef = ref(database, mode === 'general_feed' ? 'posts' : `${mode}_posts`);
        await push(postsRef, postData);
        showSuccess('Post criado com sucesso!');
      }

      // Reset form
      setPostText('');
      setMediaFile(null);
      setAttachment(null);
      setSelectedCategory('all');
      setIsAdultContent(false);
      
      onPostCreated();
      
    } catch (error) {
      console.error('Error creating post:', error);
      showError('Erro ao criar post');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handlers do modal de aviso Vixies
  const handleVixiesWarningAccept = async () => {
    setShowVixiesWarning(false);
    setPendingPublish(false);
    // O modal já salvou a data de aceite, agora pode publicar
    await proceedWithPublish();
  };

  const handleVixiesWarningCancel = () => {
    setShowVixiesWarning(false);
    setPendingPublish(false);
    // Volta para edição (não publica)
    // Não precisa fazer nada, apenas fecha o modal
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
    
    if (!validImageTypes.includes(file.type) && !validVideoTypes.includes(file.type)) {
      showError('Tipo de arquivo não suportado. Use imagens (JPG, PNG, GIF, WebP) ou vídeos (MP4, MOV, AVI, WebM).');
      return;
    }

    // Validate file size (max 100MB for videos, 10MB for images)
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    const maxVideoSize = 100 * 1024 * 1024; // 100MB
    const maxSize = validImageTypes.includes(file.type) ? maxImageSize : maxVideoSize;
    
    if (file.size > maxSize) {
      const sizeType = validImageTypes.includes(file.type) ? 'imagens (10MB)' : 'vídeos (100MB)';
      showError(`Arquivo muito grande. O tamanho máximo para ${sizeType}.`);
      return;
    }

    // If it's a video, validate duration (max 60 seconds)
    if (validVideoTypes.includes(file.type)) {
      try {
        const duration = await getVideoDuration(file);
        if (duration > 60) {
          showError('Vídeos devem ter no máximo 60 segundos de duração.');
          return;
        }
        console.log(`Video duration: ${duration}s`);
      } catch (error) {
        console.error('Error getting video duration:', error);
        showError('Erro ao validar duração do vídeo. Tente novamente.');
        return;
      }
    }

    // Set media type based on file type
    const type = validVideoTypes.includes(file.type) ? 'video' : 'image';
    setMediaType(type);
    setMediaFile(file);
  };

  // Function to get video duration
  const getVideoDuration = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Error loading video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const handleRemoveFile = () => {
    setMediaFile(null);
  };

  return (
    <div className="post-creator">
      <div className="post-creator-header">
        <img
          src={userProfile?.profilePictureURL || currentUser?.photoURL || '/images/defpfp1.png'}
          alt={userProfile?.username || currentUser?.displayName || 'User'}
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
          <div className="file-info">
            <i className={`fas fa-${mediaType === 'video' ? 'video' : 'image'}`}></i>
            <div className="file-details">
              <span className="file-name">{mediaFile.name}</span>
              <span className="file-type">{mediaType === 'video' ? 'Vídeo' : 'Imagem'}</span>
              {mediaType === 'video' && (
                <span className="file-size">({(mediaFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
              )}
            </div>
          </div>
          <button type="button" onClick={handleRemoveFile} className="remove-file-btn">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="create-post-actions">
        <div className="action-buttons-left">
          <label className="action-btn">
            <i className="fa-solid fa-photo-film"></i> Mídia
            <input
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </label>
          {showAttachment && currentUser && (
            <button
              type="button"
              onClick={handleModalOpen}
              className="action-btn"
            >
              <i className="fa-solid fa-link"></i> Anexar Serviço
            </button>
          )}
        </div>
        <button
          onClick={handlePublish}
          disabled={isPublishing || (!postText.trim() && !mediaFile)}
          className="btn primary desktop-publish-btn"
        >
          {isPublishing ? 'Publicando...' : 'Publicar'}
        </button>
      </div>

      {/* Adult Content Checkbox - Only show for general_feed mode */}
      {mode === 'general_feed' && (
        <div className="adult-content-option">
          <label className="adult-content-checkbox">
            <input
              type="checkbox"
              checked={isAdultContent}
              onChange={(e) => setIsAdultContent(e.target.checked)}
            />
            <span className="checkbox-label">
              <i className="fas fa-exclamation-triangle"></i>
              Post tendencioso +18
            </span>
          </label>
          {isAdultContent && (
            <div className="adult-content-warning">
              <i className="fas fa-info-circle"></i>
              Este post só será visível para usuários com KYC ativo
            </div>
          )}
        </div>
      )}
      
      {/* Mobile publish button - shown below image and attach service on mobile */}
      <div className="mobile-publish-section">
        <button
          onClick={handlePublish}
          disabled={isPublishing || (!postText.trim() && !mediaFile)}
          className="btn primary mobile-publish-btn"
        >
          {isPublishing ? 'Publicando...' : 'Publicar'}
        </button>
      </div>

      {/* Vixies Warning Modal - usando Portal para renderizar fora da hierarquia */}
      {showVixiesWarning && (
        <Portal>
          <VixiesWarningModal
            isOpen={showVixiesWarning}
            onAccept={handleVixiesWarningAccept}
            onCancel={handleVixiesWarningCancel}
          />
        </Portal>
      )}

      {/* Attachment Modal */}
      {showAttachmentModal && (
        <Portal>
          <div className="modal-overlay" onClick={() => setShowAttachmentModal(false)}>
            <div className="attachment-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Anexar Serviço ou Pack</h3>
                <button 
                  onClick={() => setShowAttachmentModal(false)}
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
                        {userServices.map(service => {
                          const rawImageUrl = service.coverImageURL || 
                            service.coverImage?.publicUrl || 
                            service.coverImage || 
                            service.image;
                          const imageUrl = getImageUrl(rawImageUrl);
                          
                          console.log('Service image debug:', {
                            id: service.id,
                            title: service.title,
                            coverImageURL: service.coverImageURL,
                            coverImage: service.coverImage,
                            rawImageUrl,
                            finalImageUrl: imageUrl
                          });
                          
                          return (
                            <div
                              key={service.id}
                              className="attachment-item"
                              onClick={() => handleAttachmentSelect(service)}
                            >
                              <img 
                                src={imageUrl} 
                                alt={service.title}
                                className="item-cover"
                                onError={(e) => {
                                  console.log('Service image failed to load:', imageUrl);
                                  e.target.src = '/images/default-service.jpg';
                                }}
                                onLoad={() => console.log('Service image loaded:', imageUrl)}
                              />
                              <span className="item-title">{service.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Packs */}
                  {userPacks.length > 0 && (
                    <div className="attachment-section">
                      <h4>Seus Packs ({userPacks.length})</h4>
                      <div className="items-grid">
                        {userPacks.map(pack => {
                          const rawImageUrl = pack.coverImageURL || 
                            pack.coverImage?.publicUrl || 
                            pack.coverImage || 
                            pack.image;
                          const imageUrl = getImageUrl(rawImageUrl);
                          
                          console.log('Pack image debug:', {
                            id: pack.id,
                            title: pack.title,
                            coverImageURL: pack.coverImageURL,
                            coverImage: pack.coverImage,
                            rawImageUrl,
                            finalImageUrl: imageUrl
                          });
                          
                          return (
                            <div
                              key={pack.id}
                              className="attachment-item"
                              onClick={() => handleAttachmentSelect(pack)}
                            >
                              <img 
                                src={imageUrl} 
                                alt={pack.title}
                                className="item-cover"
                                onError={(e) => {
                                  console.log('Pack image failed to load:', imageUrl);
                                  e.target.src = '/images/default-service.jpg';
                                }}
                                onLoad={() => console.log('Pack image loaded:', imageUrl)}
                              />
                              <span className="item-title">{pack.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {userServices.length === 0 && userPacks.length === 0 && (
                    <div className="no-attachments">
                      <p>Você ainda não tem serviços ou packs para anexar.</p>
                      <p>Crie alguns serviços ou packs primeiro!</p>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

export default PostCreator;
