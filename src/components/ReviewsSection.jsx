import React, { useState, useEffect } from 'react';
import { useReview } from '../contexts/ReviewContext';
import { useAuth } from '../contexts/AuthContext';
import BehaviorReviewModal from './BehaviorReviewModal';
import './ReviewsSection.css';

const ReviewsSection = ({ 
  userId, 
  userType = 'seller', // 'seller' or 'buyer'
  showBehaviorReview = false,
  buyerId = null,
  buyerName = '',
  buyerPhotoURL = null
}) => {
  const { 
    loadUserReviews, 
    loadUserGivenReviews, 
    getAverageRating, 
    getRatingDistribution,
    canReviewBuyerBehavior,
    deleteReview,
    updateReview
  } = useReview();
  const { currentUser } = useAuth();
  
  const [reviews, setReviews] = useState([]);
  const [givenReviews, setGivenReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'service', 'pack', 'behavior'

  useEffect(() => {
    loadReviews();
  }, [userId, filter]);

  const loadReviews = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const [receivedReviews, givenReviewsData] = await Promise.all([
        loadUserReviews(userId, filter === 'all' ? 'all' : filter),
        loadUserGivenReviews(userId)
      ]);
      
      setReviews(receivedReviews);
      setGivenReviews(givenReviewsData);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBehaviorReview = async () => {
    if (!buyerId) return;
    
    // Get current user's account type from context
    // Providers can review any user's behavior
    // Clients can only review providers who provided services/packs to them
    const canReview = await canReviewBuyerBehavior(buyerId, userType);
    if (!canReview) {
      if (userType === 'buyer') {
        alert('Você só pode avaliar vendedoras que prestaram serviços/packs para você');
      } else {
        alert('Você já avaliou este usuário');
      }
      return;
    }
    
    setShowBehaviorModal(true);
  };

  const handleReviewSubmitted = () => {
    loadReviews();
  };

  const handleDeleteReview = async (reviewId) => {
    if (window.confirm('Tem certeza que deseja excluir esta avaliação?')) {
      const success = await deleteReview(reviewId);
      if (success) {
        loadReviews();
      }
    }
  };


  const renderStars = (rating, interactive = false, onStarClick = null) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={`star ${i <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
          onClick={interactive && onStarClick ? () => onStarClick(i) : undefined}
        >
          <i className="fas fa-star"></i>
        </span>
      );
    }
    return stars;
  };

  const renderReviewItem = (review, isGiven = false) => {
    const isOwner = currentUser && currentUser.uid === review.reviewerId;
    const isTarget = currentUser && currentUser.uid === review.targetUserId;

    return (
      <div key={review.id} className="review-item">
        <div className="review-header">
          <div className="reviewer-info">
            <div className="reviewer-avatar">
              {review.reviewerPhotoURL ? (
                <img src={review.reviewerPhotoURL} alt={review.reviewerUsername} />
              ) : (
                <div className="default-avatar">
                  <i className="fas fa-user"></i>
                </div>
              )}
            </div>
            <div className="reviewer-details">
              <h4>@{review.reviewerUsername}</h4>
              <p className="review-type">
                {review.type === 'service' ? 'Avaliou serviço' :
                 review.type === 'pack' ? 'Avaliou pack' :
                 'Avaliou comportamento'}
              </p>
              {review.itemName && review.type !== 'behavior' && (
                <p className="item-name">{review.itemName}</p>
              )}
            </div>
          </div>
          <div className="review-rating">
            <div className="stars">
              {renderStars(review.rating)}
            </div>
            <span className="rating-value">{review.rating}/5</span>
          </div>
        </div>
        
        <div className="review-content">
          <p className="review-comment">{review.comment}</p>
          <div className="review-meta">
            <span className="review-date">
              {review.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || 'Data não disponível'}
            </span>
            {isOwner && (
              <div className="review-actions">
                <button 
                  className="delete-btn"
                  onClick={() => handleDeleteReview(review.id)}
                  title="Excluir avaliação"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="reviews-section">
        <div className="loading">Carregando avaliações...</div>
      </div>
    );
  }

  const averageRating = getAverageRating(reviews);
  const ratingDistribution = getRatingDistribution(reviews);
  const totalReviews = reviews.length;

  return (
    <div className="reviews-section">
      <div className="reviews-header">
        <h3>
          {userType === 'seller' ? 'Avaliações Recebidas' : 'Avaliações de Comportamento'}
        </h3>
        
        {showBehaviorReview && buyerId && (
          <button 
            className="btn-primary behavior-review-btn"
            onClick={handleBehaviorReview}
          >
            <i className="fas fa-star"></i> Avaliar Comportamento
          </button>
        )}
      </div>

      {totalReviews > 0 && (
        <div className="reviews-summary">
          <div className="rating-overview">
            <span className="rating-number">{averageRating.toFixed(1)}</span>
            <div className="stars">
              {renderStars(Math.round(averageRating))}
            </div>
            <span className="total-reviews">({totalReviews} avaliações)</span>
          </div>
          
          <div className="rating-breakdown">
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="rating-bar">
                <span className="star-label">{star}★</span>
                <div className="bar-container">
                  <div 
                    className="bar-fill"
                    style={{ 
                      width: `${totalReviews > 0 ? (ratingDistribution[star] / totalReviews) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
                <span className="count">{ratingDistribution[star]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="reviews-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas
        </button>
        <button 
          className={`filter-btn ${filter === 'service' ? 'active' : ''}`}
          onClick={() => setFilter('service')}
        >
          Serviços
        </button>
        <button 
          className={`filter-btn ${filter === 'pack' ? 'active' : ''}`}
          onClick={() => setFilter('pack')}
        >
          Packs
        </button>
        {/* Only show behavior filter for sellers (providers can evaluate any user's behavior) */}
        {userType === 'seller' && (
          <button 
            className={`filter-btn ${filter === 'behavior' ? 'active' : ''}`}
            onClick={() => setFilter('behavior')}
          >
            Comportamento
          </button>
        )}
      </div>

      <div className="reviews-list">
        {reviews.length > 0 ? (
          reviews.map(review => renderReviewItem(review))
        ) : (
          <div className="no-reviews">
            <i className="fas fa-star"></i>
            <p>Nenhuma avaliação encontrada</p>
          </div>
        )}
      </div>

      {showBehaviorModal && (
        <BehaviorReviewModal
          isOpen={showBehaviorModal}
          onClose={() => setShowBehaviorModal(false)}
          buyerId={buyerId}
          buyerName={buyerName}
          buyerPhotoURL={buyerPhotoURL}
          userType={userType}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}

    </div>
  );
};

export default ReviewsSection;
