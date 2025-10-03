import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useReview } from '../contexts/ReviewContext';
import { useNotification } from '../contexts/NotificationContext';
import './ServicePackReviewModal.css';

const ServicePackReviewModal = ({ 
  isOpen, 
  onClose, 
  orderId,
  orderType, // 'service' or 'pack'
  itemName,
  sellerName,
  sellerPhotoURL,
  onReviewSubmitted 
}) => {
  const { createServiceReview, processing, canReviewOrder } = useReview();
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

    // Validações demoradas (queries no Firestore) - APENAS NO SUBMIT
    try {
      const canReviewResult = await canReviewOrder(orderId, orderType);
      
      if (!canReviewResult) {
        showError('Você não pode fazer esta avaliação');
        return;
      }

      // Se passou na validação, cria a avaliação
      const result = await createServiceReview(orderId, rating, comment, orderType);
      
      if (result && result.success) {
        onReviewSubmitted && onReviewSubmitted();
        onClose();
      }
    } catch (error) {
      console.error('Error validating or creating review:', error);
      showError('Erro ao processar avaliação');
    }
  };

  const handleClose = () => {
    onClose();
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
    const displayRating = hoveredRating || rating;
    const stars = [];
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

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content service-pack-review-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              <i className={`fas ${orderType === 'service' ? 'fa-cogs' : 'fa-images'}`}></i>
              Avaliar {orderType === 'service' ? 'Serviço' : 'Pack'}
            </h2>
            <button className="modal-close" onClick={handleClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div className="modal-body">
            <div className="review-form">
              {/* Item and Seller Info */}
              <div className="item-info">
                <div className="item-details">
                  <h3>{itemName}</h3>
                  <p>Vendido por: {sellerName}</p>
                </div>
                {sellerPhotoURL && (
                  <div className="seller-avatar">
                    <img src={sellerPhotoURL} alt={sellerName} />
                  </div>
                )}
              </div>

              {/* Rating Section */}
              <div className="rating-section">
                <label>Avaliação:</label>
                <div className="stars-container">
                  <div className="stars">
                    {renderStars()}
                  </div>
                  <span className="rating-text">
                    {rating > 0 ? `${rating}/5 estrelas` : 'Selecione uma avaliação'}
                  </span>
                </div>
              </div>
              
              {/* Comment Section */}
              <div className="comment-section">
                <label>Comentário:</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength="200"
                  rows="4"
                  placeholder={`Descreva sua experiência com este ${orderType === 'service' ? 'serviço' : 'pack'}...`}
                />
                <div className="character-count">
                  {comment.length}/200 caracteres
                </div>
              </div>

              {/* Review Guidelines */}
              <div className="review-guidelines">
                <h4>Dicas para uma boa avaliação:</h4>
                <ul>
                  <li>Seja específico sobre o que gostou ou não gostou</li>
                  <li>Mencione a qualidade do atendimento</li>
                  <li>Descreva se o resultado atendeu suas expectativas</li>
                  <li>Evite comentários ofensivos ou inadequados</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              className="btn-secondary" 
              onClick={handleClose}
              disabled={processing}
            >
              Cancelar
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={rating === 0 || !comment.trim() || processing}
            >
              {processing ? 'Enviando...' : 'Enviar Avaliação'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ServicePackReviewModal;
