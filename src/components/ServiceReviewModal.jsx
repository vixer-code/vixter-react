import React, { useState, useEffect } from 'react';
import { useReview } from '../contexts/ReviewContext';
import { useNotification } from '../contexts/NotificationContext';
import './ServiceReviewModal.css';

const ServiceReviewModal = ({ 
  isOpen, 
  onClose, 
  orderId, 
  orderType = 'service', 
  itemName, 
  sellerName,
  onReviewSubmitted 
}) => {
  const { createServiceReview, processing } = useReview();
  const { showError } = useNotification();
  
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setComment('');
      setHoveredRating(0);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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

    const result = await createServiceReview(orderId, rating, comment, orderType);
    
    if (result && result.success) {
      onReviewSubmitted && onReviewSubmitted();
      onClose();
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Avaliar {orderType === 'service' ? 'Serviço' : 'Pack'}</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="review-item-info">
            <h4>{itemName}</h4>
            <p>Vendedor: {sellerName}</p>
          </div>

          <form onSubmit={handleSubmit} className="review-form">
            <div className="rating-section">
              <label>Avaliação</label>
              <div className="star-rating">
                {renderStars()}
                <span className="rating-text">
                  {rating === 0 ? 'Selecione uma avaliação' : 
                   rating === 1 ? 'Péssimo' :
                   rating === 2 ? 'Ruim' :
                   rating === 3 ? 'Regular' :
                   rating === 4 ? 'Bom' : 'Excelente'}
                </span>
              </div>
            </div>

            <div className="comment-section">
              <label htmlFor="comment">Comentário</label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte sua experiência com este serviço/pack..."
                maxLength="200"
                rows="4"
              />
              <div className="character-count">
                {comment.length}/200 caracteres
              </div>
            </div>

            <div className="review-tips">
              <h5>Dicas para uma boa avaliação:</h5>
              <ul>
                <li>Seja específico sobre o que gostou ou não gostou</li>
                <li>Mencione a qualidade do atendimento</li>
                <li>Compartilhe se o resultado atendeu suas expectativas</li>
                <li>Seja respeitoso e construtivo</li>
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
  );
};

export default ServiceReviewModal;
