import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useReview } from '../contexts/ReviewContext';
import { useNotification } from '../contexts/NotificationContext';
import './EditReviewModal.css';

const EditReviewModal = ({ 
  isOpen, 
  onClose, 
  review, 
  onReviewUpdated 
}) => {
  const { updateReview, processing } = useReview();
  const { showError } = useNotification();
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [hoveredRating, setHoveredRating] = useState(0);

  // Reset form when modal opens
  useLayoutEffect(() => {
    if (isOpen) {
      setRating(review?.rating || 0);
      setComment(review?.comment || '');
      setHoveredRating(0);
    }
  }, [isOpen, review]);

  const handleSave = async (e) => {
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

    // Atualiza a avaliação
    try {
      const success = await updateReview(review.id, rating, comment);
      if (success) {
        onReviewUpdated && onReviewUpdated();
        onClose();
      }
    } catch (error) {
      console.error('Error updating review:', error);
      showError('Erro ao atualizar avaliação');
    }
  };

  const handleCancel = () => {
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-review-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Editar Avaliação</h2>
            <button className="modal-close" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div className="modal-body">
            <div className="edit-review-form">
              <div className="rating-input">
                <label>Avaliação:</label>
                <div className="stars">
                  {renderStars()}
                </div>
                <span className="rating-text">{rating}/5 estrelas</span>
              </div>
              
              <div className="comment-input">
                <label>Comentário:</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength="200"
                  rows="4"
                  placeholder="Descreva sua experiência..."
                />
                <div className="character-count">
                  {comment.length}/200 caracteres
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              className="btn-secondary" 
              onClick={handleCancel}
              disabled={processing}
            >
              Cancelar
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSave}
              disabled={!comment.trim() || rating === 0 || processing}
            >
              {processing ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditReviewModal;
