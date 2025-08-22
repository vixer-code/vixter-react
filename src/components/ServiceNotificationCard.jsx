import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { useUser } from '../contexts/UserContext';
import './ServiceNotificationCard.css';

const ServiceNotificationCard = ({ serviceOrderData, messageId }) => {
  const { currentUser } = useAuth();
  const { 
    acceptServiceOrder, 
    declineServiceOrder, 
    markServiceDelivered,
    confirmServiceDelivery,
    getOrderStatusInfo,
    ORDER_STATUS,
    processing
  } = useServiceOrder();
  const { getUserById } = useUser();

  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const isVendor = serviceOrderData.sellerId === currentUser?.uid;
  const isBuyer = serviceOrderData.buyerId === currentUser?.uid;
  const statusInfo = getOrderStatusInfo(serviceOrderData.status);

  const handleAcceptOrder = async () => {
    const success = await acceptServiceOrder(serviceOrderData.id);
    if (success) {
      // Success handled in context
    }
  };

  const handleDeclineOrder = async () => {
    if (!declineReason.trim()) {
      alert('Por favor, informe o motivo da recusa');
      return;
    }

    const success = await declineServiceOrder(serviceOrderData.id, declineReason);
    if (success) {
      setDeclining(false);
      setDeclineReason('');
    }
  };

  const handleMarkDelivered = async () => {
    const success = await markServiceDelivered(serviceOrderData.id, deliveryNotes);
    if (success) {
      setShowDeliveryForm(false);
      setDeliveryNotes('');
    }
  };

  const handleConfirmDelivery = async () => {
    const success = await confirmServiceDelivery(serviceOrderData.id, feedback);
    if (success) {
      setShowFeedbackForm(false);
      setFeedback('');
    }
  };

  const formatCurrency = (amount) => {
    return `${amount?.toLocaleString()} VP`;
  };

  const getFeaturesList = () => {
    if (!serviceOrderData.additionalFeatures?.length) return null;

    return (
      <div className="service-features">
        <h4>Recursos Adicionais:</h4>
        <ul>
          {serviceOrderData.additionalFeatures.map((feature, index) => (
            <li key={index}>
              {feature.name} - {formatCurrency(feature.price)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="service-notification-card">
      <div className="service-notification-header">
        <div className="service-icon">
          <i className="fas fa-handshake"></i>
        </div>
        <div className="service-info">
          <h3>{serviceOrderData.serviceName}</h3>
          <div className={`service-status ${statusInfo.color}`}>
            <i className={`fas fa-${statusInfo.icon}`}></i>
            {statusInfo.label}
          </div>
        </div>
      </div>

      <div className="service-notification-body">
        <div className="service-details">
          <div className="service-detail-row">
            <span className="label">
              {isVendor ? 'Comprador:' : 'Vendedor:'}
            </span>
            <span className="value">
              {isVendor ? 'Usuário comprando' : 'Usuário vendendo'}
            </span>
          </div>

          <div className="service-detail-row">
            <span className="label">Valor:</span>
            <span className="value">{formatCurrency(serviceOrderData.vpAmount)}</span>
          </div>

          <div className="service-detail-row">
            <span className="label">Ganho do vendedor:</span>
            <span className="value">
              {formatCurrency(Math.floor(serviceOrderData.vpAmount / 1.5))} VC
            </span>
          </div>

          {getFeaturesList()}

          {serviceOrderData.deliveryNotes && (
            <div className="delivery-notes">
              <h4>Notas de entrega:</h4>
              <p>{serviceOrderData.deliveryNotes}</p>
            </div>
          )}

          {serviceOrderData.buyerFeedback && (
            <div className="buyer-feedback">
              <h4>Feedback do comprador:</h4>
              <p>{serviceOrderData.buyerFeedback}</p>
            </div>
          )}

          {serviceOrderData.cancellationReason && (
            <div className="cancellation-reason">
              <h4>Motivo do cancelamento:</h4>
              <p>{serviceOrderData.cancellationReason}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="service-actions">
          {/* Vendor actions */}
          {isVendor && serviceOrderData.status === ORDER_STATUS.PENDING_ACCEPTANCE && (
            <div className="action-buttons">
              <button
                onClick={handleAcceptOrder}
                className="btn-accept"
                disabled={processing}
              >
                <i className="fas fa-check"></i>
                Aceitar Pedido
              </button>
              <button
                onClick={() => setDeclining(true)}
                className="btn-decline"
                disabled={processing}
              >
                <i className="fas fa-times"></i>
                Recusar
              </button>
            </div>
          )}

          {isVendor && serviceOrderData.status === ORDER_STATUS.ACCEPTED && (
            <div className="action-buttons">
              <button
                onClick={() => setShowDeliveryForm(true)}
                className="btn-deliver"
                disabled={processing}
              >
                <i className="fas fa-truck"></i>
                Marcar como Entregue
              </button>
            </div>
          )}

          {/* Buyer actions */}
          {isBuyer && serviceOrderData.status === ORDER_STATUS.DELIVERED && (
            <div className="action-buttons">
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="btn-confirm"
                disabled={processing}
              >
                <i className="fas fa-check-circle"></i>
                Confirmar Recebimento
              </button>
            </div>
          )}
        </div>

        {/* Decline form */}
        {declining && (
          <div className="decline-form">
            <h4>Motivo da recusa:</h4>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Explique o motivo da recusa..."
              rows={3}
            />
            <div className="form-actions">
              <button
                onClick={handleDeclineOrder}
                className="btn-confirm-decline"
                disabled={processing || !declineReason.trim()}
              >
                Confirmar Recusa
              </button>
              <button
                onClick={() => {
                  setDeclining(false);
                  setDeclineReason('');
                }}
                className="btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Delivery form */}
        {showDeliveryForm && (
          <div className="delivery-form">
            <h4>Notas de entrega (opcional):</h4>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Adicione informações sobre a entrega..."
              rows={3}
            />
            <div className="form-actions">
              <button
                onClick={handleMarkDelivered}
                className="btn-confirm-delivery"
                disabled={processing}
              >
                Confirmar Entrega
              </button>
              <button
                onClick={() => {
                  setShowDeliveryForm(false);
                  setDeliveryNotes('');
                }}
                className="btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Feedback form */}
        {showFeedbackForm && (
          <div className="feedback-form">
            <h4>Feedback sobre o serviço (opcional):</h4>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Como foi sua experiência com este serviço?"
              rows={3}
            />
            <div className="form-actions">
              <button
                onClick={handleConfirmDelivery}
                className="btn-confirm-feedback"
                disabled={processing}
              >
                Confirmar Recebimento
              </button>
              <button
                onClick={() => {
                  setShowFeedbackForm(false);
                  setFeedback('');
                }}
                className="btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceNotificationCard;
