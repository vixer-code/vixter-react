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
  const [activeTab, setActiveTab] = useState('transactions');
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [filters, setFilters] = useState({
    currency: 'all',
    type: 'all',
    period: '7days'
  });
  
  // Modal states
  const [showBuyVPModal, setShowBuyVPModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  
  // Form states
  const [sendForm, setSendForm] = useState({
    username: '',
    amount: '',
    message: ''
  });
  const [redeemCode, setRedeemCode] = useState('');
  
  // Daily bonus state
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState(false);
  
  const TRANSACTIONS_PER_PAGE = 10;

  useEffect(() => {
    if (currentUser) {
      loadWallet();
      loadTransactions();
      checkDailyBonus();
    }
  }, [currentUser]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, filters]);

  const loadWallet = async () => {
    try {
      // Fetch VP balance from users path (matching vanilla JS implementation)
      const vpRef = ref(database, `users/${currentUser.uid}/vpBalance`);
      const vpSnapshot = await get(vpRef);
      
      // Fetch VBP balance from users path (matching vanilla JS implementation)
      const vbpRef = ref(database, `users/${currentUser.uid}/vbpBalance`);
      const vbpSnapshot = await get(vbpRef);
      
      const walletData = {
        vpBalance: vpSnapshot.exists() ? vpSnapshot.val() : 0,
        vbpBalance: vbpSnapshot.exists() ? vbpSnapshot.val() : 0,
        createdAt: Date.now()
      };
      
      setWallet(walletData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading wallet:', error);
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const transactionsRef = ref(database, `users/${currentUser.uid}/transactions`);
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

  const checkDailyBonus = async () => {
    try {
      const dailyBonusRef = ref(database, `users/${currentUser.uid}/lastDailyBonus`);
      const snapshot = await get(dailyBonusRef);
      
      if (snapshot.exists()) {
        const lastClaim = snapshot.val();
        const today = new Date().toDateString();
        const lastClaimDate = new Date(lastClaim).toDateString();
        
        setDailyBonusClaimed(today === lastClaimDate);
      } else {
        setDailyBonusClaimed(false);
      }
    } catch (error) {
      console.error('Error checking daily bonus:', error);
    }
  };

  const claimDailyBonus = async () => {
    try {
      const bonusAmount = Math.floor(Math.random() * 201) + 50; // 50-250 VBP
      
      // Update VBP balance
      await updateBalance('VBP', bonusAmount, true);
      
      // Add transaction
      await addTransaction('earned', 'Bônus Diário', bonusAmount, 'VBP');
      
      // Mark as claimed
      await set(ref(database, `users/${currentUser.uid}/lastDailyBonus`), Date.now());
      
      setDailyBonusClaimed(true);
      showNotification(`Bônus diário recebido! ${bonusAmount} VBP foram adicionados à sua conta.`, 'success');
    } catch (error) {
      console.error('Error claiming daily bonus:', error);
      showNotification('Erro ao receber bônus diário. Tente novamente.', 'error');
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];
    
    // Filter by currency
    if (filters.currency !== 'all') {
      filtered = filtered.filter(t => 
        (t.currency || 'VP').toLowerCase() === filters.currency
      );
    }
    
    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => {
        let transactionType = '';
        if (t.amount > 0 && t.type !== 'earned') {
          transactionType = 'incoming';
        } else if (t.amount < 0) {
          transactionType = 'outgoing';
        } else if (t.type === 'earned') {
          transactionType = 'earned';
        } else {
          transactionType = 'purchase';
        }
        return transactionType === filters.type;
      });
    }
    
    // Filter by period
    if (filters.period !== 'all') {
      const now = Date.now();
      let periodMs = 0;
      
      switch (filters.period) {
        case '7days':
          periodMs = 7 * 24 * 60 * 60 * 1000;
          break;
        case '30days':
          periodMs = 30 * 24 * 60 * 60 * 1000;
          break;
        case '3months':
          periodMs = 90 * 24 * 60 * 60 * 1000;
          break;
      }
      
      if (periodMs > 0) {
        filtered = filtered.filter(t => now - t.timestamp <= periodMs);
      }
    }
    
    setFilteredTransactions(filtered);
    setCurrentPage(1);
  };

  const handleSendVP = async () => {
    if (!sendForm.username || !sendForm.amount) {
      showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const amount = parseInt(sendForm.amount);
    if (amount <= 0 || amount > (wallet?.vpBalance || 0)) {
      showNotification('Quantidade inválida ou saldo insuficiente.', 'error');
      return;
    }

    try {
      // Update VP balance
      await updateBalance('VP', -amount, true);
      
      // Add transaction
      await addTransaction('outgoing', `Enviado para @${sendForm.username}`, -amount, 'VP');
      
      setSendForm({ username: '', amount: '', message: '' });
      setShowSendModal(false);
      showNotification(`Transferência realizada com sucesso! ${amount.toLocaleString()} VP foram enviados para @${sendForm.username}.`, 'success');
    } catch (error) {
      console.error('Error sending VP:', error);
      showNotification('Erro ao enviar VP. Tente novamente.', 'error');
    }
  };

  const handleRedeemCode = async () => {
    if (!redeemCode || redeemCode.length < 19) {
      showNotification('Por favor, insira um código válido.', 'error');
      return;
    }

    try {
      // Simulate redemption (in real implementation, this would validate with backend)
      const isVPCode = Math.random() > 0.3; // 70% chance VP, 30% VBP
      const currencyType = isVPCode ? 'VP' : 'VBP';
      const redeemAmount = isVPCode ? Math.floor(Math.random() * 1000) + 500 : Math.floor(Math.random() * 500) + 100;
      
      // Update balance
      await updateBalance(currencyType, redeemAmount, true);
      
      // Add transaction
      await addTransaction('earned', `Código Resgatado: ${redeemCode}`, redeemAmount, currencyType);
      
      setRedeemCode('');
      setShowRedeemModal(false);
      showNotification(`Código resgatado com sucesso! ${redeemAmount.toLocaleString()} ${currencyType} foram adicionados à sua conta.`, 'success');
    } catch (error) {
      console.error('Error redeeming code:', error);
      showNotification('Erro ao resgatar código. Tente novamente.', 'error');
    }
  };

  // Update balance in Firebase (matching vanilla JS implementation)
  const updateBalance = async (currencyType, amount, isAddition = false) => {
    if (!currentUser) return;

    try {
      if (currencyType === 'VP') {
        // Update VP balance in users path (matching vanilla JS)
        const vpRef = ref(database, `users/${currentUser.uid}/vpBalance`);
        const vpSnapshot = await get(vpRef);
        const currentVpBalance = vpSnapshot.exists() ? vpSnapshot.val() : 0;
        
        const newVpBalance = isAddition ? currentVpBalance + amount : amount;
        
        await set(vpRef, newVpBalance);
      } else if (currencyType === 'VBP') {
        // Update VBP balance in users path (matching vanilla JS)
        const vbpRef = ref(database, `users/${currentUser.uid}/vbpBalance`);
        const vbpSnapshot = await get(vbpRef);
        const currentVbpBalance = vbpSnapshot.exists() ? vbpSnapshot.val() : 0;
        
        const newVbpBalance = isAddition ? currentVbpBalance + amount : amount;
        
        await set(vbpRef, newVbpBalance);
      }
      
      // Reload wallet data
      await loadWallet();
    } catch (error) {
      console.error(`Error updating ${currencyType} balance:`, error);
    }
  };

  // Add transaction to Firebase (matching vanilla JS implementation)
  const addTransaction = async (type, description, amount, currency) => {
    if (!currentUser) return;

    try {
      // Ensure currency is always uppercase (matching vanilla JS)
      const normalizedCurrency = currency.toUpperCase();
      
      const transaction = {
        type: type,
        description: description,
        amount: amount,
        currency: normalizedCurrency,
        timestamp: Date.now()
      };

      await push(ref(database, `users/${currentUser.uid}/transactions`), transaction);
      
      // Reload transactions
      await loadTransactions();
    } catch (error) {
      console.error("Error adding transaction:", error);
    }
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('pt-BR').format(amount) + ' ' + currency;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' • ' + new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (transaction) => {
    // Determine transaction type (matching vanilla JS logic)
    let typeClass = '';
    if (transaction.amount > 0 && transaction.type !== 'earned') {
      typeClass = 'incoming';
    } else if (transaction.amount < 0) {
      typeClass = 'outgoing';
    } else if (transaction.type === 'earned') {
      typeClass = 'earned';
    } else {
      typeClass = 'purchase';
    }
    
    // Determine icon (matching vanilla JS logic)
    switch (typeClass) {
      case 'outgoing':
        return 'fas fa-arrow-up';
      case 'purchase':
        return 'fas fa-shopping-cart';
      case 'earned':
        return 'fas fa-gift';
      case 'incoming':
      default:
        return 'fas fa-arrow-down';
    }
  };

  const getTransactionColor = (transaction) => {
    // Determine transaction type (matching vanilla JS logic)
    let typeClass = '';
    if (transaction.amount > 0 && transaction.type !== 'earned') {
      typeClass = 'incoming';
    } else if (transaction.amount < 0) {
      typeClass = 'outgoing';
    } else if (transaction.type === 'earned') {
      typeClass = 'earned';
    } else {
      typeClass = 'purchase';
    }
    
    // Ensure currency is properly handled
    const currency = (transaction.currency || 'VP').toUpperCase();
    
    // Set transaction colors based on currency (matching vanilla JS logic)
    if (currency === 'VBP') {
      if (typeClass === 'incoming' || typeClass === 'earned') {
        return '#FFD700'; // Gold for VBP gains
      } else {
        return '#ff5252'; // Red for VBP losses (rare)
      }
    } else {
      // VP colors
      if (typeClass === 'incoming' || typeClass === 'earned') {
        return '#00c853'; // Green for VP gains
      } else {
        return '#ff5252'; // Red for VP losses
      }
    }
  };

  const showNotification = (message, type = 'success') => {
    // Simple notification implementation
    alert(`${type.toUpperCase()}: ${message}`);
  };

  const getCurrentPageTransactions = () => {
    const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
    const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
    return filteredTransactions.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE);

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

      {/* Balance Cards */}
      <div className="wallet-balances">
        <div className="balance-card vp-balance">
          <div className="balance-icon">
            <svg className="vp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="vp-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="vp-hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0F0F1A" />
                  <stop offset="100%" stopColor="#1A1A2E" />
                </linearGradient>
                
                <radialGradient id="vp-glowGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#8A2BE2" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="vp-textGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00FFCA" />
                  <stop offset="100%" stopColor="#00D4AA" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#vp-glowGradient)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#vp-hexGradient)" 
                    stroke="#8A2BE2" 
                    strokeWidth="2" 
                    filter="url(#vp-glow)" />
              
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
              
              <g filter="url(#vp-glow)">
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="20" 
                      fill="url(#vp-textGradient)"
                      textAnchor="middle"
                      fontWeight="bold">VP</text>
              </g>
            </svg>
          </div>
          <div className="balance-info">
            <h3>Vixter Points</h3>
            <div className="balance-amount">{formatCurrency(wallet?.vpBalance || 0, 'VP')}</div>
            <p>Moeda principal para contratar serviços</p>
            <button 
              className="action-btn add-funds-btn"
              onClick={() => setShowBuyVPModal(true)}
            >
              <i className="fas fa-shopping-cart"></i>
              Comprar VP
            </button>
          </div>
        </div>

        <div className="balance-card vbp-balance">
          <div className="balance-icon">
            <svg className="vbp-icon" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="vbp-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="vbp-hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1A0F1A" />
                  <stop offset="100%" stopColor="#2E1A2E" />
                </linearGradient>
                
                <radialGradient id="vbp-glowGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#FFD700" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="vbp-textGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#FFA500" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#vbp-glowGradient)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#vbp-hexGradient)" 
                    stroke="#FFD700" 
                    strokeWidth="2" 
                    filter="url(#vbp-glow)" />
              
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
              
              <g filter="url(#vbp-glow)">
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="20" 
                      fill="url(#vbp-textGradient)"
                      textAnchor="middle"
                      fontWeight="bold">VBP</text>
              </g>
            </svg>
          </div>
          <div className="balance-info">
            <h3>Vixter Bonus Points</h3>
            <div className="balance-amount">{formatCurrency(wallet?.vbpBalance || 0, 'VBP')}</div>
            <p>Pontos bônus para recompensas especiais</p>
            <button 
              className="action-btn vbp-info-btn"
              disabled
            >
              <i className="fas fa-info-circle"></i>
              VBP Grátis
            </button>
            <small className="vbp-info">Ganhe VBP através de login diário, referências e desafios!</small>
          </div>
        </div>
      </div>

      {/* Wallet Actions */}
      <div className="wallet-actions">
        <button 
          className="action-btn send-btn"
          onClick={() => setShowSendModal(true)}
        >
          <i className="fas fa-paper-plane"></i>
          Enviar VP
        </button>
        <button 
          className="action-btn redeem-btn"
          onClick={() => setShowRedeemModal(true)}
        >
          <i className="fas fa-gift"></i>
          Resgatar Código
        </button>
      </div>

      {/* Tabs */}
      <div className="wallet-tabs">
        <button 
          className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Histórico de Transações
        </button>
        <button 
          className={`tab-btn ${activeTab === 'earnings' ? 'active' : ''}`}
          onClick={() => setActiveTab('earnings')}
        >
          Formas de Ganhar
        </button>
      </div>

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="tab-content active">
          <div className="transactions-filters">
            <div className="filter-group">
              <label htmlFor="filter-currency">Moeda</label>
              <select 
                id="filter-currency"
                value={filters.currency}
                onChange={(e) => setFilters({...filters, currency: e.target.value})}
              >
                <option value="all">Todas</option>
                <option value="vp">VP</option>
                <option value="vbp">VBP</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="filter-type">Tipo</label>
              <select 
                id="filter-type"
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
              >
                <option value="all">Todas Transações</option>
                <option value="incoming">Recebidas</option>
                <option value="outgoing">Enviadas</option>
                <option value="purchase">Compras</option>
                <option value="earned">Ganhos</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="filter-period">Período</label>
              <select 
                id="filter-period"
                value={filters.period}
                onChange={(e) => setFilters({...filters, period: e.target.value})}
              >
                <option value="7days">Últimos 7 dias</option>
                <option value="30days">Últimos 30 dias</option>
                <option value="3months">Últimos 3 meses</option>
                <option value="all">Todo Histórico</option>
              </select>
            </div>
          </div>

          <div className="transactions-list">
            {getCurrentPageTransactions().length > 0 ? (
              getCurrentPageTransactions().map((transaction) => (
                <div key={transaction.id} className="transaction-item">
                  <div className="transaction-icon">
                    <i 
                      className={getTransactionIcon(transaction)}
                      style={{ color: getTransactionColor(transaction) }}
                    ></i>
                  </div>
                  <div className="transaction-details">
                    <div className="transaction-description">{transaction.description}</div>
                    <div className="transaction-date">{formatDate(transaction.timestamp)}</div>
                  </div>
                  <div className="transaction-amount">
                    <span 
                      className="amount-value"
                      style={{ color: getTransactionColor(transaction) }}
                    >
                      {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount, transaction.currency)}
                    </span>
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

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <span className="pagination-info">Página {currentPage} de {totalPages}</span>
              <button 
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Earnings Tab */}
      {activeTab === 'earnings' && (
        <div className="tab-content active">
          <div className="earnings-grid">
            <div className="earning-card vbp-earning">
              <div className="earning-icon vbp-icon-style">
                <i className="fas fa-calendar-check"></i>
              </div>
              <div className="earning-info">
                <h3>Bônus Diário</h3>
                <p>Faça login todos os dias para ganhar VBP. Quanto mais dias consecutivos, maior o bônus!</p>
                <div className="earning-amount">+50-250 VBP</div>
                <div className="currency-tag">VBP</div>
                <button 
                  className={`btn-claim ${dailyBonusClaimed ? 'claimed' : ''}`}
                  onClick={claimDailyBonus}
                  disabled={dailyBonusClaimed}
                >
                  {dailyBonusClaimed ? 'Recebido Hoje' : 'Receber Hoje'}
                </button>
              </div>
            </div>

            <div className="earning-card vp-earning">
              <div className="earning-icon vp-icon-style">
                <i className="fas fa-shopping-cart"></i>
              </div>
              <div className="earning-info">
                <h3>Compra de VP</h3>
                <p>Adquira VP para comprar serviços de criadores.</p>
                <div className="earning-amount">Diversos pacotes disponíveis</div>
                <div className="currency-tag">VP</div>
                <button 
                  className="btn-primary"
                  onClick={() => setShowBuyVPModal(true)}
                >
                  Comprar VP
                </button>
              </div>
            </div>

            <div className="earning-card vbp-earning">
              <div className="earning-icon vbp-icon-style">
                <i className="fas fa-users"></i>
              </div>
              <div className="earning-info">
                <h3>Programa de Referência</h3>
                <p>Convide amigos para a plataforma e ganhe VBP quando eles se registrarem e fizerem sua primeira compra.</p>
                <div className="earning-amount">+200 VBP por referência</div>
                <div className="currency-tag">VBP</div>
                <button className="btn-action">Convidar Amigos</button>
              </div>
            </div>

            <div className="earning-card vbp-earning">
              <div className="earning-icon vbp-icon-style">
                <i className="fas fa-trophy"></i>
              </div>
              <div className="earning-info">
                <h3>Desafios Semanais</h3>
                <p>Complete desafios criativos semanais para ganhar VBP e aumentar sua visibilidade.</p>
                <div className="earning-amount">+100-500 VBP</div>
                <div className="currency-tag">VBP</div>
                <button className="btn-action">Ver Desafios</button>
              </div>
            </div>

            <div className="earning-card vbp-earning">
              <div className="earning-icon vbp-icon-style">
                <i className="fas fa-heart"></i>
              </div>
              <div className="earning-info">
                <h3>Curtidas e Interações</h3>
                <p>Ganhe VBP quando suas criações receberem curtidas e comentários da comunidade.</p>
                <div className="earning-amount">+100 VBP a cada 50 curtidas</div>
                <div className="currency-tag">VBP</div>
                <button className="btn-action">Explorar Comunidade</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send VP Modal */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enviar Vixter Points</h3>
              <button 
                className="modal-close"
                onClick={() => setShowSendModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Nome de Usuário do Destinatário</label>
                <input
                  type="text"
                  value={sendForm.username}
                  onChange={(e) => setSendForm({...sendForm, username: e.target.value})}
                  placeholder="Username"
                />
              </div>
              <div className="input-group">
                <label>Quantidade de VP</label>
                <input
                  type="number"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm({...sendForm, amount: e.target.value})}
                  placeholder="0"
                  min="1"
                  max={wallet?.vpBalance || 0}
                />
                <small>Saldo disponível: {formatCurrency(wallet?.vpBalance || 0, 'VP')}</small>
              </div>
              <div className="input-group">
                <label>Mensagem (Opcional)</label>
                <textarea
                  value={sendForm.message}
                  onChange={(e) => setSendForm({...sendForm, message: e.target.value})}
                  placeholder="Adicione uma mensagem para o destinatário..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowSendModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleSendVP}
              >
                Enviar VP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Code Modal */}
      {showRedeemModal && (
        <div className="modal-overlay" onClick={() => setShowRedeemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Resgatar Código</h3>
              <button 
                className="modal-close"
                onClick={() => setShowRedeemModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Digite o Código de Resgate</label>
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                    let formattedValue = '';
                    
                    for (let i = 0; i < value.length; i++) {
                      if (i > 0 && i % 4 === 0) {
                        formattedValue += '-';
                      }
                      formattedValue += value[i];
                    }
                    
                    setRedeemCode(formattedValue.substring(0, 19));
                  }}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength="19"
                />
                <small>Códigos podem resgatar VP ou VBP, dependendo do tipo de código.</small>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowRedeemModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleRedeemCode}
              >
                Resgatar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy VP Modal */}
      {showBuyVPModal && (
        <div className="modal-overlay" onClick={() => setShowBuyVPModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Comprar Vixter Points (VP)</h3>
              <button 
                className="modal-close"
                onClick={() => setShowBuyVPModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Use VP exclusivamente para comprar serviços de criadores.<br />
                Alguns pacotes já trazem VBP de bônus 😉
              </p>

              <div className="vp-packages">
                <div className="package-card" data-package-id="pack-20">
                  <div className="package-name">Pacote Iniciante</div>
                  <div className="package-amount">30 VP</div>
                  <div className="package-price">R$ 20,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card" data-package-id="pack-45">
                  <div className="package-name">Pacote Essencial</div>
                  <div className="package-amount">66 VP</div>
                  <div className="package-price">R$ 45,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card" data-package-id="pack-60">
                  <div className="package-name">Pacote Bronze</div>
                  <div className="package-amount">85 VP</div>
                  <div className="package-bonus">+ 10 VBP</div>
                  <div className="package-price">R$ 60,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card popular" data-package-id="pack-85">
                  <div className="popular-tag">Mais Popular</div>
                  <div className="package-name">Pacote Prata</div>
                  <div className="package-amount">120 VP</div>
                  <div className="package-bonus">+ 22 VBP</div>
                  <div className="package-price">R$ 85,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card" data-package-id="pack-96">
                  <div className="package-name">Pacote Safira</div>
                  <div className="package-amount">138 VP</div>
                  <div className="package-bonus">+ 36 VBP</div>
                  <div className="package-price">R$ 96,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card" data-package-id="pack-120">
                  <div className="package-name">Pacote Ouro</div>
                  <div className="package-amount">168 VP</div>
                  <div className="package-bonus">+ 50 VBP</div>
                  <div className="package-price">R$ 120,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card premium" data-package-id="pack-150">
                  <div className="package-name">Pacote Platina</div>
                  <div className="package-amount">218 VP</div>
                  <div className="package-bonus">+ 65 VBP</div>
                  <div className="package-price">R$ 150,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card premium" data-package-id="pack-200">
                  <div className="package-name">Pacote Diamante</div>
                  <div className="package-amount">288 VP</div>
                  <div className="package-bonus">+ 85 VBP</div>
                  <div className="package-price">R$ 200,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card elite" data-package-id="pack-255">
                  <div className="package-name">Pacote Épico</div>
                  <div className="package-amount">370 VP</div>
                  <div className="package-bonus">+ 110 VBP</div>
                  <div className="package-price">R$ 255,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card elite" data-package-id="pack-290">
                  <div className="package-name">Pacote Lendário</div>
                  <div className="package-amount">415 VP</div>
                  <div className="package-bonus">+ 135 VBP</div>
                  <div className="package-price">R$ 290,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>

                <div className="package-card elite" data-package-id="pack-320">
                  <div className="package-name">Pacote Mítico</div>
                  <div className="package-amount">465 VP</div>
                  <div className="package-bonus">+ 155 VBP</div>
                  <div className="package-price">R$ 320,00</div>
                  <button className="btn-buy-package">Selecionar</button>
                </div>
              </div>
              
              <div className="payment-methods">
                <h3>Métodos de Pagamento</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input type="radio" name="payment" value="credit-card" defaultChecked />
                    <div className="option-content">
                      <i className="fas fa-credit-card"></i>
                      <span>Cartão de Crédito</span>
                    </div>
                  </label>
                  
                  <label className="payment-option">
                    <input type="radio" name="payment" value="pix" />
                    <div className="option-content">
                      <i className="fas fa-qrcode"></i>
                      <span>PIX</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowBuyVPModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                disabled={!selectedPackage}
              >
                {selectedPackage ? `Comprar ${selectedPackage.amount} por ${selectedPackage.price}` : 'Selecione um pacote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
