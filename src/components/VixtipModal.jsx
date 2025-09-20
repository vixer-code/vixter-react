import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import './VixtipModal.css';

const VixtipModal = ({ isOpen, onClose, post, postType = 'vixies' }) => {
  const { currentUser } = useAuth();
  const { userProfile, loading: userLoading } = useUser();
  const { vpBalance, sendVixtip } = useWallet();
  const { showSuccess, showError, showWarning } = useNotification();
  
  const [selectedAmount, setSelectedAmount] = useState(1);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Valores pré-definidos de gorjeta
  const predefinedAmounts = [1, 5, 10, 25, 50, 100];

  // Verificar se o usuário pode dar gorjeta
  const canGiveTip = userProfile && userProfile.accountType === 'client' && vpBalance >= 1;
  const canReceiveTip = true; // Qualquer usuário pode receber gorjetas

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setShowCustomInput(false);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value) => {
    const numValue = parseInt(value) || 0;
    if (numValue >= 1 && numValue <= vpBalance) {
      setCustomAmount(value);
      setSelectedAmount(numValue);
    } else if (value === '') {
      setCustomAmount('');
      setSelectedAmount(1);
    }
  };

  const handleSendTip = async () => {
    if (userLoading) {
      showWarning('Carregando perfil do usuário...');
      return;
    }

    if (!userProfile) {
      showError('Erro ao carregar perfil do usuário. Tente novamente.');
      return;
    }

    if (!canGiveTip) {
      showWarning('Somente contas de cliente podem dar gorjetas.');
      return;
    }

    const tipAmount = showCustomInput ? parseInt(customAmount) : selectedAmount;
    
    if (tipAmount < 1) {
      showError('Valor mínimo de gorjeta é 1 VP.');
      return;
    }

    if (tipAmount > vpBalance) {
      showError('Saldo VP insuficiente.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const success = await sendVixtip({
        postId: post.id,
        postType,
        authorId: post.authorId,
        authorName: post.authorName,
        authorUsername: post.authorUsername,
        amount: tipAmount,
        buyerName: (userProfile && (userProfile.displayName || userProfile.name)) || 'Usuário',
        buyerUsername: (userProfile && userProfile.username) || ''
      });

      if (success) {
        showSuccess(`Gorjeta de ${tipAmount} VP enviada com sucesso!`, 'Vixtip Enviado');
        onClose();
        // Reset form
        setSelectedAmount(1);
        setCustomAmount('');
        setShowCustomInput(false);
      }
    } catch (error) {
      console.error('Error sending vixtip:', error);
      showError('Erro ao enviar gorjeta. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Mostrar loading se o perfil ainda está carregando
  if (userLoading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content vixtip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>
              <i className="fas fa-hand-holding-usd"></i>
              Enviar Gorjeta (Vixtip)
            </h3>
            <button className="modal-close" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <div className="loading-container">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Carregando perfil do usuário...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content vixtip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fas fa-hand-holding-usd"></i>
            Enviar Gorjeta (Vixtip)
          </h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* Informações do post */}
          <div className="vixtip-post-info">
            <div className="post-author-info">
              <img
                src={post?.authorPhotoURL || '/images/defpfp1.png'}
                alt={post?.authorName}
                className="author-avatar"
              />
              <div className="author-details">
                <h4>{post?.authorName}</h4>
                <p>@{post?.authorUsername}</p>
              </div>
            </div>
            <div className="post-preview">
              <p>"{post?.content?.substring(0, 100)}{post?.content?.length > 100 ? '...' : ''}"</p>
            </div>
          </div>

          {/* Aviso sobre não reembolso */}
          <div className="vixtip-warning">
            <i className="fas fa-exclamation-triangle"></i>
            <p>
              <strong>Atenção:</strong> Esta transação é um presente ao usuário dono do post e 
              <strong> não pode ser reembolsada</strong>.
            </p>
          </div>

          {/* Seleção de valor */}
          <div className="vixtip-amount-selection">
            <h4>Selecione o valor da gorjeta</h4>
            <div className="amount-grid">
              {predefinedAmounts.map((amount) => (
                <button
                  key={amount}
                  className={`amount-btn ${selectedAmount === amount && !showCustomInput ? 'selected' : ''} ${amount > vpBalance ? 'disabled' : ''}`}
                  onClick={() => handleAmountSelect(amount)}
                  disabled={amount > vpBalance}
                >
                  {amount} VP
                </button>
              ))}
              <button
                className={`amount-btn custom ${showCustomInput ? 'selected' : ''}`}
                onClick={() => setShowCustomInput(true)}
              >
                Personalizado
              </button>
            </div>

            {showCustomInput && (
              <div className="custom-amount-input">
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="Digite o valor"
                  min="1"
                  max={vpBalance}
                />
                <span className="currency-label">VP</span>
              </div>
            )}
          </div>

          {/* Resumo da transação simplificado */}
          <div className="vixtip-summary">
            <div className="summary-row total">
              <span>Valor da gorjeta:</span>
              <span className="amount">{selectedAmount} VP</span>
            </div>
          </div>

          {/* Saldo disponível */}
          <div className="vixtip-balance">
            <i className="fas fa-wallet"></i>
            <span>Saldo disponível: {vpBalance} VP</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </button>
          <button
            className="btn-primary vixtip-send-btn"
            onClick={handleSendTip}
            disabled={!canGiveTip || !canReceiveTip || selectedAmount < 1 || selectedAmount > vpBalance || isProcessing}
          >
            {isProcessing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Enviando...
              </>
            ) : (
              <>
                <i className="fas fa-hand-holding-usd"></i>
                Enviar Gorjeta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VixtipModal;
