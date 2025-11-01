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
    // Previne qualquer propagação por padrão
    e.stopPropagation();
    
    const target = e.target;
    if (!target) return;
    
    // Procura pelo elemento <g> pai mais próximo que tenha um transform
    let currentElement = target;
    let clickedGroup = null;
    
    // Procura por um grupo com transform que identifique um botão
    while (currentElement && currentElement !== e.currentTarget) {
      if (currentElement.tagName === 'g' || currentElement.tagName === 'G') {
        const transform = currentElement.getAttribute?.('transform') || '';
        if (transform) {
          clickedGroup = currentElement;
          break;
        }
      }
      currentElement = currentElement.parentElement;
    }
    
    // Se não encontrou um grupo, verifica se é uma imagem com um grupo pai
    if (!clickedGroup) {
      clickedGroup = target.closest('g[transform]');
    }
    
    if (!clickedGroup) {
      // Se não encontrou nenhum grupo com transform, não faz nada
      // Isso previne cliques acidentais em outras partes do SVG
      return;
    }
    
    const transform = clickedGroup.getAttribute?.('transform') || '';
    
    // Verifica especificamente pelos botões conhecidos
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
    
    // Se não corresponde a nenhum botão conhecido, não faz nada
    // Isso previne cliques acidentais em outras partes do SVG
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

