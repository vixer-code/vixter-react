import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useReview } from '../contexts/ReviewContext';
import './EditReviewModal.css';

const EditReviewModal = ({ 
  isOpen, 
  onClose, 
  review, 
  onReviewUpdated 
}) => {
  const { updateReview, processing } = useReview();
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');

  const handleSave = async () => {
    if (!comment.trim() || rating === 0) {
      return;
    }

    const success = await updateReview(review.id, rating, comment);
    if (success) {
      onReviewUpdated();
      onClose();
    }
  };

  const handleCancel = () => {
    setRating(review?.rating || 0);
    setComment(review?.comment || '');
    onClose();
  };

  const renderStars = (currentRating, onStarClick) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={`star ${i <= currentRating ? 'filled' : ''} interactive`}
          onClick={() => onStarClick(i)}
        >
          <i className="fas fa-star"></i>
        </span>
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
                  {renderStars(rating, setRating)}
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
