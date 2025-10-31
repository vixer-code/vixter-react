import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
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
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState('');

  // Verificar se o tutorial já foi completado e se deve mostrar
  useEffect(() => {
    if (!userLoading && currentUser && userProfile) {
      // Se o tutorial não foi completado, mostrar o modal
      if (!userProfile.tutorialCompleted) {
        setIsOpen(true);
      }
    }
  }, [currentUser, userProfile, userLoading]);

  // Carregar URL do vídeo do Firebase Storage
  useEffect(() => {
    const loadTutorialVideo = async () => {
      try {
        const videoStorageRef = storageRef(storage, 'tutorial/videoLobby.mp4');
        const url = await getDownloadURL(videoStorageRef);
        setTutorialVideoUrl(url);
      } catch (error) {
        console.error('Erro ao carregar vídeo do tutorial:', error);
        // Se falhar, não definir a URL (o vídeo não será exibido)
      }
    };

    if (currentStep === 'video' || isOpen) {
      loadTutorialVideo();
    }
  }, [currentStep, isOpen]);

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

  // Delegar cliques no SVG do Aceite para os botões internos (vídeo/texto)
  const handleAceiteClick = (e) => {
    const target = e.target;
    if (!target) return;
    const href = target.getAttribute?.('xlink:href') || target.getAttribute?.('href') || '';
    if (!href.startsWith('data:image')) return;
    // Botão "Vídeo com Audio" (prefixo base64 conhecido)
    if (href.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA0MAAAEKCA')) {
      handleVideoChoice();
      return;
    }
    // Botão "texto com imagens" (prefixo base64 conhecido)
    if (href.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA7wAAAEKCA')) {
      handleTextChoice();
      return;
    }
  };

  // Delegar clique no botão interno do vídeo (barra inferior)
  const handleVideoInternalClick = (e) => {
    const target = e.target;
    if (!target) return;
    const href = target.getAttribute?.('xlink:href') || target.getAttribute?.('href') || '';
    if (!href.startsWith('data:image')) return;
    // Barra/botão inferior do componente de vídeo (prefixo base64 conhecido)
    if (href.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABUYAAADgCA')) {
      handleCompleteTutorial();
    }
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
            <div className="tutorial-svg-container" onClick={handleAceiteClick}>
              <Aceite className="tutorial-svg-image" onVideo={handleVideoChoice} onText={handleTextChoice} />
            </div>
          </div>
        )}

        {currentStep === 'video' && (
          <div className="tutorial-step video-step">
            <div className="tutorial-svg-container" style={{ position: 'relative' }} onClick={handleVideoInternalClick}>
              <VideoSvg className="tutorial-svg-image" onComplete={handleCompleteTutorial} />
              {tutorialVideoUrl ? (
                <video
                  ref={videoRef}
                  src={tutorialVideoUrl}
                  controls
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '80%',
                    maxWidth: 720,
                    borderRadius: 8,
                    boxShadow: '0 0 24px rgba(0,0,0,0.5)'
                  }}
                />
              ) : null}
            </div>
          </div>
        )}

        {currentStep === 'guiaEscrito' && (
          <div className="tutorial-step guia-escrito-step">
            <div className="tutorial-svg-container">
              <GuiaEscrito className="tutorial-svg-image" onComplete={handleCompleteTutorial} />
            </div>
          </div>
        )}
      </div>
    </NeonModal>
  );
};

export default TutorialModal;

