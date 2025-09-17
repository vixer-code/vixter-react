import React from 'react';
import { Link } from 'react-router-dom';
import { useBuyerDataForOrder } from '../hooks/useBuyerData';

/**
 * Componente de exemplo que mostra como usar a lógica de buyer data
 * em um card de order individual
 */
const OrderCardWithBuyerData = ({ order, onAccept, onDecline, onDeliver }) => {
  const { enrichedOrder, loading, error, refreshBuyerData } = useBuyerDataForOrder(order);

  if (loading) {
    return (
      <div className="order-card">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando dados do comprador...</span>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Error loading buyer data:', error);
  }

  const buyerData = enrichedOrder || order;

  return (
    <div className="order-card">
      <div className="order-header">
        <div className="order-info">
          <h3>{buyerData.metadata?.serviceName || buyerData.packData?.title || 'Produto'}</h3>
          <div className="order-meta">
            <span className="order-id">#{buyerData.id.slice(-8)}</span>
            <span className="order-date">
              {buyerData.timestamps?.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || 'Data não disponível'}
            </span>
          </div>
        </div>
      </div>

      <div className="order-details">
        <div className="order-client">
          <strong>Cliente:</strong> 
          <Link 
            to={`/profile/${buyerData.buyerUsername || buyerData.buyerId || 'usuario'}`}
            className="client-link"
          >
            {buyerData.buyerName || buyerData.buyerDisplayName || buyerData.buyerUsername || 'Cliente'}
          </Link>
        </div>
        
        <div className="order-client-username">
          <strong>Username:</strong> 
          <Link 
            to={`/profile/${buyerData.buyerUsername || buyerData.buyerId || 'usuario'}`}
            className="username-link"
          >
            @{buyerData.buyerUsername || buyerData.buyerId || 'usuario'}
          </Link>
        </div>

        <div className="order-amount">
          <strong>Valor:</strong> {buyerData.vpAmount} VP
        </div>

        {buyerData.buyerProfilePictureURL && (
          <div className="buyer-profile-picture">
            <img 
              src={buyerData.buyerProfilePictureURL} 
              alt={`Foto de ${buyerData.buyerName || buyerData.buyerUsername || 'Cliente'}`}
              className="buyer-avatar"
            />
          </div>
        )}
      </div>

      <div className="order-actions">
        {buyerData.status === 'PENDING_ACCEPTANCE' && (
          <>
            <button 
              className="btn-success"
              onClick={() => onAccept && onAccept(buyerData.id)}
            >
              <i className="fas fa-check"></i>
              Aceitar
            </button>
            <button 
              className="btn-danger"
              onClick={() => onDecline && onDecline(buyerData.id)}
            >
              <i className="fas fa-times"></i>
              Recusar
            </button>
          </>
        )}
        
        {buyerData.status === 'ACCEPTED' && (
          <button 
            className="btn-primary"
            onClick={() => onDeliver && onDeliver(buyerData.id)}
          >
            <i className="fas fa-truck"></i>
            Marcar como Entregue
          </button>
        )}

        <button 
          className="btn-secondary"
          onClick={refreshBuyerData}
          title="Atualizar dados do comprador"
        >
          <i className="fas fa-sync-alt"></i>
          Atualizar Dados
        </button>
      </div>
    </div>
  );
};

export default OrderCardWithBuyerData;
