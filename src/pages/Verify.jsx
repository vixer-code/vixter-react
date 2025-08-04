import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../config/firebase';
import { ref, set } from 'firebase/database';
import './Verify.css';

const Verify = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [formData, setFormData] = useState({
    cpf: '',
    fullName: '',
    birthDate: ''
  });
  
  const [cameraState, setCameraState] = useState({
    isOpen: false,
    hasPermission: false,
    error: null
  });
  
  const [selfieData, setSelfieData] = useState({
    captured: false,
    imageUrl: null,
    base64: null
  });
  
  const [verificationState, setVerificationState] = useState({
    isVerifying: false,
    completed: false,
    error: null
  });
  
  const [stream, setStream] = useState(null);

  // Format CPF input
  const formatCPF = (value) => {
    const cleanValue = value.replace(/\D/g, '');
    const formattedValue = cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
    return formattedValue;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'cpf') {
      setFormData(prev => ({
        ...prev,
        [name]: formatCPF(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const openCamera = useCallback(async () => {
    try {
      setCameraState(prev => ({ ...prev, error: null }));
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setCameraState({
        isOpen: true,
        hasPermission: true,
        error: null
      });
      
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraState({
        isOpen: false,
        hasPermission: false,
        error: 'Não foi possível acessar a câmera. Verifique as permissões.'
      });
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = imageUrl.split(',')[1];

    setSelfieData({
      captured: true,
      imageUrl,
      base64
    });

    // Stop camera
    closeCamera();
  }, []);

  const closeCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    setCameraState({
      isOpen: false,
      hasPermission: false,
      error: null
    });
  }, [stream]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target.result;
      const base64 = imageUrl.split(',')[1];
      
      setSelfieData({
        captured: true,
        imageUrl,
        base64
      });
    };
    reader.readAsDataURL(file);
  };

  const retakeSelfie = () => {
    setSelfieData({
      captured: false,
      imageUrl: null,
      base64: null
    });
  };

  const validateForm = () => {
    const { cpf, fullName, birthDate } = formData;
    const { captured } = selfieData;
    
    if (!cpf || cpf.length < 14) {
      alert('Por favor, insira um CPF válido.');
      return false;
    }
    
    if (!fullName || fullName.trim().length < 3) {
      alert('Por favor, insira seu nome completo.');
      return false;
    }
    
    if (!birthDate) {
      alert('Por favor, insira sua data de nascimento.');
      return false;
    }
    
    if (!captured) {
      alert('Por favor, capture ou faça upload de uma selfie.');
      return false;
    }
    
    return true;
  };

  const handleVerification = async () => {
    if (!validateForm()) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setVerificationState(prev => ({ ...prev, isVerifying: true, error: null }));

    try {
      // In a real implementation, you would send this data to a verification service
      // For now, we'll simulate the verification process
      
      const verificationData = {
        userId: currentUser.uid,
        cpf: formData.cpf,
        fullName: formData.fullName,
        birthDate: formData.birthDate,
        selfieBase64: selfieData.base64,
        status: 'pending', // In real implementation: 'pending', 'approved', 'rejected'
        submittedAt: Date.now(),
        verifiedAt: null
      };

      // Save verification request to database
      const verificationRef = ref(database, `verifications/${currentUser.uid}`);
      await set(verificationRef, verificationData);

      // Update user profile with verification status
      const userVerificationRef = ref(database, `users/${currentUser.uid}/verification`);
      await set(userVerificationRef, {
        status: 'pending',
        submittedAt: Date.now()
      });

      setVerificationState({
        isVerifying: false,
        completed: true,
        error: null
      });

    } catch (error) {
      console.error('Verification submission error:', error);
      setVerificationState({
        isVerifying: false,
        completed: false,
        error: 'Erro ao enviar verificação. Tente novamente.'
      });
    }
  };

  const getMinBirthDate = () => {
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 100, 0, 1);
    return minDate.toISOString().split('T')[0];
  };

  const getMaxBirthDate = () => {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    return maxDate.toISOString().split('T')[0];
  };

  if (verificationState.completed) {
    return (
      <div className="verify-page">
        <div className="verify-container">
          <div className="verification-success">
            <div className="success-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <h2>Verificação Enviada!</h2>
            <p>
              Sua documentação foi enviada com sucesso. Nossa equipe analisará seus dados 
              e você receberá uma resposta em até 48 horas.
            </p>
            <div className="success-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
              >
                <i className="fas fa-user"></i>
                Ir para Perfil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-page">
      <div className="verify-container">
        <div className="verify-header">
          <h1>
            <i className="fas fa-shield-alt"></i>
            Verificação de Identidade
          </h1>
          <p>Para usar todos os recursos do Vixter, precisamos verificar sua identidade.</p>
        </div>

        <form className="verify-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-section">
            <h3>Dados Pessoais</h3>
            
            <div className="form-group">
              <label htmlFor="cpf">CPF *</label>
              <input
                type="text"
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleInputChange}
                placeholder="000.000.000-00"
                maxLength="14"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Nome Completo *</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Seu nome completo como no documento"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="birthDate">Data de Nascimento *</label>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleInputChange}
                min={getMinBirthDate()}
                max={getMaxBirthDate()}
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Verificação Facial</h3>
            <p>Capture uma selfie clara do seu rosto para verificação.</p>
            
            {!selfieData.captured ? (
              <div className="camera-section">
                {!cameraState.isOpen ? (
                  <div className="camera-controls">
                    <button 
                      type="button"
                      className="btn btn-primary"
                      onClick={openCamera}
                    >
                      <i className="fas fa-camera"></i>
                      Abrir Câmera
                    </button>
                    
                    <div className="upload-alternative">
                      <span>ou</span>
                      <label className="upload-btn">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                        <i className="fas fa-upload"></i>
                        Fazer Upload
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="camera-view">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="camera-video"
                    />
                    <div className="camera-overlay">
                      <div className="face-guide"></div>
                    </div>
                    <div className="camera-actions">
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        onClick={closeCamera}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button"
                        className="btn btn-primary"
                        onClick={capturePhoto}
                      >
                        <i className="fas fa-camera"></i>
                        Capturar
                      </button>
                    </div>
                  </div>
                )}
                
                {cameraState.error && (
                  <div className="camera-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    <p>{cameraState.error}</p>
                    <label className="upload-btn">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                      <i className="fas fa-upload"></i>
                      Fazer Upload da Selfie
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="selfie-preview">
                <img 
                  src={selfieData.imageUrl} 
                  alt="Selfie capturada" 
                  className="selfie-image"
                />
                <div className="selfie-actions">
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    onClick={retakeSelfie}
                  >
                    <i className="fas fa-redo"></i>
                    Capturar Novamente
                  </button>
                </div>
              </div>
            )}
          </div>

          {verificationState.error && (
            <div className="verification-error">
              <i className="fas fa-exclamation-triangle"></i>
              <p>{verificationState.error}</p>
            </div>
          )}

          <div className="form-actions">
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
              disabled={verificationState.isVerifying}
            >
              <i className="fas fa-arrow-left"></i>
              Voltar
            </button>
            
            <button 
              type="button"
              className="btn btn-primary"
              onClick={handleVerification}
              disabled={verificationState.isVerifying || !selfieData.captured}
            >
              {verificationState.isVerifying ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Verificando...
                </>
              ) : (
                <>
                  <i className="fas fa-shield-check"></i>
                  Enviar Verificação
                </>
              )}
            </button>
          </div>
        </form>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default Verify;