import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import './TutorialModal.css';
import NeonModal from './ui/NeonModal';
import NeonButton from './ui/NeonButton';
import OverlaySlot from './ui/OverlaySlot';
import ScrollPanel from './ui/ScrollPanel';
import Aceite from './tutorials/Aceite';
import GuiaEscrito from './tutorials/GuiaEscrito';
import VideoSvg from './tutorials/Video';

const TutorialModal = () => {
  const { currentUser } = useAuth();
  const { userProfile, updateUserProfile, loading: userLoading } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState('aceite'); // aceite, video, guiaEscrito
  const videoRef = useRef(null);

  // Verificar se o tutorial já foi completado e se deve mostrar
  useEffect(() => {
    if (!userLoading && currentUser && userProfile) {
      // Se o tutorial não foi completado, mostrar o modal
      if (!userProfile.tutorialCompleted) {
        setIsOpen(true);
      }
    }
  }, [currentUser, userProfile, userLoading]);

  // Ao completar o tutorial, salvar no perfil
  const handleCompleteTutorial = async () => {
    if (currentUser) {
      try {
        await updateUserProfile({
          tutorialCompleted: true,
          tutorialCompletedAt: Timestamp.now()
        });
        setIsOpen(false);
      } catch (error) {
        console.error('Erro ao salvar conclusão do tutorial:', error);
      }
    }
  };

  // Navegar para o passo do vídeo
  const handleVideoChoice = () => {
    setCurrentStep('video');
    // Reproduzir o vídeo quando mudar para este passo
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(error => {
          console.error('Erro ao reproduzir vídeo:', error);
        });
      }
    }, 100);
  };

  // Navegar para o guia escrito
  const handleTextChoice = () => {
    setCurrentStep('guiaEscrito');
  };

  // Fechar o modal (não permitir fechar antes de completar)
  const handleClose = () => {
    // Só permitir fechar se o tutorial foi completado
    if (userProfile?.tutorialCompleted) {
      setIsOpen(false);
    }
  };

  if (!isOpen || userLoading) {
    return null;
  }

  return (
    <NeonModal isOpen={!userLoading && isOpen} onClose={handleClose}>
      <div className="tutorial-modal-content" onClick={(e) => e.stopPropagation()}>
        {currentStep === 'aceite' && (
          <div className="tutorial-step aceite-step">
            <div className="tutorial-svg-container">
              <Aceite 
                className="tutorial-svg-image" 
                onVideo={handleVideoChoice}
                onText={handleTextChoice}
              />
            </div>
          </div>
        )}

        {currentStep === 'video' && (
          <div className="tutorial-step video-step">
            <div className="tutorial-svg-container">
              <VideoSvg className="tutorial-svg-image" onComplete={handleCompleteTutorial} />
            </div>
            {/* Ações internas controladas pelo próprio componente de vídeo */}
          </div>
        )}

        {currentStep === 'guiaEscrito' && (
          <div className="tutorial-step guia-escrito-step">
            <div className="tutorial-svg-container">
              <GuiaEscrito className="tutorial-svg-image" />
              {/* Conteúdo e botões devem ser internos ao componente */}
              <OverlaySlot>
                <GuiaEscrito className="tutorial-svg-image" onComplete={handleCompleteTutorial} />
              </OverlaySlot>
            </div>
          </div>
        )}
      </div>
    </NeonModal>
  );
};

export default TutorialModal;

