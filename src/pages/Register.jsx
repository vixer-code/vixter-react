import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, MapPin, FileText, Globe, Calendar, AtSign } from 'lucide-react';
import { ref, set, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage, db } from '../../config/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';
import PurpleSpinner from '../components/PurpleSpinner';
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
    
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('Muito fraca');
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

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Create complete user profile in Firebase (like vanilla JS)
  const createUserProfile = async (userId) => {
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
        kycState: 'PENDING_UPLOAD', // KYC state: PENDING_UPLOAD, PENDING_VERIFICATION, VERIFIED
        profileComplete: true,
        accountRestrictions: isAdult ? [] : ['adult_content', 'unsupervised_transfers', 'unverified_chat'],
        emailVerified: false,
        emailVerifiedAt: null,
        registeredAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Set verification status as skipped since verification is now optional
      profileData.verification = {
        verificationStatus: 'skipped',
        skippedAt: Date.now()
      };
      
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
        console.log('[handleSubmit] Attempting to send email verification...');
        console.log('[handleSubmit] User email:', user.email);
        console.log('[handleSubmit] User emailVerified:', user.emailVerified);
        
        await sendEmailVerification(user, {
          url: `${window.location.origin}/verify-email`,
          handleCodeInApp: false
        });
        console.log('[handleSubmit] Email verification sent successfully');
      } catch (emailError) {
        console.error('[handleSubmit] Error sending email verification:', emailError);
        console.error('[handleSubmit] Error code:', emailError.code);
        console.error('[handleSubmit] Error message:', emailError.message);
        // Don't fail registration if email verification fails
      }
      
      // Create complete user profile in Firebase Database
      await createUserProfile(user.uid);
      
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
          specialAssistance: formData.specialAssistance || false,
          location: formData.location || 'Vixora',
          bio: formData.bio || '',
          languages: formData.languages || '',
          interests: formData.interests || [],
          communicationPreferences: {
            emailNotifications: formData.emailNotifications,
            marketingUpdates: formData.marketingUpdates
          },
          avatarType: formData.avatarChoice || null,
          followersCount: 0,
          followingCount: 0,
          profilePictureURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          stats: { 
            // Stats para clientes
            totalSpent: 0,
            totalPacksBought: 0,
            totalServicesBought: 0,
            totalVixtipsSent: 0,
            totalVixtipsSentAmount: 0,
            // Stats para provedores
            totalPacksSold: 0,
            totalServicesSold: 0,
            totalSales: 0,
            totalPosts: 0,
            totalPostsVixies: 0,
            totalPostsFeed: 0,
            totalPostsVixink: 0,
            totalVixtipsReceived: 0,
            totalVixtipsReceivedAmount: 0,
            totalVcEarned: 0
          },
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
      
      
      // Determine success message
      let message;
      if (age < 18) {
        message = 'Conta criada com sucesso! Enviamos um email de verificação para você. Como você é menor de idade, algumas funcionalidades estarão restritas para sua segurança.';
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

      <button type="submit" className="auth-button" disabled={loading}>
        {loading ? <PurpleSpinner text="Processando..." size="small" /> : 'Continuar'}
      </button>
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
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? <PurpleSpinner text="Processando..." size="small" /> : 'Continuar'}
        </button>
      </div>
    </form>
  );

  const renderStep3 = () => (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="form-group">
        <label>Tipo de Conta</label>
        <div className="warning-notice">
          <span className="warning-icon">⚠️</span>
          <strong>Importante:</strong> O tipo de conta não poderá ser alterado após a criação. Escolha com cuidado.
        </div>
        <div className="radio-options">
          <label className="radio-option" htmlFor="account-type-provider">
            <input
              type="radio"
              id="account-type-provider"
              name="accountType"
              value="provider"
              checked={formData.accountType === 'provider'}
              onChange={handleChange}
              required
            />
            <div className="option-content">
              <div className="option-title">Provedor de Serviços</div>
              <p className="option-description">Quero oferecer meus serviços na plataforma</p>
            </div>
          </label>
          <label className="radio-option" htmlFor="account-type-client">
            <input
              type="radio"
              id="account-type-client"
              name="accountType"
              value="client"
              checked={formData.accountType === 'client'}
              onChange={handleChange}
              required
            />
            <div className="option-content">
              <div className="option-title">Usuário</div>
              <p className="option-description">Quero contratar serviços de outros</p>
            </div>
          </label>
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

      <div className="verification-notice">
        <div className="verification-notice-header">
          <span className="notice-icon">🛡️</span>
          <span>Verificação de Identidade</span>
        </div>
        <p className="verification-notice-text">
          Para acessar funcionalidades que requerem verificação de identidade, será necessário 
          fornecer documentos pessoais que serão processados em conformidade com a Lei Geral de 
          Proteção de Dados (LGPD - Lei nº 13.709/2018). Os dados coletados serão utilizados 
          exclusivamente para fins de verificação de identidade e segurança da plataforma, 
          garantindo o direito à privacidade e proteção dos dados pessoais conforme previsto 
          na legislação vigente. A verificação pode ser realizada a qualquer momento em suas configurações.
        </p>
      </div>

      <div className="form-footer">
        <button type="button" className="btn secondary" onClick={prevStep}>Voltar</button>
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? <PurpleSpinner text="Processando..." size="small" /> : 'Criar Conta'}
        </button>
      </div>
    </form>
  );


  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Crie sua conta';
      case 2: return 'Complete seu Perfil';
      case 3: return 'Defina suas Preferências';
      default: return 'Crie sua conta';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Junte-se à comunidade Vixter';
      case 2: return 'Conte-nos um pouco sobre você';
      case 3: return 'Personalize sua experiência';
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
        </div>

        {error && <div className="error-message">{error}</div>}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}

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