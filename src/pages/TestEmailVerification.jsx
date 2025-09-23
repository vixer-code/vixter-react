import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sendEmailVerification } from 'firebase/auth';

const TestEmailVerification = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const testSendEmail = async () => {
    if (!currentUser) {
      setMessage('Usuário não está logado');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      console.log('Testing email verification...');
      console.log('User email:', currentUser.email);
      console.log('User emailVerified:', currentUser.emailVerified);
      console.log('Current domain:', window.location.origin);
      
      const verificationResult = await sendEmailVerification(currentUser, {
        url: `https://vixter-react.vercel.app/verify-email`,
        handleCodeInApp: false
      });
      
      console.log('Verification result:', verificationResult);
      setMessage('Email de verificação enviado com sucesso!');
      console.log('Email verification sent successfully');
    } catch (error) {
      console.error('Error sending email verification:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setMessage(`Erro: ${error.message} (Code: ${error.code})`);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return <div>Você precisa estar logado para testar o envio de email.</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Teste de Envio de Email de Verificação</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Email:</strong> {currentUser.email}</p>
        <p><strong>Email Verificado:</strong> {currentUser.emailVerified ? 'Sim' : 'Não'}</p>
        <p><strong>UID:</strong> {currentUser.uid}</p>
      </div>

      <button 
        onClick={testSendEmail} 
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#8b5cf6',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Enviando...' : 'Enviar Email de Verificação'}
      </button>

      {message && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: message.includes('sucesso') ? '#d1fae5' : '#fecaca',
          color: message.includes('sucesso') ? '#065f46' : '#991b1b',
          borderRadius: '5px'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>URL de redirecionamento configurada:</strong> https://vixter-react.vercel.app/verify-email</p>
        <p><strong>Template configurado no Firebase:</strong> Vixia - Suporte da Vixter</p>
      </div>
    </div>
  );
};

export default TestEmailVerification;
