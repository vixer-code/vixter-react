import React from 'react';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import './EmailVerificationStatus.css';

const EmailVerificationStatus = ({ showDetails = false }) => {
  const { emailVerified, emailVerifiedAt, loading } = useEmailVerification();

  if (loading) {
    return (
      <div className="email-verification-status loading">
        <Clock size={16} className="spinning" />
        <span>Verificando status do email...</span>
      </div>
    );
  }

  if (emailVerified) {
    return (
      <div className="email-verification-status verified">
        <CheckCircle size={16} />
        <span>Email verificado</span>
        {showDetails && emailVerifiedAt && (
          <span className="verification-date">
            em {new Date(emailVerifiedAt).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="email-verification-status not-verified">
      <XCircle size={16} />
      <span>Email não verificado</span>
    </div>
  );
};

export default EmailVerificationStatus;