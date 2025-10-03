import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useReview } from '../contexts/ReviewContext';
import { useNotification } from '../contexts/NotificationContext';
import './BehaviorReviewModal.css';

const BehaviorReviewModal = ({ 
  isOpen, 
  onClose, 
  buyerId, 
  buyerName,
  buyerPhotoURL,
  userType = 'seller',
  onReviewSubmitted 
}) => {
  const { createBehaviorReview, processing, canReviewBuyerBehavior } = useReview();
  const { showError } = useNotification();
  
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);

  // Reset form when modal opens
  useLayoutEffect(() => {
    if (isOpen) {
      setRating(0);
      setComment('');
      setHoveredRating(0);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações básicas (instantâneas)
    if (rating === 0) {
      showError('Por favor, selecione uma avaliação');
      return;
    }

    if (!comment.trim()) {
      showError('Por favor, escreva um comentário');
      return;
    }

    if (comment.length > 200) {
      showError('Comentário deve ter no máximo 200 caracteres');
      return;
    }

    // Validações demoradas (queries no Firestore)
    try {
      const canReviewResult = await canReviewBuyerBehavior(buyerId, userType);
      
      if (!canReviewResult) {
        if (userType === 'buyer') {
          showError('Você só pode avaliar vendedoras que prestaram serviços/packs para você');
        } else {
          showError('Você já avaliou este usuário');
        }
        return;
      }

      // Se passou na validação, cria a avaliação
      const result = await createBehaviorReview(buyerId, rating, comment, userType);
      
      if (result && result.success) {
        onReviewSubmitted && onReviewSubmitted();
        onClose();
      }
    } catch (error) {
      console.error('Error validating or creating review:', error);
      showError('Erro ao processar avaliação');
    }
  };

  const handleStarClick = (starRating) => {
    setRating(starRating);
  };

  const handleStarHover = (starRating) => {
    setHoveredRating(starRating);
  };

  const handleStarLeave = () => {
    setHoveredRating(0);
  };

  const renderStars = () => {
    const stars = [];
    const displayRating = hoveredRating || rating;

    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          className={`star ${i <= displayRating ? 'filled' : ''}`}
          onClick={() => handleStarClick(i)}
          onMouseEnter={() => handleStarHover(i)}
          onMouseLeave={handleStarLeave}
        >
          <i className="fas fa-star"></i>
        </button>
      );
    }

    return stars;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content behavior-review-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Avaliar Comportamento</h3>
            <button className="modal-close" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="modal-body">
            <div className="buyer-info">
              <div className="buyer-avatar">
                {buyerPhotoURL ? (
                  <img src={buyerPhotoURL} alt={buyerName} />
                ) : (
                  <div className="default-avatar">
                    <i className="fas fa-user"></i>
                  </div>
                )}
              </div>
              <div className="buyer-details">
                <h4>{buyerName}</h4>
                <p>{userType === 'seller' ? 'Comprador' : 'Vendedora'}</p>
              </div>
            </div>

            <div className="review-notice">
              <i className="fas fa-info-circle"></i>
              <p>
                Esta avaliação será visível no perfil do usuário e ajudará outros usuários 
                a conhecer o comportamento {userType === 'seller' ? 'dele durante as compras' : 'dela durante as vendas'}.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="review-form">
              <div className="rating-section">
                <label>Avaliação do Comportamento</label>
                <div className="star-rating">
                  {renderStars()}
                  <span className="rating-text">
                    {rating === 0 ? 'Selecione uma avaliação' : 
                     rating === 1 ? 'Muito problemático' :
                     rating === 2 ? 'Problemático' :
                     rating === 3 ? 'Regular' :
                     rating === 4 ? 'Bom' : 'Excelente'}
                  </span>
                </div>
              </div>

              <div className="comment-section">
                <label htmlFor="comment">Comentário sobre o Comportamento</label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={`Descreva como foi a experiência com este ${userType === 'seller' ? 'comprador' : 'vendedor'}...`}
                  maxLength="200"
                  rows="4"
                />
                <div className="character-count">
                  {comment.length}/200 caracteres
                </div>
              </div>

              <div className="behavior-tips">
                <h5>O que avaliar no comportamento:</h5>
                <ul>
                  <li>Respeito na comunicação</li>
                  <li>Pontualidade nas respostas</li>
                  <li>Clareza nas {userType === 'seller' ? 'solicitações' : 'explicações'}</li>
                  <li>Cooperação durante o processo</li>
                  <li>Respeito aos termos acordados</li>
                </ul>
              </div>

              <div className="behavior-guidelines">
                <h5>Diretrizes para avaliação:</h5>
                <ul>
                  <li>Seja objetivo e construtivo</li>
                  <li>Foque no comportamento, não na pessoa</li>
                  <li>Evite comentários ofensivos ou pessoais</li>
                  <li>Seja honesto sobre a experiência</li>
                </ul>
              </div>
            </form>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              disabled={processing}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={processing || rating === 0 || !comment.trim()}
            >
              {processing ? 'Enviando...' : 'Enviar Avaliação'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BehaviorReviewModal;
