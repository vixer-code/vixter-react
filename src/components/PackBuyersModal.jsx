import React, { useState, useEffect } from 'react';
import { ref, get, update, remove } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import CachedImage from './CachedImage';
import './PackBuyersModal.css';

const PackBuyersModal = ({ isOpen, onClose, pack }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banning, setBanning] = useState(null);

  useEffect(() => {
    if (isOpen && pack) {
      loadPackBuyers();
    }
  }, [isOpen, pack]);

  const loadPackBuyers = async () => {
    if (!pack?.id) return;
    
    setLoading(true);
    try {
      const packOrdersRef = ref(database, 'packOrders');
      const snapshot = await get(packOrdersRef);
      
      if (snapshot.exists()) {
        const orders = [];
        snapshot.forEach((childSnapshot) => {
          const orderData = childSnapshot.val();
          if (orderData && orderData.packId === pack.id && orderData.sellerId === currentUser.uid) {
            orders.push({
              id: childSnapshot.key,
              ...orderData
            });
          }
        });
        
        // Sort by purchase date (newest first)
        orders.sort((a, b) => (b.timestamps?.createdAt || 0) - (a.timestamps?.createdAt || 0));
        setBuyers(orders);
      } else {
        setBuyers([]);
      }
    } catch (error) {
      console.error('Error loading pack buyers:', error);
      showError('Erro ao carregar compradores do pack');
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (orderId, buyerId, vpAmount, paymentMethod) => {
    if (paymentMethod === 'VC') {
      showWarning('Não é possível banir compras feitas com VC');
      return;
    }

    if (!window.confirm('Tem certeza que deseja banir este usuário? O VP será devolvido e o VC ganho será removido.')) {
      return;
    }

    setBanning(orderId);
    try {
      // Update order status to BANNED
      const orderRef = ref(database, `packOrders/${orderId}`);
      await update(orderRef, {
        status: 'BANNED',
        bannedAt: Date.now(),
        bannedBy: currentUser.uid
      });

      // Refund VP to buyer
      const buyerRef = ref(database, `users/${buyerId}/wallet`);
      const buyerSnapshot = await get(buyerRef);
      if (buyerSnapshot.exists()) {
        const currentVP = buyerSnapshot.val().vp || 0;
        await update(buyerRef, {
          vp: currentVP + vpAmount
        });
      }

      // Remove VC from seller
      const sellerRef = ref(database, `users/${currentUser.uid}/wallet`);
      const sellerSnapshot = await get(sellerRef);
      if (sellerSnapshot.exists()) {
        const currentVC = sellerSnapshot.val().vc || 0;
        const vcToRemove = Math.floor(vpAmount * 0.67); // Convert VP back to VC (1.5 VP = 1 VC)
        await update(sellerRef, {
          vc: Math.max(0, currentVC - vcToRemove)
        });
      }

      // Update local state
      setBuyers(prev => prev.map(buyer => 
        buyer.id === orderId 
          ? { ...buyer, status: 'BANNED' }
          : buyer
      ));

      showSuccess('Usuário banido com sucesso. VP devolvido e VC removido.');
    } catch (error) {
      console.error('Error banning user:', error);
      showError('Erro ao banir usuário');
    } finally {
      setBanning(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Data não disponível';
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!isOpen || !pack) return null;

  return (
    <div className="modal-overlay">
      <div className="pack-buyers-modal">
        <div className="modal-header">
          <h3>Compradores do Pack: {pack.title}</h3>
          <button className="close-button" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Carregando compradores...</p>
            </div>
          ) : buyers.length > 0 ? (
            <div className="buyers-list">
              {buyers.map((buyer) => (
                <div key={buyer.id} className={`buyer-card ${buyer.status === 'BANNED' ? 'banned' : ''}`}>
                  <div className="buyer-info">
                    <CachedImage
                      src={buyer.buyerAvatar}
                      alt={buyer.buyerName}
                      className="buyer-avatar"
                      showLoading={false}
                    />
                    <div className="buyer-details">
                      <h4>{buyer.buyerName || 'Usuário'}</h4>
                      <p>@{buyer.buyerUsername || 'username'}</p>
                      <div className="purchase-info">
                        <span className="purchase-amount">
                          {formatCurrency(buyer.vpAmount)} VP
                          {buyer.paymentMethod === 'VC' && <span className="vc-badge">VC</span>}
                        </span>
                        <span className="purchase-date">
                          {formatDate(buyer.timestamps?.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="buyer-actions">
                    {buyer.status === 'BANNED' ? (
                      <div className="banned-status">
                        <i className="fas fa-ban"></i>
                        <span>Banido</span>
                      </div>
                    ) : (
                      <button
                        className={`ban-button ${buyer.paymentMethod === 'VC' ? 'disabled' : ''}`}
                        onClick={() => handleBanUser(
                          buyer.id, 
                          buyer.buyerId, 
                          buyer.vpAmount, 
                          buyer.paymentMethod
                        )}
                        disabled={buyer.paymentMethod === 'VC' || banning === buyer.id}
                        title={buyer.paymentMethod === 'VC' ? 'Não é possível banir compras com VC' : 'Banir usuário'}
                      >
                        {banning === buyer.id ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                          <i className="fas fa-ban"></i>
                        )}
                        {buyer.paymentMethod === 'VC' ? 'VC' : 'Banir'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <i className="fas fa-users"></i>
              <h4>Nenhum comprador ainda</h4>
              <p>Este pack ainda não foi comprado por nenhum usuário.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PackBuyersModal;
