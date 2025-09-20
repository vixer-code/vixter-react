import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link } from 'react-router-dom';
import { getProfileUrlById } from '../utils/profileUrls';
import PurpleSpinner from './PurpleSpinner';
import './VixtipSupporters.css';

const VixtipSupporters = ({ postId, postType = 'vixies' }) => {
  const [supporters, setSupporters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSupporters = async () => {
      try {
        setLoading(true);
        
        // Buscar gorjetas para este post
        const vixtipsRef = collection(db, 'vixtips');
        const q = query(
          vixtipsRef,
          where('postId', '==', postId),
          where('postType', '==', postType),
          where('status', '==', 'completed'),
          orderBy('vpAmount', 'desc'),
          limit(3)
        );

        const snapshot = await getDocs(q);
        const supportersData = [];

        console.log(`VixtipSupporters: Found ${snapshot.size} supporters for post ${postId}`);

        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('VixtipSupporters: Supporter data:', data);
          supportersData.push({
            id: doc.id,
            ...data
          });
        });

        console.log('VixtipSupporters: Final supporters array:', supportersData);
        setSupporters(supportersData);
      } catch (error) {
        console.error('Error loading supporters:', error);
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      loadSupporters();
    }
  }, [postId, postType]);

  if (loading) {
    return (
      <div className="vixtip-supporters loading">
        <PurpleSpinner size="small" />
      </div>
    );
  }

  if (supporters.length === 0) {
    return null;
  }

  const getRankIcon = (index) => {
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return '';
    }
  };

  const getRankClass = (index) => {
    switch (index) {
      case 0:
        return 'first';
      case 1:
        return 'second';
      case 2:
        return 'third';
      default:
        return '';
    }
  };

  return (
    <div className="vixtip-supporters">
      <div className="supporters-header">
        <i className="fas fa-hand-holding-usd"></i>
        <span>Top Apoiadores</span>
      </div>
      <div className="supporters-list">
        {supporters.map((supporter, index) => (
          <div key={supporter.id} className={`supporter-item ${getRankClass(index)}`}>
            <div className="supporter-rank">
              <span className="rank-icon">{getRankIcon(index)}</span>
            </div>
            <div className="supporter-avatar">
              <img
                src={supporter.buyerProfilePictureURL || '/images/defpfp1.png'}
                alt={supporter.buyerName}
                onError={(e) => {
                  e.target.src = '/images/defpfp1.png';
                }}
              />
            </div>
            <div className="supporter-info">
              <Link 
                to={getProfileUrlById(supporter.buyerId, supporter.buyerUsername)}
                className="supporter-name"
              >
                {supporter.buyerName}
              </Link>
              <div className="supporter-amount">
                {supporter.vpAmount} VP
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VixtipSupporters;
