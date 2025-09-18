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
  mode = 'general_feed', // 'general_feed', 'vixies', 'vixink'
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

  // Load attachments when modal is opened (alternative approach)
  const handleModalOpen = async () => {
    if (currentUser) {
      await loadUserAttachments();
    }
    setShowAttachmentModal(true);
  };

  const loadUserAttachments = async () => {
    if (!currentUser) return;
    
    setLoadingAttachments(true);
    try {
      // Load services
      const servicesQuery = query(
        collection(firestore, 'services'),
        where('providerId', '==', currentUser.uid),
        where('isActive', '==', true)
      );
      const servicesSnapshot = await getDocs(servicesQuery);
      const services = servicesSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Service data loaded:', {
          id: doc.id,
          title: data.title,
          coverImageURL: data.coverImageURL,
          coverImage: data.coverImage,
          image: data.image,
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
      const packs = packsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Pack data loaded:', {
          id: doc.id,
          title: data.title,
          coverImageURL: data.coverImageURL,
          coverImage: data.coverImage,
          image: data.image,
          allFields: Object.keys(data)
        });
        return {
          id: doc.id,
          ...data,
          type: 'pack'
        };
      });

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

    // Debug authentication
    console.log('Current user:', currentUser);
    console.log('User profile:', userProfile);
    console.log('Mode:', mode);

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
      const postsRef = ref(database, mode === 'general_feed' ? 'posts' : `${mode}_posts`);
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
          <span>Arquivo selecionado: {mediaFile.name}</span>
          <button type="button" onClick={handleRemoveFile}>Remover</button>
        </div>
      )}

      <div className="create-post-actions">
        <div className="action-buttons-left">
          <label className="action-btn">
            <i className="fa-solid fa-image"></i> Imagem
            <input
              type="file"
              accept="image/*"
              multiple
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
          className="btn primary"
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
                          const imageUrl = getImageUrl(service.coverImageURL || service.coverImage);
                          
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
                          const imageUrl = getImageUrl(pack.coverImageURL || pack.coverImage);
                          
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
      )}
    </div>
  );
};

export default PostCreator;
