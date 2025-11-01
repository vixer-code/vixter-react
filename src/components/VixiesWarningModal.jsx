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
    const target = e.target;
    if (!target) return;
    
    // Verifica se é uma imagem clicável
    const href = target.getAttribute?.('xlink:href') || target.getAttribute?.('href') || '';
    if (!href.startsWith('data:image')) {
      // Verifica se está dentro de um grupo clicável
      const parent = target.closest('g');
      if (!parent) return;
      
      const parentImages = parent.querySelectorAll('image');
      if (parentImages.length === 0) return;
      
      const firstImage = parentImages[0];
      const imageHref = firstImage.getAttribute?.('xlink:href') || firstImage.getAttribute?.('href') || '';
      if (!imageHref.startsWith('data:image')) return;
      
      // Verifica transform para identificar botões
      const transform = parent.getAttribute?.('transform') || '';
      
      // Botão verde de aceite (parte inferior central, área ~996-1141)
      if (transform.includes('996') || transform.includes('948')) {
        handleAccept();
        e.stopPropagation();
        return;
      }
      
      // Botão vermelho de ajustar (geralmente em outra posição)
      // Verifica se há botão vermelho na área de 939 ou 14.664
      if (transform.includes('939') || transform.includes('14.664')) {
        onCancel();
        e.stopPropagation();
        return;
      }
    } else {
      // É uma imagem diretamente
      const transform = target.closest('g')?.getAttribute?.('transform') || '';
      
      // Botão aceite
      if (transform.includes('996') || transform.includes('948')) {
        handleAccept();
        e.stopPropagation();
        return;
      }
      
      // Botão cancelar/ajustar
      if (transform.includes('939') || transform.includes('14.664')) {
        onCancel();
        e.stopPropagation();
        return;
      }
    }
    
    // Fallback: verifica posição do clique
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const svgHeight = rect.height;
    const clickX = e.clientX - rect.left;
    const svgWidth = rect.width;
    
    // Botão aceite (centro inferior - área verde)
    if (clickY > svgHeight * 0.75 && Math.abs(clickX - svgWidth / 2) < svgWidth * 0.3) {
      handleAccept();
      e.stopPropagation();
    }
    // Botão ajustar (pode estar nos cantos ou área superior)
    else if (clickY < svgHeight * 0.25 || (clickX < svgWidth * 0.2) || (clickX > svgWidth * 0.8)) {
      onCancel();
      e.stopPropagation();
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

