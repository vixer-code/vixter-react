import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, MapPin, FileText, Globe, Calendar, AtSign } from 'lucide-react';
import { ref, set, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage, db } from '../../config/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import './Auth.css';

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Account
    displayName: '',
    username: '',
    birthDate: '',
    email: '',
    password: '',
    confirmPassword: '',
    specialAssistance: false,
    
    // Step 2: Profile
    location: '',
    bio: '',
    languages: '',
    avatarChoice: 'avatar1',
    customAvatar: null,
    
    // Step 3: Preferences
    accountType: '',
    interests: [],
    emailNotifications: true,
    marketingUpdates: false,
    
    // Step 4: Verification (optional)
    fullName: '',
    cpf: '',
    documents: {
      front: null,
      back: null,
      selfie: null
    }
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('Muito fraca');
  const [cpfVerificationState, setCpfVerificationState] = useState({
    isVerified: false,
    isVerifying: false,
    isValid: false,
    message: ''
  });
  const [previewImage, setPreviewImage] = useState(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Check if user is minor based on birth date
  useEffect(() => {
    if (formData.birthDate && formData.birthDate.length === 10) {
      // Parse DD/MM/AAAA format
      const [day, month, year] = formData.birthDate.split('/');
      if (day && month && year && day.length === 2 && month.length === 2 && year.length === 4) {
        const birthDate = new Date(year, month - 1, day); // month is 0-indexed
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        setIsMinor(age < 18);
      }
    }
  }, [formData.birthDate]);

  // Calculate password strength
  useEffect(() => {
    const password = formData.password;
    if (password.length === 0) {
      setPasswordStrength('Muito fraca');
    } else if (password.length < 8) {
      setPasswordStrength('Muito fraca');
    } else if (!/[A-Z]/.test(password)) {
      setPasswordStrength('Fraca - precisa de maiúscula');
    } else if (!/\d/.test(password)) {
      setPasswordStrength('Fraca - precisa de número');
    } else if (password.length < 10) {
      setPasswordStrength('Média');
    } else if (password.length < 12) {
      setPasswordStrength('Forte');
    } else {
      setPasswordStrength('Muito forte');
    }
  }, [formData.password]);

  // Get password strength class for CSS
  const getPasswordStrengthClass = () => {
    const password = formData.password;
    if (password.length === 0) return '';
    if (password.length < 8) return 'very-weak';
    if (!/[A-Z]/.test(password) || !/\d/.test(password)) return 'weak';
    if (password.length < 10) return 'medium';
    if (password.length < 12) return 'strong';
    return 'very-strong';
  };

  // Validate password meets Firebase requirements
  const validatePassword = (password) => {
    if (password.length < 8) {
      return { isValid: false, message: 'A senha deve ter pelo menos 8 caracteres' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'A senha deve conter pelo menos uma letra maiúscula' };
    }
    if (!/\d/.test(password)) {
      return { isValid: false, message: 'A senha deve conter pelo menos um número' };
    }
    return { isValid: true, message: 'Senha válida' };
  };

  // CPF validation function (from vanilla JS)
  const validateCPF = (cpf) => {
    // Remove caracteres não numéricos
    const cleanCpf = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (cleanCpf.length !== 11) {
      return { isValid: false, message: 'CPF deve ter 11 dígitos' };
    }
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCpf)) {
      return { isValid: false, message: 'CPF inválido (todos os dígitos são iguais)' };
    }
    
    // Calcula o primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    // Verifica o primeiro dígito
    if (digit1 !== parseInt(cleanCpf.charAt(9))) {
      return { isValid: false, message: 'CPF inválido (primeiro dígito verificador)' };
    }
    
    // Calcula o segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    // Verifica o segundo dígito
    if (digit2 !== parseInt(cleanCpf.charAt(10))) {
      return { isValid: false, message: 'CPF inválido (segundo dígito verificador)' };
    }
    
    return { isValid: true, message: 'CPF válido' };
  };

  // CPF verification with Serpro API
  const verifyCPF = async () => {
    const cpfRaw = formData.cpf.replace(/\D/g, '');
    const name = formData.fullName.trim();
    const birthDate = formData.birthDate;

    if (!cpfRaw || !name || !birthDate || birthDate.length !== 10) {
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: 'Preencha todos os campos obrigatórios antes de verificar.'
      });
      return;
    }

    // Convert DD/MM/AAAA to YYYY-MM-DD for API
    const [day, month, year] = birthDate.split('/');
    const formattedBirthDate = `${year}-${month}-${day}`;

    // First validate CPF mathematically
    const validation = validateCPF(formData.cpf);
    if (!validation.isValid) {
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: validation.message
      });
      return;
    }

    setCpfVerificationState(prev => ({ ...prev, isVerifying: true }));

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://vixter-react-llyd.vercel.app'}/api/verify-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: cpfRaw,
          name: name,
          birthDate: formattedBirthDate
        })
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        setCpfVerificationState({
          isVerified: true,
          isVerifying: false,
          isValid: true,
          message: 'CPF verificado com sucesso!'
        });
      } else {
        setCpfVerificationState({
          isVerified: false,
          isVerifying: false,
          isValid: false,
          message: data.message || 'Falha na verificação do CPF'
        });
      }
    } catch (error) {
      console.error('CPF verification error:', error);
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: 'Erro na verificação. Tente novamente.'
      });
    }
  };

  // Calculate age
  const calculateAge = (birthDate) => {
    if (!birthDate || birthDate.length !== 10) return 0;
    
    const [day, month, year] = birthDate.split('/');
    if (!day || !month || !year || day.length !== 2 || month.length !== 2 || year.length !== 4) {
      return 0;
    }
    
    const today = new Date();
    const birth = new Date(year, month - 1, day); // month is 0-indexed
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  // Handle disappearing icons logic
  useEffect(() => {
    const handleInputContent = () => {
      const inputs = document.querySelectorAll('.input-group input, .input-group textarea');
      
      inputs.forEach(input => {
        const inputGroup = input.closest('.input-group');
        if (inputGroup) {
          if (input.value.trim() !== '') {
            inputGroup.classList.add('has-content');
          } else {
            inputGroup.classList.remove('has-content');
          }
        }
      });
    };

    // Initial check
    handleInputContent();

    // Add event listeners
    const inputs = document.querySelectorAll('.input-group input, .input-group textarea');
    inputs.forEach(input => {
      input.addEventListener('input', handleInputContent);
      input.addEventListener('blur', handleInputContent);
      input.addEventListener('focus', handleInputContent);
    });

    // Cleanup
    return () => {
      inputs.forEach(input => {
        input.removeEventListener('input', handleInputContent);
        input.removeEventListener('blur', handleInputContent);
        input.removeEventListener('focus', handleInputContent);
      });
    };
  }, [currentStep]); // Re-run when step changes to handle new inputs

  // Handle birth date formatting
  const handleBirthDateKeyDown = (e) => {
    // Allow only numbers, backspace, delete, tab, escape, enter
    if ([8, 9, 27, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }
    // Ensure that it is a number and stop the keypress
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'file') {
      const file = files[0];
      setFormData(prev => ({
        ...prev,
        [name]: file
      }));
      
      // Create preview for custom avatar
      if (name === 'customAvatar' && file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewImage(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    } else if (type === 'checkbox') {
      if (name === 'interests') {
        setFormData(prev => ({
          ...prev,
          interests: checked 
            ? [...prev.interests, value]
            : prev.interests.filter(interest => interest !== value)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: checked
        }));
      }
    } else {
      let formattedValue = value;
      
      // Format birth date as DD/MM/AAAA
      if (name === 'birthDate') {
        // Remove all non-numeric characters
        const numericValue = value.replace(/\D/g, '');
        
        // Format with slashes
        if (numericValue.length >= 2) {
          formattedValue = numericValue.substring(0, 2) + '/' + numericValue.substring(2);
        }
        if (numericValue.length >= 4) {
          formattedValue = numericValue.substring(0, 2) + '/' + numericValue.substring(2, 4) + '/' + numericValue.substring(4, 8);
        }
        
        // Limit to 10 characters (DD/MM/AAAA)
        if (formattedValue.length > 10) {
          formattedValue = formattedValue.substring(0, 10);
        }
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    }
  };

  const handleAvatarChange = (avatarChoice) => {
    setFormData(prev => ({
      ...prev,
      avatarChoice
    }));
    
    // Clear preview if not custom
    if (avatarChoice !== 'custom') {
      setPreviewImage(null);
    }
  };

  const handleDocumentChange = (documentType, file) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [documentType]: file
      }
    }));
  };

  const nextStep = () => {
    // Validate step 1 data before proceeding
    if (currentStep === 1) {
      // Check if all required fields are filled
      if (!formData.displayName || !formData.username || !formData.birthDate || !formData.email || !formData.password || !formData.confirmPassword) {
        setError('Por favor, preencha todos os campos obrigatórios');
        return;
      }

      // Validate username format (pattern doesn't trigger without native submit)
      const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernamePattern.test(formData.username)) {
        setError('O nome de usuário deve ter 3-20 caracteres (letras, números ou _).');
        return;
      }

      // Validate password meets requirements
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        setError(passwordValidation.message);
        return;
      }

      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        setError('As senhas não coincidem');
        return;
      }

      // Clear any previous errors
      setError('');
    }

    // Validate step 3 selections before proceeding
    if (currentStep === 3) {
      if (!formData.accountType) {
        setError('Selecione um tipo de conta para continuar.');
        return;
      }
      setError('');
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Create complete user profile in Firebase (like vanilla JS)
  const createUserProfile = async (userId, withVerification = false) => {
    try {
      console.log('[createUserProfile] Creating profile for user:', userId);
      
      const age = calculateAge(formData.birthDate);
      const isAdult = age >= 18;
      
      // Create reference to the user in the database
      const userRef = ref(database, `users/${userId}`);
      
      // Prepare profile data
      const profileData = {
        displayName: formData.displayName || '',
        username: formData.username || '',
        birthDate: formData.birthDate || null,
        age: age || null,
        isAdult: isAdult || false,
        specialAssistance: formData.specialAssistance || false,
        location: formData.location || 'Vixora',
        bio: formData.bio || '',
        languages: formData.languages || '',
        interests: formData.interests || [],
        accountType: formData.accountType || '',
        communicationPreferences: {
          emailNotifications: formData.emailNotifications,
          marketingUpdates: formData.marketingUpdates
        },
        avatarType: formData.avatarChoice || null,
        idVerified: false,
        kyc: false, // KYC flag - will be set to true manually by admin
        profileComplete: true,
        accountRestrictions: isAdult ? [] : ['adult_content', 'unsupervised_transfers', 'unverified_chat'],
        registeredAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Add verification data if provided
      if (withVerification && cpfVerificationState.isVerified) {
        profileData.verification = {
          fullName: formData.fullName,
          cpf: formData.cpf.replace(/\D/g, ''),
          submittedAt: Date.now(),
          verificationStatus: 'pending'
        };
      } else {
        profileData.verification = {
          verificationStatus: 'skipped',
          skippedAt: Date.now()
        };
      }
      
      // Update data in the database
      await set(userRef, profileData);
      
      console.log('[createUserProfile] User profile created successfully');
      return true;
    } catch (error) {
      console.error('[createUserProfile] Error creating user profile:', error);
      throw new Error(`Falha ao criar perfil do usuário: ${error.message}`);
    }
  };

  // Upload profile picture
  const uploadProfilePicture = async (userId) => {
    if (!formData.customAvatar) {
      console.log('[uploadProfilePicture] No custom avatar to upload');
      return null;
    }
    
    try {
      console.log('[uploadProfilePicture] Uploading profile picture for user:', userId);
      
      const profilePictureRef = storageRef(storage, `profilePictures/${userId}/${formData.customAvatar.name}`);
      const snapshot = await uploadBytes(profilePictureRef, formData.customAvatar);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('[uploadProfilePicture] Profile picture uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('[uploadProfilePicture] Error uploading profile picture:', error);
      throw error;
    }
  };

  // Upload verification documents to R2
  const uploadVerificationDocuments = async (userId) => {
    try {
      console.log('[uploadVerificationDocuments] Uploading verification documents to R2 for user:', userId);
      
      const documentURLs = {};
      const uploadPromises = [];
      
      // Prepare uploads for all documents
      if (formData.documents.front) {
        const frontKey = `KYC/${userId}/doc-front-${Date.now()}.${formData.documents.front.name.split('.').pop()}`;
        uploadPromises.push(
          fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'kyc',
              contentType: formData.documents.front.type,
              originalName: formData.documents.front.name,
              key: frontKey
            })
          }).then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              const uploadResponse = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: formData.documents.front,
                headers: { 'Content-Type': formData.documents.front.type }
              });
              
              if (uploadResponse.ok) {
                // For KYC documents, store only the key - no public URL
                documentURLs.front = data.key;
              }
            }
          })
        );
      }
      
      if (formData.documents.back) {
        const backKey = `KYC/${userId}/doc-back-${Date.now()}.${formData.documents.back.name.split('.').pop()}`;
        uploadPromises.push(
          fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'kyc',
              contentType: formData.documents.back.type,
              originalName: formData.documents.back.name,
              key: backKey
            })
          }).then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              const uploadResponse = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: formData.documents.back,
                headers: { 'Content-Type': formData.documents.back.type }
              });
              
              if (uploadResponse.ok) {
                // For KYC documents, store only the key - no public URL
                documentURLs.back = data.key;
              }
            }
          })
        );
      }
      
      if (formData.documents.selfie) {
        const selfieKey = `KYC/${userId}/selfie-${Date.now()}.${formData.documents.selfie.name.split('.').pop()}`;
        uploadPromises.push(
          fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'kyc',
              contentType: formData.documents.selfie.type,
              originalName: formData.documents.selfie.name,
              key: selfieKey
            })
          }).then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              const uploadResponse = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: formData.documents.selfie,
                headers: { 'Content-Type': formData.documents.selfie.type }
              });
              
              if (uploadResponse.ok) {
                // For KYC documents, store only the key - no public URL
                documentURLs.selfie = data.key;
              }
            }
          })
        );
      }
      
      // Wait for all uploads to complete
      await Promise.all(uploadPromises);
      
      // Update user profile with document URLs
      const userRef = ref(database, `users/${userId}/verification`);
      await update(userRef, {
        documents: documentURLs,
        uploadedAt: Date.now()
      });
      
      console.log('[uploadVerificationDocuments] Verification documents uploaded to R2 successfully');
      return documentURLs;
    } catch (error) {
      console.error('[uploadVerificationDocuments] Error uploading verification documents to R2:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    // Validate password meets Firebase requirements
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      setLoading(false);
      return;
    }

    // Validate age
    const age = calculateAge(formData.birthDate);
    if (age < 13) {
      setError('Você deve ter pelo menos 13 anos para criar uma conta');
      setLoading(false);
      return;
    }

    try {
      // Register user with Firebase Auth
      const result = await register(formData.displayName, formData.email, formData.password);
      const user = result.user;
      
      console.log('[handleSubmit] User registered successfully:', user.uid);
      
      // Send email verification immediately after registration
      try {
        await user.sendEmailVerification({
          url: `https://vixter.com.br/profile`,
          handleCodeInApp: false
        });
        console.log('[handleSubmit] Email verification sent successfully');
      } catch (emailError) {
        console.error('[handleSubmit] Error sending email verification:', emailError);
        // Don't fail registration if email verification fails
      }
      
      // Create complete user profile in Firebase Database
      const withVerification = cpfVerificationState.isVerified;
      await createUserProfile(user.uid, withVerification);
      
      // Also create/update Firestore user document (primary source for userProfile)
      try {
        const userDocRef = doc(db, 'users', user.uid);
        // Normalize username to lowercase for uniqueness and searchability
        const normalizedUsername = (formData.username || '').toLowerCase();
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email || formData.email || '',
          displayName: formData.displayName || user.displayName || '',
          username: normalizedUsername || '',
          accountType: formData.accountType || '',
          followersCount: 0,
          followingCount: 0,
          profilePictureURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          stats: { totalPosts: 0, totalServices: 0, totalPacks: 0, totalSales: 0 },
          searchTerms: [
            (formData.displayName || user.displayName || '').toLowerCase(),
            normalizedUsername
          ].filter(Boolean)
        }, { merge: true });
      } catch (firestoreError) {
        console.error('[handleSubmit] Error writing Firestore user doc:', firestoreError);
        // Non-fatal: proceed, UserContext will create minimal doc if needed
      }

      // Upload profile picture if custom avatar selected
      if (formData.customAvatar) {
        try {
          const profilePictureURL = await uploadProfilePicture(user.uid);
          if (profilePictureURL) {
            // Update both database and firestore
            const userRef = ref(database, `users/${user.uid}`);
            await update(userRef, { profilePictureURL });
            
            // Also update Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { 
              profilePictureURL,
              updatedAt: serverTimestamp()
            });
          }
        } catch (uploadError) {
          console.error('Error uploading profile picture:', uploadError);
          // Don't fail registration if image upload fails
        }
      }
      
      // Upload verification documents if provided
      if (withVerification && formData.documents.front && age >= 18) {
        await uploadVerificationDocuments(user.uid);
      }
      
      // Determine success message
      let message;
      if (age < 18) {
        message = 'Conta criada com sucesso! Enviamos um email de verificação para você. Como você é menor de idade, algumas funcionalidades estarão restritas para sua segurança.';
      } else if (withVerification) {
        message = 'Registro realizado com sucesso! Enviamos um email de verificação para você. Seus documentos estão sendo analisados e você receberá uma notificação em breve.';
      } else {
        message = 'Registro realizado com sucesso! Enviamos um email de verificação para você. Você pode completar a verificação de identidade a qualquer momento em suas configurações para acessar todas as funcionalidades.';
      }
      
      console.log('[handleSubmit] Registration completed successfully');
      
      // Navigate to home page
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'Este email já está em uso';
      case 'auth/invalid-email':
        return 'Email inválido';
      case 'auth/weak-password':
        return 'Senha muito fraca';
      case 'auth/operation-not-allowed':
        return 'Operação não permitida';
      default:
        return 'Erro ao criar conta. Tente novamente';
    }
  };

  const renderStep1 = () => (
    <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="auth-form">
      <div className="form-group">
        <label htmlFor="displayName">Nome de exibição</label>
        <div className={`input-group ${formData.displayName ? 'has-content' : ''}`}>
          <User className="input-icon" size={20} />
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            placeholder="     Seu nome"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="username">Nome de usuário</label>
        <div className={`input-group ${formData.username ? 'has-content' : ''}`}>
          <AtSign className="input-icon" size={20} />
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="     Seu nome de usuário"
            pattern="^[a-zA-Z0-9_]{3,20}$"
            required
          />
        </div>
        <small>O nome de usuário deve ter entre 3 e 20 caracteres, contendo apenas letras, números e sublinhados</small>
        <div className="warning-notice">
          <span className="warning-icon">⚠️</span>
          <strong>Importante:</strong> O nome de usuário não poderá ser alterado após a criação da conta.
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="birthDate">Data de Nascimento</label>
        <div className={`input-group ${formData.birthDate ? 'has-content' : ''}`}>
          <Calendar className="input-icon" size={20} />
          <input
            type="text"
            id="birthDate"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleChange}
            onKeyDown={handleBirthDateKeyDown}
            placeholder="     DD/MM/AAAA"
            maxLength="10"
            required
          />
        </div>
        <small>Você deve ter pelo menos 13 anos para criar uma conta</small>
        {isMinor && (
          <div className="age-warning">
            <span className="warning-icon">ℹ️</span>
            <strong>Informação:</strong> Usuários menores de 18 anos terão acesso limitado a algumas funcionalidades da plataforma.
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email">E-mail</label>
        <div className={`input-group ${formData.email ? 'has-content' : ''}`}>
          <Mail className="input-icon" size={20} />
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="     seu@email.com"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="password">Senha</label>
        <div className={`input-group ${formData.password ? 'has-content' : ''}`}>
          <Lock className="input-icon" size={20} />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="     Mínimo 8 caracteres"
            required
            minLength="8"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <div className="password-strength">
          <div className={`strength-bar ${getPasswordStrengthClass()}`}></div>
          <span className="strength-text">Nível de segurança da senha: {passwordStrength}</span>
        </div>
        <small>Use pelo menos 8 caracteres, incluindo pelo menos uma letra maiúscula e um número</small>
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">Confirmar Senha</label>
        <div className={`input-group ${formData.confirmPassword ? 'has-content' : ''}`}>
          <Lock className="input-icon" size={20} />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="     Confirme sua senha"
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      <div className="form-group checkbox-container">
        <input
          type="checkbox"
          id="specialAssistance"
          name="specialAssistance"
          checked={formData.specialAssistance}
          onChange={handleChange}
        />
        <label htmlFor="specialAssistance">Preciso de assistência especial</label>
        <p className="disclaimer">
          Estamos perguntando para garantir que possamos oferecer um serviço melhor. Exemplos incluem: neurodivergência, 
          deficiência auditiva, deficiência visual ou outras condições que possam exigir adaptações para uma melhor experiência.
          Essas informações serão mantidas em sigilo e usadas apenas para melhorar sua experiência.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <button type="submit" className="auth-button">Continuar</button>
    </form>
  );

  const renderStep2 = () => (
    <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="auth-form">
      <div className="form-group">
        <label htmlFor="location">Localização <span className="optional-label">(opcional)</span></label>
        <div className={`input-group ${formData.location ? 'has-content' : ''}`}>
          <MapPin className="input-icon" size={20} />
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="     Ex: São Paulo, Brasil"
          />
        </div>
        <small className="helper-text">Se não informada, será definida como "Vixora" por padrão.</small>
      </div>

      <div className="form-group">
        <label htmlFor="bio">Bio <span className="optional-label">(opcional)</span></label>
        <div className={`input-group ${formData.bio ? 'has-content' : ''}`}>
          <FileText className="input-icon" size={20} />
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="     Conte algo sobre você..."
          />
        </div>
        <small className="helper-text">Uma bio ajuda outros usuários a conhecê-lo melhor e pode aumentar suas chances de conexão.</small>
      </div>

      <div className="form-group">
        <label htmlFor="languages">Idiomas <span className="optional-label">(opcional)</span></label>
        <div className={`input-group ${formData.languages ? 'has-content' : ''}`}>
          <Globe className="input-icon" size={20} />
          <input
            type="text"
            id="languages"
            name="languages"
            value={formData.languages}
            onChange={handleChange}
            placeholder="     Ex: Português, Inglês"
          />
        </div>
        <small className="helper-text">Informar seus idiomas ajuda na comunicação com outros usuários da plataforma.</small>
      </div>

      <div className="form-group">
        <label>Foto de perfil</label>
        <p className="profile-picture-instructions">
          Escolha uma das opções abaixo ou envie sua própria foto:
        </p>
        
        <div className="profile-picture-options">
          <div className="default-avatars">
            {['avatar1', 'avatar2', 'avatar3'].map((avatar) => (
              <div
                key={avatar}
                className={`avatar-option ${formData.avatarChoice === avatar ? 'selected' : ''}`}
                onClick={() => handleAvatarChange(avatar)}
              >
                <div className="avatar-preview">
                  <img src={`/images/defpfp${avatar.slice(-1)}.png`} alt={`Avatar ${avatar}`} className="avatar-image" />
                </div>
                <input
                  type="radio"
                  name="avatar-choice"
                  value={avatar}
                  checked={formData.avatarChoice === avatar}
                  onChange={() => handleAvatarChange(avatar)}
                />
              </div>
            ))}
            
            <div
              className={`avatar-option ${formData.avatarChoice === 'custom' ? 'selected' : ''}`}
              onClick={() => handleAvatarChange('custom')}
            >
              <div className="avatar-preview">
                <div className="upload-placeholder">📷<br /><small>Enviar</small></div>
              </div>
              <input
                type="radio"
                name="avatar-choice"
                value="custom"
                checked={formData.avatarChoice === 'custom'}
                onChange={() => handleAvatarChange('custom')}
              />
            </div>
          </div>
          
          {formData.avatarChoice === 'custom' && (
            <div className="custom-upload">
              <input
                type="file"
                id="customAvatar"
                name="customAvatar"
                accept="image/*"
                onChange={handleChange}
              />
              <label htmlFor="customAvatar" className="btn secondary">Escolher imagem</label>
              
              {previewImage && (
                <div className="image-preview">
                  <img src={previewImage} alt="Preview" className="preview-image" />
                  <p className="preview-text">Imagem selecionada</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="form-footer">
        <button type="button" className="btn secondary" onClick={prevStep}>Voltar</button>
        <button type="submit" className="btn primary">Continuar</button>
      </div>
    </form>
  );

  const renderStep3 = () => (
    <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="auth-form">
      <div className="form-group">
        <label>Tipo de Conta</label>
        <div className="warning-notice">
          <span className="warning-icon">⚠️</span>
          <strong>Importante:</strong> O tipo de conta não poderá ser alterado após a criação. Escolha com cuidado.
        </div>
        <div className="radio-options">
          <div className="radio-option">
            <input
              type="radio"
              id="account-type-provider"
              name="accountType"
              value="provider"
              checked={formData.accountType === 'provider'}
              onChange={handleChange}
              required
            />
            <label htmlFor="account-type-provider">Provedor de Serviços</label>
            <p className="option-description">Quero oferecer meus serviços na plataforma</p>
            <div className="account-type-features">
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Criar e vender serviços</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Criar e vender packs</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Receber VC por vendas</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Sacar VC para BRL</span>
              </div>
            </div>
          </div>
          <div className="radio-option">
            <input
              type="radio"
              id="account-type-client"
              name="accountType"
              value="client"
              checked={formData.accountType === 'client'}
              onChange={handleChange}
              required
            />
            <label htmlFor="account-type-client">Cliente</label>
            <p className="option-description">Quero contratar serviços de outros</p>
            <div className="account-type-features">
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Comprar VP para pagamentos</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Contratar serviços</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Comprar packs</span>
              </div>
              <div className="feature-item">
                <i className="fas fa-check"></i>
                <span>Ganhar VBP por atividades</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Interesses <span className="optional-label">(opcional)</span></label>
        <small className="helper-text">Selecionar seus interesses ajuda a personalizar sua experiência e conectá-lo com usuários e serviços relevantes.</small>
        <div className="checkbox-options">
          {[
            { id: 'gaming', label: 'Jogos' },
            { id: 'design', label: 'Design' },
            { id: 'development', label: 'Desenvolvimento' },
            { id: 'writing', label: 'Redação' },
            { id: 'music', label: 'Música' },
            { id: 'coaching', label: 'Coaching' }
          ].map((interest) => (
            <div key={interest.id} className="checkbox-option">
              <input
                type="checkbox"
                id={`interest-${interest.id}`}
                name="interests"
                value={interest.id}
                checked={formData.interests.includes(interest.id)}
                onChange={handleChange}
              />
              <label htmlFor={`interest-${interest.id}`}>{interest.label}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Preferências de Comunicação</label>
        <div className="checkbox-options">
          <div className="checkbox-option">
            <input
              type="checkbox"
              id="emailNotifications"
              name="emailNotifications"
              checked={formData.emailNotifications}
              onChange={handleChange}
            />
            <label htmlFor="emailNotifications">Notificações por e-mail</label>
          </div>
          <div className="checkbox-option">
            <input
              type="checkbox"
              id="marketingUpdates"
              name="marketingUpdates"
              checked={formData.marketingUpdates}
              onChange={handleChange}
            />
            <label htmlFor="marketingUpdates">Atualizações de marketing e promoções</label>
          </div>
        </div>
      </div>

      <div className="form-footer">
        <button type="button" className="btn secondary" onClick={prevStep}>Voltar</button>
        <button type="submit" className="btn primary">Continuar</button>
      </div>
    </form>
  );

  const renderStep4 = () => (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="verification-container">
        <div className="verification-header">
          <div className="verification-icon">🛡️</div>
          <h3 className="verification-title">Verificação de Identidade</h3>
        </div>
        
        <div className="optional-badge">
          ⏰ Opcional por enquanto
        </div>
        
        <p className="verification-description">
          Para garantir a segurança e confiabilidade da nossa plataforma, oferecemos verificação de identidade. 
          Esta etapa não é obrigatória agora, mas é necessária para acessar todos os recursos da plataforma.
        </p>
        
        <div className="verification-warning">
          <div className="verification-warning-header">
            <span>⚠️</span>
            <span>Recursos Limitados</span>
          </div>
          <p className="verification-warning-text">
            Sem a verificação de identidade, alguns recursos ficam limitados: transferências de VP, 
            criação de serviços, participação em projetos e acesso a conteúdos exclusivos.
          </p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="fullName">Nome Completo</label>
        <div className={`input-group ${formData.fullName ? 'has-content' : ''}`}>
          <User className="input-icon" size={20} />
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="     Digite seu nome completo conforme documento"
          />
        </div>
        <small>Deve corresponder exatamente ao nome no documento de identificação</small>
      </div>

      <div className="form-group">
        <label htmlFor="cpf">CPF</label>
        <div className="cpf-verification-container">
          <div className="cpf-wrapper">
            <input
              type="text"
              id="cpf"
              name="cpf"
              className="cpf-input"
              value={formData.cpf}
              onChange={handleChange}
              placeholder="     000.000.000-00"
              maxLength="14"
            />
            <span id="cpf-status" className={`status-icon ${cpfVerificationState.isVerified ? 'verified' : ''}`}></span>
          </div>
          <button 
            type="button" 
            className={`btn-verify-cpf ${cpfVerificationState.isVerified ? 'verified' : ''} ${cpfVerificationState.isVerifying ? 'verifying' : ''}`}
            onClick={verifyCPF}
            disabled={cpfVerificationState.isVerifying || cpfVerificationState.isVerified || !formData.fullName || !formData.cpf || !formData.birthDate}
          >
            {cpfVerificationState.isVerifying ? (
              <>
                <span className="verify-loading">
                  <svg className="loading-spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="31.416" strokeDashoffset="31.416">
                      <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                  Verificando...
                </span>
              </>
            ) : (
              <span className="verify-text">
                {cpfVerificationState.isVerified ? 'CPF Verificado' : 'Verificar CPF'}
              </span>
            )}
          </button>
        </div>
        <small>Informe apenas números, a formatação será aplicada automaticamente</small>
        {cpfVerificationState.message && (
          <div className={`cpf-feedback ${cpfVerificationState.isValid ? 'success' : 'error'}`}>
            <div className="feedback-content">
              <span className="feedback-icon">
                {cpfVerificationState.isValid ? '✅' : '❌'}
              </span>
              <span className="feedback-message">{cpfVerificationState.message}</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-group documents-section documents-verification-section">
        <label>Documentos de Verificação</label>
        <p className="verification-description">
          Envie 3 fotos conforme especificado abaixo. Certifique-se de que todas as informações estejam legíveis e que as fotos estejam bem iluminadas.
        </p>
        
        <div className="example-photo">
          <div className="example-header">
            <div className="example-icon">📸</div>
            <h4>Como tirar a selfie com documento</h4>
          </div>
          <div className="example-content">
            <img src="/images/uploadCorreto.png" alt="Example photo" />
          </div>
          
          <div className="photo-upload-item" id="doc-front-upload">
            <input 
              type="file" 
              id="doc-front" 
              accept="image/*"
              onChange={(e) => handleDocumentChange('front', e.target.files[0])}
            />
            <div className="photo-upload-icon">📄</div>
            <div className="photo-upload-title">Frente do Documento</div>
            <div className="photo-upload-description">
              Foto da frente do RG, CNH ou outro documento com foto que contenha seu CPF
            </div>
          </div>
          
          <div className="photo-upload-item" id="doc-back-upload">
            <input 
              type="file" 
              id="doc-back" 
              accept="image/*"
              onChange={(e) => handleDocumentChange('back', e.target.files[0])}
            />
            <div className="photo-upload-icon">📄</div>
            <div className="photo-upload-title">Verso do Documento</div>
            <div className="photo-upload-description">
              Foto do verso do mesmo documento usado na frente
            </div>
          </div>
          
          <div className="photo-upload-item" id="selfie-doc-upload">
            <input 
              type="file" 
              id="selfie-doc" 
              accept="image/*"
              onChange={(e) => handleDocumentChange('selfie', e.target.files[0])}
            />
            <div className="photo-upload-icon">🤳</div>
            <div className="photo-upload-title">Selfie com Documento</div>
            <div className="photo-upload-description">
              Foto sua segurando o documento ao lado do rosto, ambos devem estar visíveis
            </div>
          </div>
        </div>
      </div>

      <div className="form-footer step4-footer-section">
        <button type="button" className="btn secondary" onClick={prevStep}>Voltar</button>
        <button type="button" className="skip-verification" onClick={() => {
          // Skip verification and proceed with registration
          setCpfVerificationState(prev => ({ ...prev, isVerified: false }));
          // Call handleSubmit directly without verification
          handleSubmit(new Event('submit'));
        }}>
          Pular Verificação (concluir depois)
        </button>
        <button type="submit" className="btn primary">Concluir Verificação</button>
      </div>
    </form>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Crie sua conta';
      case 2: return 'Complete seu Perfil';
      case 3: return 'Defina suas Preferências';
      case 4: return 'Verificação de Identidade';
      default: return 'Crie sua conta';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Junte-se à comunidade Vixter';
      case 2: return 'Conte-nos um pouco sobre você';
      case 3: return 'Personalize sua experiência';
      case 4: return 'Verifique sua identidade (opcional)';
      default: return 'Junte-se à comunidade Vixter';
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>{getStepTitle()}</h1>
          <p>{getStepDescription()}</p>
        </div>

        <div className="auth-steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`} data-step="1">1</div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`} data-step="2">2</div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`} data-step="3">3</div>
          <div className={`step ${currentStep >= 4 ? 'active' : ''}`} data-step="4">4</div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        <div className="auth-footer">
          <p>
            Já tem uma conta?{' '}
            <Link to="/login" className="auth-link">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;