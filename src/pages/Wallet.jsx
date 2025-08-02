import React, { useState, useEffect } from 'react';
import { ref, get, set, push } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './Wallet.css';

const Wallet = () => {
  const { currentUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadWallet();
      loadTransactions();
    }
  }, [currentUser]);

  const loadWallet = async () => {
    try {
      const walletRef = ref(database, `wallets/${currentUser.uid}`);
      const snapshot = await get(walletRef);
      
      if (snapshot.exists()) {
        setWallet(snapshot.val());
      } else {
        // Create wallet if it doesn't exist
        const newWallet = {
          vpBalance: 0,
          vbpBalance: 0,
          createdAt: Date.now()
        };
        await set(walletRef, newWallet);
        setWallet(newWallet);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading wallet:', error);
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const transactionsRef = ref(database, `transactions/${currentUser.uid}`);
      const snapshot = await get(transactionsRef);
      
      if (snapshot.exists()) {
        const transactionsData = [];
        snapshot.forEach((childSnapshot) => {
          transactionsData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        
        // Sort by date (newest first)
        transactionsData.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleAddFunds = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      const vpAmount = parseFloat(amount);
      const newBalance = (wallet.vpBalance || 0) + vpAmount;
      
      // Update wallet balance
      await set(ref(database, `wallets/${currentUser.uid}`), {
        ...wallet,
        vpBalance: newBalance
      });

      // Add transaction record
      const transaction = {
        type: 'deposit',
        amount: vpAmount,
        currency: 'VP',
        description: 'Adição de fundos',
        timestamp: Date.now(),
        status: 'completed'
      };

      await push(ref(database, `transactions/${currentUser.uid}`), transaction);

      // Reload data
      await loadWallet();
      await loadTransactions();
      
      setAmount('');
      setShowAddFundsModal(false);
    } catch (error) {
      console.error('Error adding funds:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      const vpAmount = parseFloat(amount);
      const currentBalance = wallet.vpBalance || 0;
      
      if (vpAmount > currentBalance) {
        alert('Saldo insuficiente para realizar o saque.');
        return;
      }

      const newBalance = currentBalance - vpAmount;
      
      // Update wallet balance
      await set(ref(database, `wallets/${currentUser.uid}`), {
        ...wallet,
        vpBalance: newBalance
      });

      // Add transaction record
      const transaction = {
        type: 'withdrawal',
        amount: vpAmount,
        currency: 'VP',
        description: 'Saque de fundos',
        timestamp: Date.now(),
        status: 'completed'
      };

      await push(ref(database, `transactions/${currentUser.uid}`), transaction);

      // Reload data
      await loadWallet();
      await loadTransactions();
      
      setAmount('');
      setShowWithdrawModal(false);
    } catch (error) {
      console.error('Error withdrawing funds:', error);
    }
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('pt-BR').format(amount) + ' ' + currency;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return 'fas fa-plus-circle';
      case 'withdrawal':
        return 'fas fa-minus-circle';
      case 'payment':
        return 'fas fa-credit-card';
      case 'refund':
        return 'fas fa-undo';
      default:
        return 'fas fa-exchange-alt';
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'deposit':
      case 'refund':
        return '#00FFCA';
      case 'withdrawal':
      case 'payment':
        return '#FF2E63';
      default:
        return '#B8B8B8';
    }
  };

  if (loading) {
    return (
      <div className="wallet-container">
        <div className="loading-spinner">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <div className="wallet-header">
        <h1>Minha Carteira</h1>
        <p>Gerencie seus Vixter Points (VP) e Vixter Bonus Points (VBP)</p>
      </div>

      <div className="wallet-balances">
        <div className="balance-card vp-balance">
          <div className="balance-icon">
            <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0F0F1A" />
                  <stop offset="100%" stopColor="#1A1A2E" />
                </linearGradient>
                
                <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#8A2BE2" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00FFCA" />
                  <stop offset="100%" stopColor="#00D4AA" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#glowGradient)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#hexGradient)" 
                    stroke="#8A2BE2" 
                    strokeWidth="2" 
                    filter="url(#glow)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#00FFCA" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                    opacity="0.8" />
                    
              <path d="M64 32 L92 48 L92 80 L64 96 L36 80 L36 48 Z" 
                    fill="none" 
                    stroke="#FF2E63" 
                    strokeWidth="1.5" 
                    opacity="0.8" />
              
              <g filter="url(#glow)">
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="24" 
                      fill="url(#textGradient)"
                      textAnchor="middle"
                      fontWeight="bold">VP</text>
              </g>
            </svg>
          </div>
          <div className="balance-info">
            <h3>Vixter Points</h3>
            <div className="balance-amount">{formatCurrency(wallet?.vpBalance || 0, 'VP')}</div>
            <p>Moeda principal para contratar serviços</p>
          </div>
        </div>

        <div className="balance-card vbp-balance">
          <div className="balance-icon">
            <svg className="vbp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow-vbp" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="hexGradient-vbp" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1A0F1A" />
                  <stop offset="100%" stopColor="#2E1A2E" />
                </linearGradient>
                
                <radialGradient id="glowGradient-vbp" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#FFD700" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="textGradient-vbp" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#FFA500" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#glowGradient-vbp)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#hexGradient-vbp)" 
                    stroke="#FFD700" 
                    strokeWidth="2" 
                    filter="url(#glow-vbp)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#FFA500" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                    opacity="0.8" />
                    
              <path d="M64 32 L92 48 L92 80 L64 96 L36 80 L36 48 Z" 
                    fill="none" 
                    stroke="#FF6347" 
                    strokeWidth="1.5" 
                    opacity="0.8" />
              
              <g filter="url(#glow-vbp)">
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="20" 
                      fill="url(#textGradient-vbp)"
                      textAnchor="middle"
                      fontWeight="bold">VBP</text>
              </g>
            </svg>
          </div>
          <div className="balance-info">
            <h3>Vixter Bonus Points</h3>
            <div className="balance-amount">{formatCurrency(wallet?.vbpBalance || 0, 'VBP')}</div>
            <p>Pontos bônus para recompensas especiais</p>
          </div>
        </div>
      </div>

      <div className="wallet-actions">
        <button 
          className="action-btn add-funds-btn"
          onClick={() => setShowAddFundsModal(true)}
        >
          <i className="fas fa-plus"></i>
          Adicionar Fundos
        </button>
        <button 
          className="action-btn withdraw-btn"
          onClick={() => setShowWithdrawModal(true)}
        >
          <i className="fas fa-minus"></i>
          Sacar
        </button>
      </div>

      <div className="transactions-section">
        <h2>Histórico de Transações</h2>
        <div className="transactions-list">
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div className="transaction-icon">
                  <i 
                    className={getTransactionIcon(transaction.type)}
                    style={{ color: getTransactionColor(transaction.type) }}
                  ></i>
                </div>
                <div className="transaction-details">
                  <div className="transaction-description">{transaction.description}</div>
                  <div className="transaction-date">{formatDate(transaction.timestamp)}</div>
                </div>
                <div className="transaction-amount">
                  <span 
                    className="amount-value"
                    style={{ color: getTransactionColor(transaction.type) }}
                  >
                    {transaction.type === 'withdrawal' || transaction.type === 'payment' ? '-' : '+'}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </span>
                  <div className="transaction-status">{transaction.status}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-transactions">
              <i className="fas fa-receipt"></i>
              <p>Nenhuma transação encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="modal-overlay" onClick={() => setShowAddFundsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Adicionar Fundos</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddFundsModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Quantidade de VP:</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowAddFundsModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleAddFunds}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sacar Fundos</h3>
              <button 
                className="modal-close"
                onClick={() => setShowWithdrawModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Quantidade de VP:</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  max={wallet?.vpBalance || 0}
                  step="0.01"
                />
                <small>Saldo disponível: {formatCurrency(wallet?.vpBalance || 0, 'VP')}</small>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowWithdrawModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleWithdraw}
              >
                Sacar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
