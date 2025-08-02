import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, MapPin, FileText, Globe, Calendar, AtSign } from 'lucide-react';
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

  const { register } = useAuth();
  const navigate = useNavigate();

  // Check if user is minor based on birth date
  useEffect(() => {
    if (formData.birthDate) {
      const birthDate = new Date(formData.birthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      setIsMinor(age < 18);
    }
  }, [formData.birthDate]);

  // Calculate password strength
  useEffect(() => {
    const password = formData.password;
    if (password.length === 0) {
      setPasswordStrength('Muito fraca');
    } else if (password.length < 6) {
      setPasswordStrength('Muito fraca');
    } else if (password.length < 8) {
      setPasswordStrength('Fraca');
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
    if (password.length < 6) return 'very-weak';
    if (password.length < 8) return 'weak';
    if (password.length < 10) return 'medium';
    if (password.length < 12) return 'strong';
    return 'very-strong';
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

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'file') {
      setFormData(prev => ({
        ...prev,
        [name]: files[0]
      }));
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
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAvatarChange = (avatarChoice) => {
    setFormData(prev => ({
      ...prev,
      avatarChoice
    }));
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
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
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

    // Validate password strength
    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      await register(formData.email, formData.password, formData.displayName);
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      setError(getErrorMessage(error.code));
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
          <input
            type="date"
            id="birthDate"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleChange}
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
            placeholder="     Mínimo 6 caracteres"
            required
            minLength="6"
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
        <small>Use pelo menos 8 caracteres, incluindo letras e números</small>
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
            <span id="cpf-status" className="status-icon"></span>
          </div>
          <button type="button" id="verify-cpf-btn" className="btn-verify-cpf" disabled>
            <span className="verify-text">Verificar CPF</span>
          </button>
        </div>
        <small>Informe apenas números, a formatação será aplicada automaticamente</small>
      </div>

      <div className="form-footer">
        <button type="button" className="btn secondary" onClick={prevStep}>Voltar</button>
        <button type="button" className="skip-verification">
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