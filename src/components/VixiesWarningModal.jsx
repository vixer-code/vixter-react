import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import NeonModal from './ui/NeonModal';
import VixiesSvg from './tutorials/Vixies';
import './VixiesWarningModal.css';

const VixiesWarningModal = ({ isOpen, onAccept, onCancel }) => {
  const { currentUser } = useAuth();
  const { updateUserProfile } = useUser();

  const handleAccept = async () => {
    if (currentUser) {
      try {
        // Salva a data do aceite (última vez que aceitou o aviso)
        await updateUserProfile({
          vixiesWarningAcceptedAt: Timestamp.now()
        });
        onAccept();
      } catch (error) {
        console.error('Erro ao salvar aceite do aviso Vixies:', error);
        // Mesmo assim, permite prosseguir
        onAccept();
      }
    } else {
      onAccept();
    }
  };

  const handleButtonClick = (e) => {
    e.stopPropagation();
    
    const target = e.target;
    if (!target) return;
    
    // Primeiro, tenta identificar pela imagem clicada (similar ao TutorialModal)
    const href = target.getAttribute?.('xlink:href') || target.getAttribute?.('href') || '';
    
    // Se o elemento clicado tem um href de imagem, procura a imagem mais próxima
    let imageElement = null;
    if (target.tagName === 'image' || target.tagName === 'IMAGE') {
      imageElement = target;
    } else {
      // Procura por uma imagem pai ou filha próxima
      imageElement = target.closest('image') || target.querySelector('image');
    }
    
    // Se encontrou uma imagem, verifica o grupo pai que contém o transform
    if (imageElement) {
      const parentGroup = imageElement.closest('g[transform]');
      if (parentGroup) {
        const transform = parentGroup.getAttribute?.('transform') || '';
        
        // Botão verde de aceite (transform contém 996 ou 948)
        if (transform.includes('996') || transform.includes('948')) {
          handleAccept();
          return;
        }
        
        // Botão vermelho de cancelar/ajustar (transform contém 939 ou 14.664)
        if (transform.includes('939') || transform.includes('14.664')) {
          onCancel();
          return;
        }
      }
    }
    
    // Se não encontrou pela imagem, tenta pela hierarquia de elementos
    let currentElement = target;
    let clickedGroup = null;
    
    // Procura por um grupo com transform que identifique um botão
    while (currentElement && currentElement !== e.currentTarget) {
      if (currentElement.tagName === 'g' || currentElement.tagName === 'G') {
        const transform = currentElement.getAttribute?.('transform') || '';
        if (transform && (transform.includes('996') || transform.includes('948') || transform.includes('939') || transform.includes('14.664'))) {
          clickedGroup = currentElement;
          break;
        }
      }
      currentElement = currentElement.parentElement;
    }
    
    if (clickedGroup) {
      const transform = clickedGroup.getAttribute?.('transform') || '';
      
      // Botão verde de aceite (transform contém 996 ou 948)
      if (transform.includes('996') || transform.includes('948')) {
        handleAccept();
        return;
      }
      
      // Botão vermelho de cancelar/ajustar (transform contém 939 ou 14.664)
      if (transform.includes('939') || transform.includes('14.664')) {
        onCancel();
        return;
      }
    }
    
    // Fallback: usa coordenadas para identificar a área do clique
    const svgContainer = e.currentTarget;
    const svg = svgContainer.querySelector('svg');
    if (!svg) return;
    
    const svgRect = svg.getBoundingClientRect();
    const clickX = e.clientX - svgRect.left;
    const clickY = e.clientY - svgRect.top;
    
    // O viewBox do SVG é "0 0 642 1141.5"
    const viewBoxWidth = 642;
    const viewBoxHeight = 1141.5;
    const scaleX = viewBoxWidth / svgRect.width;
    const scaleY = viewBoxHeight / svgRect.height;
    const normalizedX = clickX * scaleX;
    const normalizedY = clickY * scaleY;
    
    // Botão aceite (centro inferior, área verde) - área mais ampla
    if (normalizedY > 850 && normalizedY < 1141 && normalizedX > 150 && normalizedX < 450) {
      handleAccept();
      return;
    }
    
    // Botões cancelar (esquerdo ou direito, área vermelha)
    if (normalizedY > 850 && normalizedY < 1141) {
      // Botão esquerdo
      if (normalizedX >= 0 && normalizedX < 200) {
        onCancel();
        return;
      }
      // Botão direito
      if (normalizedX > 400 && normalizedX < 642) {
        onCancel();
        return;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <NeonModal isOpen={isOpen} onClose={onCancel}>
      <div className="vixies-warning-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="vixies-warning-svg-container" onClick={handleButtonClick}>
          <VixiesSvg className="vixies-warning-svg-image" />
        </div>
      </div>
    </NeonModal>
  );
};

export default VixiesWarningModal;

