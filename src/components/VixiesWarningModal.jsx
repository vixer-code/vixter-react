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
    
    // Procura por um elemento <g> com mask contendo os IDs específicos dos botões
    let currentElement = target;
    let foundMask = null;
    
    // Percorre a hierarquia procurando por um grupo com mask
    while (currentElement && currentElement !== e.currentTarget) {
      if (currentElement.tagName === 'g' || currentElement.tagName === 'G') {
        const mask = currentElement.getAttribute?.('mask') || '';
        
        // Botão de ACEITAR: mask="url(#vixies_svg__aB)"
        if (mask.includes('vixies_svg__aB')) {
          handleAccept();
          return;
        }
        
        // Botão de VOLTAR/CANCELAR: mask="url(#vixies_svg__an)"
        if (mask.includes('vixies_svg__an')) {
          onCancel();
          return;
        }
        
        // Se encontrou um mask mas não é um dos botões conhecidos, continua procurando
        if (mask && !foundMask) {
          foundMask = mask;
        }
      }
      
      currentElement = currentElement.parentElement;
    }
    
    // Se não encontrou na hierarquia, verifica se o próprio elemento tem mask
    const directMask = target.getAttribute?.('mask') || '';
    if (directMask.includes('vixies_svg__aB')) {
      handleAccept();
      return;
    }
    if (directMask.includes('vixies_svg__an')) {
      onCancel();
      return;
    }
    
    // Se chegou aqui, não é um clique válido em um botão
    // Não faz nada - ignora o clique
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

