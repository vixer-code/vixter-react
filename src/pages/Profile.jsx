import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ref, get, set, remove, push, query, orderByChild, equalTo, update, onValue, off } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { usePacksR2 as usePacks } from '../contexts/PacksContextR2';
import ReviewsSection from '../components/ReviewsSection';
import { useServicesR2 as useServices } from '../contexts/ServicesContextR2';
import { useNotification } from '../contexts/NotificationContext';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { sendPostInteractionNotification } from '../services/notificationService';
import { getDefaultImage } from '../utils/defaultImages';
import { getProfileUrl } from '../utils/profileUrls';
import { useEmailVerification } from '../hooks/useEmailVerification';
const CreateServiceModal = lazy(() => import('../components/CreateServiceModal'));
const CreatePackModal = lazy(() => import('../components/CreatePackModal'));
import CachedImage from '../components/CachedImage';
import SmartMediaViewer from '../components/SmartMediaViewer';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import PurpleSpinner from '../components/PurpleSpinner';
import DeleteServiceModal from '../components/DeleteServiceModal';
import DeletePackModal from '../components/DeletePackModal';
import PackBuyersModal from '../components/PackBuyersModal';
import './Profile.css';

const Profile = () => {
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile, getUserById, getUserByUsername, updateUserProfile, formatUserDisplayName, getUserAvatarUrl, loading: userLoading } = useUser();
  
  // Get account type from user profile
  const accountType = userProfile?.accountType || 'client';
  const isProvider = accountType === 'provider';
  const isClient = accountType === 'client';
  const isBoth = accountType === 'both'; // Legacy account type for management/testing
  const { userPacks: firestorePacks, loading: packsLoading, loadUserPacks, createPack, updatePack, deletePack } = usePacks();
  const { services: firestoreServices, loading: servicesLoading, loadUserServices, updateServiceStatus, deleteService } = useServices();
  const { isVerified, isChecking } = useEmailVerification();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  const { createOrGetConversation } = useEnhancedMessaging();
  
  const [profile, setProfile] = useState(null);
  
  // Calculate isOwner after profile is declared
  const isOwner = !username || currentUser?.uid === profile?.id;
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
  const [bannerDismissed, setBannerDismissed] = useState(false);
  
  // Post interaction states
  const [commentsByPost, setCommentsByPost] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [showReplyInputs, setShowReplyInputs] = useState({});
  const [repostStatus, setRepostStatus] = useState({});
  const [following, setFollowing] = useState([]);
  const [users, setUsers] = useState({});
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [showCreatePackModal, setShowCreatePackModal] = useState(false);
  const [editingPack, setEditingPack] = useState(null);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [showDeleteServiceModal, setShowDeleteServiceModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [showDeletePackModal, setShowDeletePackModal] = useState(false);
  const [packToDelete, setPackToDelete] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStatus, setDeleteStatus] = useState('');

  // Direct Firebase Storage uploads only

  // Visitor preview modals before buying
  const [showServicePreview, setShowServicePreview] = useState(false);
  const [serviceToPreview, setServiceToPreview] = useState(null);
  const [showPackPreview, setShowPackPreview] = useState(false);
  const [packToPreview, setPackToPreview] = useState(null);

  // Service purchase confirmation (refund policy)
  const [showServiceConfirm, setShowServiceConfirm] = useState(false);
  const [confirmServiceAck, setConfirmServiceAck] = useState(false);
  const [servicePendingPurchase, setServicePendingPurchase] = useState(null);
  // Pack purchase confirmation (refund policy)
  const [showPackConfirm, setShowPackConfirm] = useState(false);
  const [confirmPackAck, setConfirmPackAck] = useState(false);
  const [packPendingPurchase, setPackPendingPurchase] = useState(null);

  // Service sales view (owner)
  const [showServiceSalesModal, setShowServiceSalesModal] = useState(false);
  const [salesService, setSalesService] = useState(null);
  const [serviceSales, setServiceSales] = useState([]);
  const [serviceSalesLoading, setServiceSalesLoading] = useState(false);
  const [serviceTotalVCEarned, setServiceTotalVCEarned] = useState(0);

  // Pack sales view (owner)
  const [showPackSalesModal, setShowPackSalesModal] = useState(false);
  const [salesPack, setSalesPack] = useState(null);
  const [packSales, setPackSales] = useState([]);
  const [packSalesLoading, setPackSalesLoading] = useState(false);
  const [packTotalVCEarned, setPackTotalVCEarned] = useState(0);


  // Pack buyers modal
  const [showPackBuyersModal, setShowPackBuyersModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);

  // Open pack buyers modal
  const openPackBuyers = (pack) => {
    setSelectedPack(pack);
    setShowPackBuyersModal(true);
  };

  // Handle message button click
  const handleMessageClick = async () => {
    if (!currentUser || !profile) return;
    
    if (currentUser.uid === profile.uid) {
      showWarning('Você não pode enviar mensagem para si mesmo');
      return;
    }

    try {
      const conversation = await createOrGetConversation(profile.uid);
      if (conversation) {
        navigate('/messages');
      } else {
        showError('Erro ao criar conversa');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      showError('Erro ao criar conversa');
    }
  };


  // Toggle animation state
  const [switchingServiceId, setSwitchingServiceId] = useState(null);
  const [switchingPackId, setSwitchingPackId] = useState(null);

  // Sales dashboard states (provider only)
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState(null);
  const [totalVCEarned, setTotalVCEarned] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [bestSellers, setBestSellers] = useState([]); // {id, title, type, totalVC, count}
  const [topBuyers, setTopBuyers] = useState([]); // {buyerId, username, count, totalVC}
  const [recentSales, setRecentSales] = useState([]); // recent combined sales
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Load profile from UserContext or Firestore
  useEffect(() => {
    const loadProfileData = async () => {
      setLoading(true);
      
      if (!username && userProfile) {
        // Current user profile from UserContext
        setProfile(userProfile);
        setLoading(false);
      } else if (username) {
        // Check if this is the current user's own profile by username
        if (userProfile && userProfile.username === username) {
          // This is the current user's own profile accessed via username
          setProfile(userProfile);
          loadFollowers(userProfile.id);
          setLoading(false);
          return;
        }
        
        // Other user profile from Firestore by username
        try {
          const userData = await getUserByUsername(username);
          if (userData) {
            setProfile(userData);
            // Load followers for the found user
            loadFollowers(userData.id);
          } else {
            showError('Usuário não encontrado.', 'Erro');
            navigate('/');
            return;
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
          showError('Erro ao carregar perfil.', 'Erro');
        }
        setLoading(false);
      }
    };

    loadProfileData();
  }, [username, currentUser, userProfile, getUserByUsername, showError, navigate]);

  // Form state for editing
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    location: '',
    interests: [],
    languages: '',
    hobbies: '',
    aboutMe: ''
  });

  // Initialize form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        location: profile.location || '',
        interests: profile.interests || [],
        languages: profile.languages || '',
        hobbies: profile.hobbies || '',
        aboutMe: profile.aboutMe || ''
      });
    }
  }, [profile]);

  // Services managed by ServicesContext - no need for separate hook

  // Load user services from Firestore
  useEffect(() => {
    // Only load services if we have a profile (either current user or visited user)
    if (profile?.id) {
      loadUserServices(profile.id);
    }
  }, [profile?.id, loadUserServices]);

  // Load user packs from Firestore
  useEffect(() => {
    // Only load packs if we have a profile (either current user or visited user)
    if (profile?.id) {
      loadUserPacks(profile.id);
    }
  }, [profile?.id, loadUserPacks]);


  // Load followers and posts for any profile
  useEffect(() => {
    if (profile) {
      loadFollowers(profile.id);
      loadPosts(profile.id);
    }
  }, [profile]);

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

  // loadProfile removed - handled by UserContext

  const loadFollowers = async (targetUserId) => {
    try {
      // Load followers from Firestore subcollection
      const { collection, getDocs } = await import('firebase/firestore');
      const { firestore } = await import('../../config/firebase');
      
      const followersRef = collection(firestore, 'users', targetUserId, 'followers');
      const snapshot = await getDocs(followersRef);
      
      if (!snapshot.empty) {
        const followerIds = snapshot.docs.map(doc => doc.id);
        
        // Fetch follower profiles using UserContext
        const followerPromises = followerIds.map(async (followerId) => {
          const userData = await getUserById(followerId);
          return userData ? { id: followerId, ...userData } : null;
        });
        
        const followers = (await Promise.all(followerPromises)).filter(f => f !== null);
        setFollowers(followers);
        
        // Check if current user is following
        if (currentUser) {
          setIsFollowing(followerIds.includes(currentUser.uid));
        }
      } else {
        setFollowers([]);
        setIsFollowing(false);
      }
    } catch (error) {
      console.error('Error loading followers:', error);
      setFollowers([]);
      setIsFollowing(false);
    }
  };

  const loadPosts = async (userId) => {
    try {
      // Load user's own posts (including reposts they made)
      const postsRootRef = ref(database, 'posts');
      const postsByUserQuery = query(postsRootRef, orderByChild('userId'), equalTo(userId));
      const snapshot = await get(postsByUserQuery);
      const postsList = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const postData = child.val();
          postsList.push({ 
            id: child.key, 
            ...postData, 
            _displayTimestamp: postData?.createdAt || postData?.timestamp || 0 
          });
        });
      }

      // Sort combined list by display timestamp desc
      postsList.sort((a, b) => (b._displayTimestamp || b.createdAt || b.timestamp || 0) - (a._displayTimestamp || a.createdAt || a.timestamp || 0));
      setPosts(postsList);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

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

  // Navigate to pack detail page for visitors
  const handleOpenPackPreview = (pack) => {
    navigate(`/pack/${pack.id}`);
  };

  const handleDeletePack = async (packId) => {
    if (!currentUser) return;
    
    // Find the pack to show its title in the modal
    const pack = firestorePacks.find(p => p.id === packId);
    if (pack) {
      setPackToDelete({ id: packId, title: pack.title });
      setShowDeletePackModal(true);
    }
  };

  const confirmDeletePack = async () => {
    if (!packToDelete) return;
    
    try {
      await deletePack(packToDelete.id, (progress, status) => {
        setDeleteProgress(progress);
        setDeleteStatus(status);
      });
      
      // Close modal and reset state
      setShowDeletePackModal(false);
      setPackToDelete(null);
      setDeleteProgress(0);
      setDeleteStatus('');
    } catch (error) {
      console.error('Error deleting pack:', error);
      setDeleteProgress(0);
      setDeleteStatus('');
      alert('Erro ao excluir pack. Tente novamente.');
    }
  };

  const cancelDeletePack = () => {
    setShowDeletePackModal(false);
    setPackToDelete(null);
  };

  const handlePackStatusChange = async (packId, newStatus) => {
    if (!currentUser) return;
    try {
      await updatePack(packId, { status: newStatus, updatedAt: Date.now() });
    } catch (error) {
      console.error('Error updating pack status:', error);
      alert('Erro ao atualizar status do pack. Tente novamente.');
    }
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setShowCreateServiceModal(true);
  };

  // Navigate to service detail page for visitors
  const handleOpenServicePreview = (service) => {
    navigate(`/service/${service.id}`);
  };

  // Purchase functions will be implemented via Cloud Functions for atomic transactions
  // All balance mutations are now handled by Cloud Functions to ensure data consistency

  // Purchase handlers for visitors - TODO: Implement via Cloud Functions
  const handlePurchaseService = async (service) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (isOwner) return; // Safety guard

    showWarning('🚧 Compra de serviços será implementada via Cloud Functions em breve!', 'Funcionalidade em Desenvolvimento');
    
    // TODO: Call Cloud Function processServicePurchase
    // const result = await httpsCallable(functions, 'processServicePurchase')({ serviceId: service.id });
  };

  // Owner: open service sales modal - TODO: Load from Firestore
  const openServiceSales = async (service) => {
    if (!currentUser || !isOwner) return;
    setSalesService(service);
    setServiceSalesLoading(true);
    setShowServiceSalesModal(true);
    
    // TODO: Load sales data from Firestore serviceOrders collection
    showInfo('🚧 Recibos de vendas serão carregados do Firestore em breve!', 'Funcionalidade em Desenvolvimento');
    setServiceSales([]);
    setServiceTotalVCEarned(0);
    setServiceSalesLoading(false);
  };

  // Owner: open pack sales modal - TODO: Load from Firestore
  const openPackSales = async (pack) => {
    if (!currentUser || !isOwner) return;
    setSalesPack(pack);
    setPackSalesLoading(true);
    setShowPackSalesModal(true);
    
    // TODO: Load sales data from Firestore packOrders collection
    showInfo('🚧 Recibos de vendas serão carregados do Firestore em breve!', 'Funcionalidade em Desenvolvimento');
    setPackSales([]);
    setPackTotalVCEarned(0);
    setPackSalesLoading(false);
  };

  const handlePurchasePack = async (pack) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (isOwner) return; // Safety guard

    showWarning('🚧 Compra de packs será implementada via Cloud Functions em breve!', 'Funcionalidade em Desenvolvimento');
    
    // TODO: Call Cloud Function processPackPurchase
    // const result = await httpsCallable(functions, 'processPackPurchase')({ packId: pack.id });
  };

  const handleDeleteService = async (serviceId) => {
    // Find the service to show its title in the modal
    const service = firestoreServices.find(s => s.id === serviceId);
    if (service) {
      setServiceToDelete({ id: serviceId, title: service.title });
      setShowDeleteServiceModal(true);
    }
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    
    try {
      await deleteService(serviceToDelete.id);
      
      // Close modal and reset state
      setShowDeleteServiceModal(false);
      setServiceToDelete(null);
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Erro ao excluir serviço. Tente novamente.');
    }
  };

  const cancelDeleteService = () => {
    setShowDeleteServiceModal(false);
    setServiceToDelete(null);
  };

  const handleFollowerClick = (follower) => {
    setShowFollowersModal(false);
    navigate(getProfileUrl(follower));
  };

  const handleDeletePost = async (postId) => {
    if (!currentUser) {
      console.log('No current user found');
      return;
    }
    
    console.log('Current user:', currentUser.uid);
    console.log('Attempting to delete post:', postId);
    
    // Find the post to show its content in the modal
    const post = posts.find(p => p.id === postId);
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
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    
    // Check if database is properly initialized
    if (!database) {
      alert('Erro: Banco de dados não inicializado.');
      return;
    }
    
    // Check if user is authenticated
    if (!currentUser || !currentUser.uid) {
      alert('Erro: Usuário não autenticado.');
      return;
    }
    
    // Validate post ID
    if (!postToDelete.id || typeof postToDelete.id !== 'string' || postToDelete.id.trim() === '') {
      alert('Erro: ID da publicação inválido.');
      return;
    }
    
    try {
      // Remove post from database
      const postRef = ref(database, `posts/${postToDelete.id}`);
      
      // Check if the post exists before trying to delete
      const postSnapshot = await get(postRef);
      
      if (!postSnapshot.exists()) {
        alert('Publicação não encontrada no banco de dados.');
        return;
      }
      
      // Verify the current user is the owner of the post
      const postData = postSnapshot.val();
      
      if (postData.userId !== currentUser.uid) {
        alert('Você não tem permissão para excluir esta publicação.');
        return;
      }
      
      // Remove the main post first
      await remove(postRef);
      
      // Update local state immediately after successful post deletion
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postToDelete.id));
      
      // Close modal and reset state
      setShowDeleteModal(false);
      setPostToDelete(null);
      
      // Try to remove associated likes but don't fail if it doesn't exist
      try {
        const likesRef = ref(database, `likes/${postToDelete.id}`);
        await remove(likesRef);
      } catch (likesError) {
        // Don't fail the entire operation if likes removal fails
      }
      
      
      // Show success message
      alert('Publicação removida com sucesso!');
      
    } catch (error) {
      console.error('Error deleting post:', error);
      
      // Handle specific Firebase error codes
      if (error.code === 'PERMISSION_DENIED') {
        alert('Permissão negada. Verifique se você está logado e é o proprietário da publicação.');
      } else if (error.code === 'UNAUTHORIZED') {
        alert('Usuário não autorizado. Faça login novamente.');
      } else if (error.code === 'NOT_FOUND') {
        alert('Publicação não encontrada no banco de dados.');
      } else {
        alert(`Erro ao excluir publicação: ${error.message}`);
      }
    }
  };

  const cancelDeletePost = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const handleServiceStatusChange = async (serviceId, newStatus) => {
    try {
      await updateServiceStatus(serviceId, newStatus);
    } catch (error) {
      console.error('Error updating service status:', error);
      alert('Erro ao atualizar status do serviço. Tente novamente.');
    }
  };

  // loadPacks removed - now handled by PacksContext

  // Removed loadSubscriptions state and fetch for now (feature coming soon)


  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file || !currentUser) return;

    try {
      console.log('Starting image upload:', { 
        type, 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type,
        currentUser: currentUser?.uid 
      });
      setUploading(true);

      // Direct upload to Firebase Storage
      const path = type === 'avatar' ? `profilePictures/${currentUser.uid}/${file.name}` : `coverPhotos/${currentUser.uid}/${file.name}`;
      console.log('Uploading to Firebase Storage path:', path);
      
      const fileRef = storageRef(storage, path);
      console.log('File reference created, attempting upload...');
      await uploadBytes(fileRef, file, {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable'
      });
      console.log('File uploaded successfully, getting download URL');
      const finalURL = await getDownloadURL(fileRef);
      console.log('Download URL obtained:', finalURL);
      
      // Update database with the URL using UserContext
      const updateData = {};
      updateData[type === 'avatar' ? 'profilePictureURL' : 'coverPhotoURL'] = finalURL;
      
      const success = await updateUserProfile(updateData);
      if (success) {
        console.log('Profile updated successfully');
      }
      
      setUploading(false);
      console.log('Image upload completed successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploading(false);
      alert('Erro ao fazer upload da imagem. Tente novamente.');
    }
  };

  const handleFollow = async () => {
    if (!currentUser) return;

    try {
      const { doc, setDoc, deleteDoc, writeBatch, increment } = await import('firebase/firestore');
      const { firestore } = await import('../../config/firebase');
      
      const targetUserId = profile?.id || currentUser.uid;
      const followerRef = doc(firestore, 'users', targetUserId, 'followers', currentUser.uid);
      const followingRef = doc(firestore, 'users', currentUser.uid, 'following', targetUserId);
      const targetUserDoc = doc(firestore, 'users', targetUserId);
      const currentUserDoc = doc(firestore, 'users', currentUser.uid);
      
      const batch = writeBatch(firestore);
      if (isFollowing) {
        batch.delete(followerRef);
        batch.delete(followingRef);
        batch.update(targetUserDoc, { followersCount: increment(-1), updatedAt: new Date() });
        batch.update(currentUserDoc, { followingCount: increment(-1), updatedAt: new Date() });
      } else {
        batch.set(followerRef, { followedAt: Date.now(), followerId: currentUser.uid });
        batch.set(followingRef, { followedAt: Date.now(), followingId: targetUserId });
        batch.update(targetUserDoc, { followersCount: increment(1), updatedAt: new Date() });
        batch.update(currentUserDoc, { followingCount: increment(1), updatedAt: new Date() });
      }
      await batch.commit();
      setIsFollowing(!isFollowing);
      
      // Update followers count locally without reloading the entire list
      if (isFollowing) {
        // User unfollowed - decrease followers count
        setFollowers(prevFollowers => {
          const updatedFollowers = prevFollowers.filter(f => f.id !== currentUser.uid);
          return updatedFollowers;
        });
      } else {
        // User followed - add current user to followers list
        if (currentUser && userProfile) {
          const newFollower = {
            id: currentUser.uid,
            displayName: userProfile.displayName || currentUser.displayName || 'Usuário',
            username: userProfile.username || '',
            profilePictureURL: userProfile.profilePictureURL || currentUser.photoURL || null
          };
          setFollowers(prevFollowers => [...prevFollowers, newFollower]);
        }
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    try {
      const success = await updateUserProfile(formData);
      if (success) {
        setEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleCancel = () => {
    setFormData({
      displayName: profile?.displayName || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      interests: profile?.interests || [],
      languages: profile?.languages || '',
      hobbies: profile?.hobbies || '',
      aboutMe: profile?.aboutMe || ''
    });
    setEditing(false);
  };

  const handleCreatePost = async () => {
    if (!currentUser) return;
    const text = newPostContent.trim();
    if (!text && selectedImages.length === 0) return;

    try {
      // Upload selected images to Storage and collect URLs
      const imageUrls = [];
      if (selectedImages.length > 0) {
        const uploads = selectedImages.map(async (file) => {
          const path = `posts/${currentUser.uid}/${Date.now()}_${file.name}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, file);
          return getDownloadURL(fileRef);
        });
        const resolved = await Promise.all(uploads);
        imageUrls.push(...resolved);
      }

      // Extract hashtags similar to vanilla feed implementation
      const hashtags = (text.match(/#(\w+)/g) || []).map(t => t.replace('#', ''));

      const newPost = {
        userId: currentUser.uid,
        content: text,
        images: imageUrls,
        createdAt: Date.now(),
        authorName: profile?.displayName || currentUser.displayName || 'Você',
        authorPhoto: profile?.profilePictureURL || currentUser.photoURL || null,
        authorUsername: profile?.username || '',
        hashtags
      };

      const postsRootRef = ref(database, 'posts');
      await push(postsRootRef, newPost);

      // Reset UI and reload user's posts
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

  const handleInterestChange = (index, value) => {
    const newInterests = [...formData.interests];
    newInterests[index] = value;
    setFormData({ ...formData, interests: newInterests });
  };

  const addInterest = () => {
    if (formData.interests.length < 5) {
      setFormData({ ...formData, interests: [...formData.interests, ''] });
    }
  };

  const removeInterest = (index) => {
    const newInterests = formData.interests.filter((_, i) => i !== index);
    setFormData({ ...formData, interests: newInterests });
  };

  // Post interaction functions (similar to Feed.jsx)
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
        const userProfile = users[post.userId || post.authorId];
        const actorName = userProfile?.displayName || currentUser.displayName || 'Usuário';
        const actorUsername = userProfile?.username || '';
        
        await sendPostInteractionNotification(
          post.userId || post.authorId,
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
  }, [currentUser?.uid, showError, showWarning, users]);

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
        text: post.content || post.text || '',
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
  }, [currentUser, showSuccess, showError, showWarning, users]);

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

  const handleDeleteComment = useCallback(async (postId, comment) => {
    if (!currentUser || comment.authorId !== currentUser.uid) return;
    
    try {
      const commentRef = ref(database, `comments/${postId}/${comment.id}`);
      await remove(commentRef);
      await loadComments(postId);
      showSuccess('Comentário deletado');
    } catch (error) {
      console.error('Error deleting comment:', error);
      showError('Erro ao deletar comentário');
    }
  }, [currentUser, loadComments, showSuccess, showError]);

  const likeComment = useCallback(async (postId, comment) => {
    if (!currentUser) return;
    
    try {
      const commentRef = ref(database, `comments/${postId}/${comment.id}`);
      const commentSnap = await get(commentRef);
      
      if (!commentSnap.exists()) return;
      
      const commentData = commentSnap.val();
      const likedBy = commentData.likedBy || [];
      const isLiked = likedBy.includes(currentUser.uid);
      
      let newLikedBy;
      let newLikes;
      
      if (isLiked) {
        // Unlike
        newLikedBy = likedBy.filter(uid => uid !== currentUser.uid);
        newLikes = Math.max(0, (commentData.likes || 0) - 1);
      } else {
        // Like
        newLikedBy = [...likedBy, currentUser.uid];
        newLikes = (commentData.likes || 0) + 1;
      }
      
      await update(commentRef, {
        likedBy: newLikedBy,
        likes: newLikes
      });
      
      await loadComments(postId);
    } catch (error) {
      console.error('Error liking comment:', error);
      showError('Erro ao curtir comentário');
    }
  }, [currentUser, loadComments, showError]);

  const toggleReplyInput = useCallback((postId, commentId) => {
    const key = `${postId}:${commentId}`;
    setShowReplyInputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  // Load users and repost status when posts change
  useEffect(() => {
    if (posts.length === 0) return;

    const loadUsersAndRepostStatus = async () => {
      // Load users data
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      const usersData = {};
      if (usersSnapshot.exists()) {
        usersSnapshot.forEach((childSnapshot) => {
          usersData[childSnapshot.key] = childSnapshot.val();
        });
      }
      setUsers(usersData);

      // Load repost status for current user
      if (currentUser?.uid) {
        const repostStatusData = {};
        const repostPromises = posts.map(async (post) => {
          const originalPostId = post.isRepost ? post.originalPostId : post.id;
          try {
            const repostRef = ref(database, `generalReposts/${originalPostId}/${currentUser.uid}`);
            const repostSnap = await get(repostRef);
            repostStatusData[originalPostId] = repostSnap.exists();
          } catch (error) {
            repostStatusData[originalPostId] = false;
          }
        });
        await Promise.all(repostPromises);
        setRepostStatus(repostStatusData);
      }
    };

    loadUsersAndRepostStatus();
  }, [posts, currentUser?.uid]);

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

  // Load and compute sales dashboard - TODO: Load from Firestore orders
  const loadSalesDashboard = useCallback(async () => {
    if (!currentUser || !isOwner || !isProvider) return;
    setSalesLoading(true);
    setSalesError(null);
    
    // TODO: Load from Firestore serviceOrders and packOrders collections
    showInfo('🚧 Dashboard de vendas será carregado do Firestore em breve!', 'Funcionalidade em Desenvolvimento');
    
    // Mock empty data for now
    setRecentSales([]);
    setBestSellers([]);
    setTopBuyers([]);
    setTotalVCEarned(0);
    setTotalSalesCount(0);
    setSalesLoading(false);
  }, [currentUser, isOwner, isProvider]);

  // Sales dashboard functionality removed (was orphaned code)
  // Dashboards are now embedded within services tab

  // Preload cover image immediately for LCP optimization
  useEffect(() => {
    if (profile?.coverPhotoURL) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = profile.coverPhotoURL;
      link.fetchpriority = 'high';
      document.head.appendChild(link);
      
      return () => {
        // Cleanup on unmount
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      };
    }
  }, [profile?.coverPhotoURL]);

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

  const handleWithdraw = async () => {
    if (!currentUser) return;
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      showWarning('Informe um valor válido', 'Valor inválido');
      return;
    }
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://vixter-react-llyd.vercel.app'}/api/provider/manual-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount })
      }).catch(() => null);
      if (res && res.ok) {
        showSuccess('Solicitação de saque enviada!', 'Saque');
        setWithdrawAmount('');
        return;
      }
    } catch (e) {}
    try {
      await push(ref(database, `users/${currentUser.uid}/payoutRequests`), {
        amount,
        timestamp: Date.now(),
        status: 'pending'
      });
      showInfo('Pedido de saque registrado. Processaremos em breve.', 'Saque em análise');
      setWithdrawAmount('');
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      showError('Erro ao solicitar saque. Tente novamente.', 'Erro');
    }
  };

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
              sizes="100vw"
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
            {isOwner ? (
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
                <i className="fas fa-camera"></i>
              </label>
            ) : (
              <CachedImage 
                src={profile.profilePictureURL}
                defaultType="PROFILE_1"
                alt="Avatar de Perfil"
                className="profile-avatar-img"
                priority={false}
                sizes={avatarSizes}
                showLoading={true}
              />
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
              @{profile.username || 'username'}
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
                Entrou em {profile.createdAt ? (() => {
                  try {
                    // Handle Firestore Timestamp
                    if (profile.createdAt && typeof profile.createdAt.toDate === 'function') {
                      return profile.createdAt.toDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    }
                    // Handle regular Date or timestamp
                    return new Date(profile.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                  } catch (error) {
                    console.error('Error formatting date:', error);
                    return 'janeiro de 2025';
                  }
                })() : 'janeiro de 2025'}
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
                  <button className="message-btn" onClick={handleMessageClick}>
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
                    src={userProfile?.profilePictureURL || profile?.profilePictureURL}
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
                posts.map((post) => {
                  // Determine if this is a repost and get the correct post data
                  const isRepost = post.isRepost || post._isRepost;
                  const originalPostId = isRepost ? post.originalPostId : post.id;
                  
                  // For reposts, we need to get the original post data for interactions
                  // but show the reposter's info in the header
                  let displayPost, reposterInfo, originalPostData;
                  
                  if (isRepost) {
                    // This is a repost - we need to fetch the original post data
                    reposterInfo = {
                      id: post.userId || post.authorId,
                      name: post.authorName || post.userName,
                      username: post.authorUsername || post.username,
                      photo: post.authorPhotoURL || post.userPhotoURL
                    };
                    
                    // For now, use the repost data as display post
                    // In a real implementation, you'd fetch the original post
                    displayPost = {
                      id: originalPostId,
                      content: post.originalContent || post.content,
                      media: post.originalMedia || post.media,
                      likes: post.likes || {},
                      likeCount: post.likeCount || 0,
                      repostCount: post.repostCount || 0,
                      authorId: post.originalAuthorId || post.authorId,
                      authorName: post.originalAuthorName || post.authorName,
                      authorUsername: post.originalAuthorUsername || post.authorUsername,
                      authorPhotoURL: post.originalAuthorPhotoURL || post.authorPhotoURL,
                      timestamp: post.originalTimestamp || post.timestamp
                    };
                  } else {
                    // This is a regular post
                    displayPost = post;
                    reposterInfo = null;
                  }

                  // Get media array for display
                  const mediaArray = displayPost.media || (displayPost.imageUrl ? [{ type: 'image', url: displayPost.imageUrl }] : []);
                  const contentText = displayPost.content || displayPost.text || '';

                  // Check if current user liked this post
                  const isLiked = displayPost.likes && displayPost.likes[currentUser?.uid];
                  const isReposted = repostStatus[originalPostId] || false;

                  return (
                    <div key={post.id} className="post-card">
                      {isRepost && (
                        <div className="repost-indicator">
                          <i className="fas fa-retweet"></i>
                          <span>
                            <strong>{reposterInfo?.name}</strong> repostou
                          </span>
                        </div>
                      )}

                      <div className="post-header">
                        <div className="post-author">
                          <div className="post-author-avatar">
                            <CachedImage
                              src={displayPost.authorPhotoURL || displayPost.authorPhoto}
                              fallbackSrc="/images/default-avatar.jpg"
                              alt={displayPost.authorName}
                              sizes="48px"
                              showLoading={false}
                            />
                          </div>
                          <div className="author-info">
                            <div className="post-author-name">{displayPost.authorName}</div>
                            <div className="post-time">
                              {displayPost.timestamp
                                ? new Date(displayPost.timestamp).toLocaleDateString('pt-BR')
                                : 'Agora'}
                            </div>
                          </div>
                        </div>
                        {isOwner && !isRepost && (
                          <button className="delete-btn" onClick={() => handleDeletePost(post.id)}>
                            ✕
                          </button>
                        )}
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

                      {expandedComments[originalPostId] && (
                        <div className="comments-section">
                          <div className="comment-input">
                            <input
                              type="text"
                              placeholder="Escreva um comentário..."
                              value={commentInputs[originalPostId] || ''}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [originalPostId]: e.target.value }))}
                              onKeyPress={(e) => e.key === 'Enter' && addComment(originalPostId)}
                            />
                            <button 
                              className="btn small" 
                              onClick={() => addComment(originalPostId)}
                              disabled={!commentInputs[originalPostId]?.trim()}
                            >
                              Comentar
                            </button>
                          </div>
                          
                          {commentsByPost[originalPostId]?.items?.length > 0 ? (
                            <div className="comments-list">
                              {commentsByPost[originalPostId].items.map((comment) => {
                                const isCommentLiked = comment.likedBy && comment.likedBy.includes(currentUser?.uid);
                                const replyKey = `${originalPostId}:${comment.id}`;
                                
                                return (
                                  <div key={comment.id} className="comment-item">
                                    <div className="comment-header">
                                      <div className="comment-avatar">
                                        <CachedImage
                                          src={comment.authorPhotoURL}
                                          fallbackSrc="/images/default-avatar.jpg"
                                          alt={comment.authorName}
                                          sizes="28px"
                                          showLoading={false}
                                        />
                                      </div>
                                      <div className="comment-info">
                                        <div className="comment-author-name">{comment.authorName}</div>
                                        <div className="comment-time">
                                          {new Date(comment.timestamp).toLocaleDateString('pt-BR')}
                                        </div>
                                      </div>
                                      {comment.authorId === currentUser?.uid && (
                                        <button 
                                          className="comment-delete-btn"
                                          onClick={() => handleDeleteComment(originalPostId, comment)}
                                          title="Deletar comentário"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                    <div className="comment-content">
                                      <p>{comment.content}</p>
                                    </div>
                                    <div className="comment-actions">
                                      <button 
                                        className={`comment-action-btn like-btn ${isCommentLiked ? 'liked' : ''}`}
                                        onClick={() => likeComment(originalPostId, comment)}
                                        title={isCommentLiked ? 'Descurtir' : 'Curtir'}
                                      >
                                        <i className={`fas fa-heart ${isCommentLiked ? 'fas' : 'far'}`}></i>
                                        <span>{comment.likes || 0}</span>
                                      </button>
                                      <button 
                                        className="comment-action-btn reply-btn"
                                        onClick={() => toggleReplyInput(originalPostId, comment.id)}
                                        title="Responder"
                                      >
                                        <i className="fas fa-reply"></i>
                                        <span>Responder</span>
                                      </button>
                                    </div>
                                    
                                    {showReplyInputs[replyKey] && (
                                      <div className="comment-reply">
                                        <div className="comment-input">
                                          <input
                                            type="text"
                                            placeholder="Escreva uma resposta..."
                                            value={commentInputs[replyKey] || ''}
                                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [replyKey]: e.target.value }))}
                                            onKeyPress={(e) => e.key === 'Enter' && addComment(originalPostId, comment.id)}
                                          />
                                          <button 
                                            className="btn small" 
                                            onClick={() => addComment(originalPostId, comment.id)}
                                            disabled={!commentInputs[replyKey]?.trim()}
                                          >
                                            Responder
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="no-comments">Nenhum comentário ainda</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
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
          
          <div className="about-section">
            <div className="section-header">
              <h4>Bio</h4>
            </div>
            {editing ? (
              <textarea
                value={formData.aboutMe}
                onChange={(e) => setFormData({ ...formData, aboutMe: e.target.value })}
                className="edit-textarea about-textarea"
                placeholder="Conte um pouco sobre você..."
                rows={4}
              />
            ) : (
              <p className="bio-text">{profile.aboutMe || profile.bio || 'Nenhuma bio disponível.'}</p>
            )}
          </div>
          
          <div className="profile-details">
            <div className="detail-group">
              <div className="section-header">
                <h4>Idiomas</h4>
              </div>
              {editing ? (
                <input
                  type="text"
                  value={formData.languages}
                  onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                  className="edit-input"
                  placeholder="Ex: Português, Inglês, Espanhol"
                />
              ) : (
                <p>{profile.languages || 'Não especificado'}</p>
              )}
            </div>
            
            <div className="detail-group">
              <div className="section-header">
                <h4>Hobbies</h4>
              </div>
              {editing ? (
                <input
                  type="text"
                  value={formData.hobbies}
                  onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                  className="edit-input"
                  placeholder="Ex: Música, Esportes, Leitura"
                />
              ) : (
                <p>{profile.hobbies || 'Não especificado'}</p>
              )}
            </div>

            <div className="detail-group">
              <div className="section-header">
                <h4>Interesses</h4>
                {editing && (
                  <button 
                    className="add-interest-btn" 
                    onClick={addInterest}
                    disabled={formData.interests.length >= 5}
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                )}
              </div>
              {editing ? (
                <div className="interests-editor">
                  {formData.interests.map((interest, index) => (
                    <div key={index} className="interest-input-group">
                      <input
                        type="text"
                        value={interest}
                        onChange={(e) => handleInterestChange(index, e.target.value)}
                        className="edit-input interest-input"
                        placeholder="Digite um interesse"
                      />
                      <button 
                        className="remove-interest-btn"
                        onClick={() => removeInterest(index)}
                        type="button"
                      >
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                  ))}
                  {formData.interests.length === 0 && (
                    <p className="empty-state">Nenhum interesse adicionado</p>
                  )}
                </div>
              ) : (
                <div className="interests-container">
                  {profile.interests && profile.interests.length > 0 ? (
                    profile.interests.map((interest, index) => (
                      <span key={index} className="interest-tag">{interest}</span>
                    ))
                  ) : (
                    <span className="empty-state">Nenhum interesse adicionado</span>
                  )}
                </div>
              )}
            </div>

            
          </div>
        </div>
      </div>
      
      {/* Services Tab */}
      <div className={`tab-content ${activeTab === 'services' ? 'active' : ''}`}>
        <div className="services-tab-content">

          <div className="services-header">
            <h3>
              {isProvider || isBoth ? 'Meus Serviços' : 'Serviços Disponíveis'}
            </h3>
            {isOwner && (
              <>
                {(isProvider || isBoth) && (
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
                
                {isClient && (
                  <div className="account-restriction-notice">
                    <i className="fas fa-info-circle"></i>
                    <span>Apenas provedores podem criar serviços. <a href="/register">Alterar tipo de conta</a></span>
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="services-grid">
            {servicesLoading ? (
              <div className="loading-state">
                <PurpleSpinner text="Carregando serviços..." size="medium" />
              </div>
            ) : firestoreServices.length > 0 ? (
              firestoreServices.map((service) => (
                <div 
                  key={service.id} 
                  className={`service-card ${isOwner ? 'editable' : ''}`}
                  onClick={() => (isOwner ? handleEditService(service) : handleOpenServicePreview(service))}
                  style={{ cursor: 'pointer' }}
                  title={isOwner ? 'Clique para editar este serviço' : 'Clique para ver detalhes e comprar com VP'}
                >
                  <div className="service-cover">
                    {console.log('Service data for cover image:', {
                      serviceId: service.id,
                      coverImageURL: service.coverImageURL,
                      coverImage: service.coverImage,
                      mediaData: service.coverImageURL || service.coverImage
                    })}
                    <SmartMediaViewer 
                      mediaData={service.coverImageURL || service.coverImage}
                      type="service"
                      watermarked={false}
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
                  <div className="service-info">
                    <h3 className="service-title">{service.title}</h3>
                    <div className="service-price">
                      <div className="price-original">VP {(service.price != null ? (service.price * 1.5).toFixed(2) : '0.00')}</div>
                      <div className="price-discounted">
                        VP {(() => {
                          const basePrice = service.price || 0;
                          const discount = service.discount || 0;
                          const discountedPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
                          return (discountedPrice * 1.5).toFixed(2);
                        })()}
                        {service.discount && <span className="service-discount">(-{service.discount}%)</span>}
                      </div>
                    </div>
                    <p className="service-category">{service.category || 'Geral'}</p>
                    {service.tags && service.tags.length > 0 && (
                      <div className="service-tags">
                        {service.tags.slice(0, 4).map((tag, index) => (
                          <span key={index} className="service-tag">{tag}</span>
                        ))}
                        {service.tags.length > 4 && (
                          <span className="service-tag-more">+{service.tags.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <div className="service-actions" onClick={(e) => e.stopPropagation()}>
                      {/* Animated status switch */}
                      <button 
                        className={`action-btn status-btn ${switchingServiceId === service.id ? 'switching' : ''}`}
                        onClick={async () => {
                          setSwitchingServiceId(service.id);
                          const newStatus = service.status === 'active' ? 'paused' : 'active';
                          await handleServiceStatusChange(service.id, newStatus);
                          setTimeout(() => setSwitchingServiceId(null), 400);
                        }}
                        title={service.status === 'active' ? 'Pausar' : 'Ativar'}
                      >
                        <i className={`fa-solid ${service.status === 'active' ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
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
              <>
                {(isProvider || isBoth) && (
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
                
                {isClient && (
                  <div className="account-restriction-notice">
                    <i className="fas fa-info-circle"></i>
                    <span>Apenas provedores podem criar packs. <a href="/register">Alterar tipo de conta</a></span>
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="packs-grid">
            {packsLoading ? (
              <div className="loading-state">
                <PurpleSpinner text="Carregando packs..." size="medium" />
              </div>
            ) : firestorePacks.length > 0 ? (
              firestorePacks.map((pack) => (
                <div 
                  key={pack.id} 
                  className={`pack-card ${isOwner ? 'editable' : ''}`}
                  onClick={() => (isOwner ? handleEditPack(pack) : handleOpenPackPreview(pack))}
                  style={{ cursor: 'pointer' }}
                  title={isOwner ? 'Clique para editar este pack' : 'Clique para ver detalhes e comprar com VP'}
                >
                  <div className="pack-cover">
                    {console.log('Pack data for cover image:', {
                      packId: pack.id,
                      coverImage: pack.coverImage,
                      mediaData: pack.coverImage
                    })}
                    <SmartMediaViewer 
                      mediaData={pack.coverImage}
                      type="pack"
                      watermarked={false}
                      isOwner={isOwner}
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
                    <div className="pack-price">
                      <div className="price-original">VP {(pack.price != null ? (pack.price * 1.5).toFixed(2) : '0.00')}</div>
                      <div className="price-discounted">
                        VP {(() => {
                          const basePrice = pack.price || 0;
                          const discount = pack.discount || 0;
                          const discountedPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
                          return (discountedPrice * 1.5).toFixed(2);
                        })()}
                        {pack.discount && <span className="pack-discount">(-{pack.discount}%)</span>}
                      </div>
                    </div>
                    {pack.tags && pack.tags.length > 0 && (
                      <div className="service-tags">
                        {pack.tags.slice(0, 4).map((tag, index) => (
                          <span key={index} className="service-tag">{tag}</span>
                        ))}
                        {pack.tags.length > 4 && (
                          <span className="service-tag-more">+{pack.tags.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <div className="service-actions" onClick={(e) => e.stopPropagation()}>
                      {/* Animated status switch */}
                      <button 
                        className={`action-btn status-btn ${switchingPackId === pack.id ? 'switching' : ''}`}
                        onClick={async () => {
                          setSwitchingPackId(pack.id);
                          const newStatus = pack.status === 'active' ? 'paused' : 'active';
                          await handlePackStatusChange(pack.id, newStatus);
                          setTimeout(() => setSwitchingPackId(null), 400);
                        }}
                        title={pack.status === 'active' ? 'Pausar' : 'Ativar'}
                      >
                        <i className={`fa-solid ${pack.status === 'active' ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
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
        <ReviewsSection 
          userId={profile?.id}
          userType={userProfile?.accountType === 'provider' ? 'seller' : 'buyer'}
          showBehaviorReview={isProvider && !isOwner}
          buyerId={profile?.id}
          buyerName={profile?.displayName || profile?.username}
          buyerPhotoURL={profile?.photoURL}
        />
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
                  <div 
                    key={follower.id} 
                    className="modal-follower-item clickable"
                    onClick={() => handleFollowerClick(follower)}
                  >
                    <div className="modal-follower-avatar">
                      <CachedImage 
                        src={follower.profilePictureURL}
                        defaultType="PROFILE_1"
                        alt={follower.displayName}
                        sizes="40px"
                        showLoading={false}
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

      {/* Service Preview Modal */}
      {showServicePreview && serviceToPreview && (
        <div className="modal-overlay" onClick={() => setShowServicePreview(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{serviceToPreview.title || 'Serviço'}</h2>
              <button className="modal-close" onClick={() => setShowServicePreview(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="preview-cover">
                <SmartMediaViewer
                  mediaData={serviceToPreview.coverImageURL || serviceToPreview.coverImage}
                  type="service"
                  watermarked={false}
                  fallbackSrc="/images/default-service.jpg"
                  alt={serviceToPreview.title}
                  sizes="(max-width: 480px) 90vw, (max-width: 768px) 85vw, 720px"
                  style={{ width: '100%', height: 'auto', maxHeight: '60dvh', objectFit: 'cover', borderRadius: '8px' }}
                />
              </div>
              <div className="preview-info">
                <p className="preview-description">{serviceToPreview.description || 'Sem descrição.'}</p>
                <div className="preview-meta">
                  <span className="meta-item"><strong>Categoria:</strong> {serviceToPreview.category || 'Geral'}</span>
                  {serviceToPreview.duration && (
                    <span className="meta-item"><strong>Duração:</strong> {serviceToPreview.duration}</span>
                  )}
                </div>
                {(() => {
                  const basePrice = typeof serviceToPreview.price === 'number' ? serviceToPreview.price : parseFloat(serviceToPreview.price) || 0;
                  const discountPercent = typeof serviceToPreview.discount === 'number' ? serviceToPreview.discount : parseFloat(serviceToPreview.discount) || 0;
                  const originalPrice = basePrice * 1.5;
                  const discounted = basePrice * (1 - (discountPercent > 0 ? discountPercent / 100 : 0)) * 1.5;
                  return (
                    <div className="preview-price">
                      <div className="price-original">VP {originalPrice.toFixed(2)}</div>
                      <div className="price-discounted">
                        VP {discounted.toFixed(2)}
                        {discountPercent > 0 && (
                          <span className="service-discount"> (-{discountPercent}%)</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn primary" onClick={() => { setShowServicePreview(false); setServicePendingPurchase(serviceToPreview); setShowServiceConfirm(true); }}>
                <i className="fa-solid fa-shopping-cart"></i> Comprar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pack Preview Modal */}
      {showPackPreview && packToPreview && (
        <div className="modal-overlay" onClick={() => setShowPackPreview(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{packToPreview.title || 'Pack'}</h2>
              <button className="modal-close" onClick={() => setShowPackPreview(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="preview-cover">
                <SmartMediaViewer
                  mediaData={packToPreview.coverImage}
                  type="pack"
                  watermarked={false}
                  isOwner={isOwner}
                  fallbackSrc="/images/default-pack.jpg"
                  alt={packToPreview.title}
                  sizes="(max-width: 480px) 90vw, (max-width: 768px) 85vw, 720px"
                  style={{ width: '100%', height: 'auto', maxHeight: '60dvh', objectFit: 'cover', borderRadius: '8px' }}
                />
              </div>
              <div className="preview-info">
                <p className="preview-description">{packToPreview.description || 'Sem descrição.'}</p>
                <div className="preview-meta">
                  <span className="meta-item"><strong>Categoria:</strong> {packToPreview.category || 'Geral'}</span>
                  {packToPreview.packType && (
                    <span className="meta-item"><strong>Tipo:</strong> {packToPreview.packType}</span>
                  )}
                </div>
                {(() => {
                  const basePrice = typeof packToPreview.price === 'number' ? packToPreview.price : parseFloat(packToPreview.price) || 0;
                  const discountPercent = typeof packToPreview.discount === 'number' ? packToPreview.discount : parseFloat(packToPreview.discount) || 0;
                  const originalPrice = basePrice * 1.5;
                  const discounted = basePrice * (1 - (discountPercent > 0 ? discountPercent / 100 : 0)) * 1.5;
                  return (
                    <div className="preview-price">
                      <div className="price-original">VP {originalPrice.toFixed(2)}</div>
                      <div className="price-discounted">
                        VP {discounted.toFixed(2)}
                        {discountPercent > 0 && (
                          <span className="pack-discount"> (-{discountPercent}%)</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn primary" onClick={() => { setShowPackPreview(false); setPackPendingPurchase(packToPreview); setShowPackConfirm(true); }}>
                <i className="fa-solid fa-shopping-cart"></i> Comprar agora
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

      {/* Delete Service Modal */}
      <DeleteServiceModal
        isOpen={showDeleteServiceModal}
        onClose={cancelDeleteService}
        onConfirm={confirmDeleteService}
        serviceTitle={serviceToDelete?.title}
      />

      {/* Delete Pack Modal */}
      <DeletePackModal
        isOpen={showDeletePackModal}
        onClose={cancelDeletePack}
        onConfirm={confirmDeletePack}
        packTitle={packToDelete?.title}
        progress={deleteProgress}
        status={deleteStatus}
      />

      {/* Pack Purchase Confirmation Modal */}
      {showPackConfirm && packPendingPurchase && (
        <div className="modal-overlay" onClick={() => { setShowPackConfirm(false); setConfirmPackAck(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar Compra</h2>
              <button className="modal-close" onClick={() => { setShowPackConfirm(false); setConfirmPackAck(false); }}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Você está prestes a comprar o pack <strong>{packPendingPurchase.title || 'Pack'}</strong>.</p>
              <p><strong>Política de Reembolso:</strong> esta compra é <strong>não reembolsável</strong>. Ao continuar, você reconhece e concorda com esta política.</p>
              <label className="checkbox">
                <input type="checkbox" checked={confirmPackAck} onChange={(e) => setConfirmPackAck(e.target.checked)} />
                <span>Eu li e concordo com a política de reembolso (não reembolsável)</span>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => { setShowPackConfirm(false); setConfirmPackAck(false); }}>Cancelar</button>
              <button className="btn primary" disabled={!confirmPackAck} onClick={async () => {
                const pk = packPendingPurchase;
                setShowPackConfirm(false);
                setConfirmPackAck(false);
                setPackPendingPurchase(null);
                await handlePurchasePack(pk);
              }}>Confirmar Compra</button>
            </div>
          </div>
        </div>
      )}

      {/* Service Purchase Confirmation Modal */}
      {showServiceConfirm && servicePendingPurchase && (
        <div className="modal-overlay" onClick={() => { setShowServiceConfirm(false); setConfirmServiceAck(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar Compra</h2>
              <button className="modal-close" onClick={() => { setShowServiceConfirm(false); setConfirmServiceAck(false); }}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Você está prestes a comprar o serviço <strong>{servicePendingPurchase.title || 'Serviço'}</strong>.</p>
              <p><strong>Política de Reembolso:</strong> esta compra é <strong>não reembolsável</strong>. Ao continuar, você reconhece e concorda com esta política.</p>
              <label className="checkbox">
                <input type="checkbox" checked={confirmServiceAck} onChange={(e) => setConfirmServiceAck(e.target.checked)} />
                <span>Eu li e concordo com a política de reembolso (não reembolsável)</span>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => { setShowServiceConfirm(false); setConfirmServiceAck(false); }}>Cancelar</button>
              <button className="btn primary" disabled={!confirmServiceAck} onClick={async () => {
                const svc = servicePendingPurchase;
                setShowServiceConfirm(false);
                setConfirmServiceAck(false);
                setServicePendingPurchase(null);
                await handlePurchaseService(svc);
              }}>Confirmar Compra</button>
            </div>
          </div>
        </div>
      )}

      {/* Service Sales (Owner) */}
      {showServiceSalesModal && salesService && (
        <div className="modal-overlay" onClick={() => setShowServiceSalesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Vendas - {salesService.title}</h2>
              <button className="modal-close" onClick={() => setShowServiceSalesModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {serviceSalesLoading ? (
                <div className="loading-state"><PurpleSpinner text="Carregando..." size="small" /></div>
              ) : serviceSales.length === 0 ? (
                <div className="empty-state">Nenhuma venda ainda.</div>
              ) : (
                <div className="sales-list">
                  <div className="sales-summary">Total ganho: <strong>{serviceTotalVCEarned.toFixed(2)} VC</strong></div>
                  <ul>
                    {serviceSales.map((sale) => (
                      <li key={sale.id} className="sale-item">
                        <div className="sale-buyer">
                          <span className="label">Comprador:</span> @{sale.buyerUsername || sale.buyerId}
                        </div>
                        <div className="sale-amount">
                          <span className="label">Recebido:</span> {Number(sale.priceVC || 0).toFixed(2)} VC
                        </div>
                        <div className="sale-date">
                          <span className="label">Data:</span> {new Date(sale.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pack Sales (Owner) */}
      {showPackSalesModal && salesPack && (
        <div className="modal-overlay" onClick={() => setShowPackSalesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Vendas (Pack) - {salesPack.title}</h2>
              <button className="modal-close" onClick={() => setShowPackSalesModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {packSalesLoading ? (
                <div className="loading-state"><PurpleSpinner text="Carregando..." size="small" /></div>
              ) : packSales.length === 0 ? (
                <div className="empty-state">Nenhuma venda ainda.</div>
              ) : (
                <div className="sales-list">
                  <div className="sales-summary">Total ganho: <strong>{packTotalVCEarned.toFixed(2)} VC</strong></div>
                  <ul>
                    {packSales.map((sale) => (
                      <li key={sale.id} className="sale-item">
                        <div className="sale-buyer">
                          <span className="label">Comprador:</span> @{sale.buyerUsername || sale.buyerId}
                        </div>
                        <div className="sale-amount">
                          <span className="label">Recebido:</span> {Number(sale.priceVC || 0).toFixed(2)} VC
                        </div>
                        <div className="sale-date">
                          <span className="label">Data:</span> {new Date(sale.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pack Buyers Modal */}
      <PackBuyersModal
        isOpen={showPackBuyersModal}
        onClose={() => setShowPackBuyersModal(false)}
        pack={selectedPack}
      />
    </div>
  );
};

export default Profile;
