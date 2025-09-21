import React, { useState } from 'react';
import { useReview } from '../contexts/ReviewContext';
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
  const { createServiceReview, processing } = useReview();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    if (rating === 0 || !comment.trim()) {
      return;
    }

    const success = await createServiceReview(orderId, rating, comment, orderType);
    if (success) {
      onReviewSubmitted();
      onClose();
      // Reset form
      setRating(0);
      setComment('');
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form
    setRating(0);
    setComment('');
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

  return (
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
                  {renderStars(rating, setRating)}
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
  );
};

export default ServicePackReviewModal;
