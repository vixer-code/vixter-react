import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Success.css';

const Success = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [countDown, setCountDown] = useState(5);
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Get payment details from URL params
  useEffect(() => {
    const amount = searchParams.get('amount');
    const sessionId = searchParams.get('session_id');
    const paymentType = searchParams.get('type') || 'vp_purchase';
    
    setPaymentDetails({
      amount: amount ? parseFloat(amount) : null,
      sessionId,
      type: paymentType
    });
  }, [searchParams]);

  // Auto redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountDown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRedirect = () => {
    if (paymentDetails?.type === 'service_booking') {
      navigate('/services');
    } else {
      navigate('/wallet');
    }
  };

  const getSuccessMessage = () => {
    switch (paymentDetails?.type) {
      case 'service_booking':
        return {
          title: 'Serviço Agendado!',
          description: 'Seu serviço foi agendado com sucesso. O prestador foi notificado.',
          buttonText: 'Ver Meus Agendamentos'
        };
      case 'vp_purchase':
      default:
        return {
          title: 'Pagamento Realizado!',
          description: 'Seu pagamento foi processado com sucesso. Seus Vixter Points já estão disponíveis.',
          buttonText: 'Ir para Carteira'
        };
    }
  };

  const formatAmount = (amount) => {
    if (!amount) return '';
    return `VP ${parseFloat(amount).toFixed(2)}`;
  };

  const message = getSuccessMessage();

  return (
    <div className="success-page">
      <div className="success-container">
        <div className="success-card">
          <div className="success-animation">
            <div className="checkmark-circle">
              <div className="checkmark">
                <div className="checkmark-stem"></div>
                <div className="checkmark-kick"></div>
              </div>
            </div>
          </div>

          <div className="success-content">
            <h1 className="success-title">{message.title}</h1>
            <p className="success-description">{message.description}</p>
            
            {paymentDetails?.amount && (
              <div className="payment-details">
                <div className="amount-display">
                  <span className="amount-label">Valor:</span>
                  <span className="amount-value">{formatAmount(paymentDetails.amount)}</span>
                </div>
              </div>
            )}

            {paymentDetails?.sessionId && (
              <div className="transaction-id">
                <span className="transaction-label">ID da Transação:</span>
                <span className="transaction-value">{paymentDetails.sessionId}</span>
              </div>
            )}
          </div>

          <div className="success-actions">
            <button 
              className="btn btn-primary"
              onClick={handleRedirect}
            >
              <i className={paymentDetails?.type === 'service_booking' ? 'fas fa-calendar' : 'fas fa-wallet'}></i>
              {message.buttonText}
            </button>
            
            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/profile')}
            >
              <i className="fas fa-user"></i>
              Ir para Perfil
            </button>
          </div>

          <div className="auto-redirect">
            <p>
              Redirecionando automaticamente em <span className="countdown">{countDown}</span> segundos...
            </p>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${((5 - countDown) / 5) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="background-decoration">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
          <div className="floating-shape shape-4"></div>
        </div>
      </div>
    </div>
  );
};

export default Success;