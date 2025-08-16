import React, { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import './Wallet.css';

const Wallet = () => {
  const { 
    wallet, 
    transactions, 
    loading, 
    processingPayment,
    buyVP, 
    claimDaily, 
    canClaimDailyBonus,
    formatCurrency, 
    formatDate, 
    filterTransactions,
    vpBalance,
    vcBalance,
    vbpBalance,
    vcPendingBalance
  } = useWallet();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('credit-card');
  
  // Form states
  const [sendForm, setSendForm] = useState({
    username: '',
    amount: '',
    message: ''
  });
  const [redeemCode, setRedeemCode] = useState('');
  
  const TRANSACTIONS_PER_PAGE = 10;

  useEffect(() => {
    applyFilters();
    setCurrentPage(1);
  }, [transactions, filters]);

  const applyFilters = () => {
    const filtered = filterTransactions(filters);
    setFilteredTransactions(filtered);
  };

  const handleClaimDailyBonus = async () => {
    const success = await claimDaily();
    if (success) {
      // Success message already shown by claimDaily
    }
  };

  const handleSendVP = async () => {
    if (!sendForm.username || !sendForm.amount) {
      showError('Por favor, preencha todos os campos obrigatórios.', 'Erro de Validação');
      return;
    }

    const amount = parseInt(sendForm.amount);
    if (amount <= 0 || amount > vpBalance) {
      showError('Quantidade inválida ou saldo insuficiente.', 'Erro de Validação');
      return;
    }

    try {
      // Update VP balance
      await updateBalance('VP', -amount, true);
      
      // Add transaction
      await addTransaction('outgoing', `Enviado para @${sendForm.username}`, -amount, 'VP');
      
      setSendForm({ username: '', amount: '', message: '' });
      setShowSendModal(false);
      showSuccess(`Transferência realizada com sucesso! ${amount.toLocaleString()} VP foram enviados para @${sendForm.username}.`, 'Transferência Realizada');
    } catch (error) {
      console.error('Error sending VP:', error);
      showError('Erro ao enviar VP. Tente novamente.', 'Erro');
    }
  };

  const handleRedeemCode = async () => {
    if (!redeemCode || redeemCode.length < 19) {
      showError('Por favor, insira um código válido.', 'Código Inválido');
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
      showSuccess(`Código resgatado com sucesso! ${redeemAmount.toLocaleString()} ${currencyType} foram adicionados à sua conta.`, 'Código Resgatado');
    } catch (error) {
      console.error('Error redeeming code:', error);
      showError('Erro ao resgatar código. Tente novamente.', 'Erro');
    }
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



  const handlePackageSelection = (packageData) => {
    setSelectedPackage(packageData);
  };

  const handlePaymentMethodChange = (method) => {
    if (method === 'pix') {
      showInfo('🚧 PIX estará disponível em breve! Utilize cartão de crédito por enquanto.', 'PIX Em Breve');
      return;
    }
    setSelectedPaymentMethod(method);
  };

  const handleBuyVP = async () => {
    if (!selectedPackage) {
      showError('Por favor, selecione um pacote de VP.', 'Pacote Não Selecionado');
      return;
    }

    if (selectedPaymentMethod === 'pix') {
      showInfo('🚧 Pagamento via PIX estará disponível em breve! Por enquanto, utilize cartão de crédito.', 'PIX Em Breve');
      setSelectedPaymentMethod('credit-card');
      return;
    }

    const success = await buyVP(selectedPackage.id);
    if (success) {
      setShowBuyVPModal(false);
      setSelectedPackage(null);
    }
  };

  const pagedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
    const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE);

  // Add disabled state styling for future features
  const disabledCardStyle = {
    opacity: 0.6,
    cursor: 'not-allowed',
    position: 'relative'
  };

  const comingSoonOverlay = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    zIndex: 10
  };

  if (loading) {
    return (
      <div className="wallet-container">
        <div className="loading-text">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      {/* Balance Cards */}
      <section className="wallet-header">
        {/* VP Balance Card */}
        <div className="balance-card vp-card">
          <div className="vp-token">
            <svg className="vp-token-large" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow-large" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="hexGradient-large" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0F0F1A" />
                  <stop offset="100%" stopColor="#1A1A2E" />
                </linearGradient>
                
                <radialGradient id="glowGradient-large" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#8A2BE2" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="textGradient-large" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00FFCA" />
                  <stop offset="100%" stopColor="#00D4AA" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#glowGradient-large)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#hexGradient-large)" 
                    stroke="#8A2BE2" 
                    strokeWidth="2" 
                    filter="url(#glow-large)" />
              
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
              
              <g filter="url(#glow-large)">
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="24" 
                      fill="url(#textGradient-large)"
                      textAnchor="middle"
                      fontWeight="bold">VP</text>
              </g>
              
              <path d="M40 60 H28 V70 H36" fill="none" stroke="#00FFCA" strokeWidth="1" />
              <path d="M88 60 H100 V70 H92" fill="none" stroke="#00FFCA" strokeWidth="1" />
              <path d="M64 32 V24" fill="none" stroke="#00FFCA" strokeWidth="1" />
              <path d="M64 96 V104" fill="none" stroke="#00FFCA" strokeWidth="1" />
              
              <circle cx="28" cy="60" r="2" fill="#00FFCA" />
              <circle cx="36" cy="70" r="2" fill="#00FFCA" />
              <circle cx="100" cy="60" r="2" fill="#00FFCA" />
              <circle cx="92" cy="70" r="2" fill="#00FFCA" />
              <circle cx="64" cy="24" r="2" fill="#00FFCA" />
              <circle cx="64" cy="104" r="2" fill="#00FFCA" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#B14AFF" 
                    strokeWidth="1" 
                    opacity="0.5">
                <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-width" values="1;3;1" dur="3s" repeatCount="indefinite" />
              </path>
            </svg>
          </div>
          <div className="balance-info">
            <h2>Vixter Points</h2>
            <p className="balance-description">Para comprar serviços de criadores</p>
            <div className="balance-amount">
              <span id="wallet-vp-amount">{formatCurrency(vpBalance, '')}</span>
              <span className="currency">VP</span>
            </div>
            <button 
              className="btn-primary small"
              onClick={() => setShowBuyVPModal(true)}
            >
              <i className="fas fa-shopping-cart"></i> Comprar VP
            </button>
          </div>
        </div>

        {/* VBP Balance Card */}
        <div className="balance-card vbp-card">
          <div className="vbp-token">
            <svg className="vbp-token-large" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow-large-vbp" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="hexGradient-large-vbp" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1A0F0F" />
                  <stop offset="100%" stopColor="#2E1A1A" />
                </linearGradient>
                
                <radialGradient id="glowGradient-large-vbp" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#FFD700" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="textGradient-large-vbp" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#FFA500" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#glowGradient-large-vbp)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#hexGradient-large-vbp)" 
                    stroke="#FFD700" 
                    strokeWidth="2" 
                    filter="url(#glow-large-vbp)" />
              
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
              
              <g filter="url(#glow-large-vbp)">
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="20" 
                      fill="url(#textGradient-large-vbp)"
                      textAnchor="middle"
                      fontWeight="bold">VBP</text>
              </g>
              
              <path d="M40 60 H28 V70 H36" fill="none" stroke="#FFA500" strokeWidth="1" />
              <path d="M88 60 H100 V70 H92" fill="none" stroke="#FFA500" strokeWidth="1" />
              <path d="M64 32 V24" fill="none" stroke="#FFA500" strokeWidth="1" />
              <path d="M64 96 V104" fill="none" stroke="#FFA500" strokeWidth="1" />
              
              <circle cx="28" cy="60" r="2" fill="#FFA500" />
              <circle cx="36" cy="70" r="2" fill="#FFA500" />
              <circle cx="100" cy="60" r="2" fill="#FFA500" />
              <circle cx="92" cy="70" r="2" fill="#FFA500" />
              <circle cx="64" cy="24" r="2" fill="#FFA500" />
              <circle cx="64" cy="104" r="2" fill="#FFA500" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#FFFF00" 
                    strokeWidth="1" 
                    opacity="0.5">
                <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-width" values="1;3;1" dur="3s" repeatCount="indefinite" />
              </path>
            </svg>
          </div>
          <div className="balance-info">
            <h2>Vixter Bonus Points</h2>
            <p className="balance-description">Ganhos através de atividades na plataforma</p>
            <div className="balance-amount">
              <span id="wallet-vbp-amount">{formatCurrency(vbpBalance, '')}</span>
              <span className="currency">VBP</span>
            </div>
            <button 
              className="btn-info small"
              disabled
            >
              <i className="fas fa-info-circle"></i> VBP Grátis
            </button>
            <small className="vbp-info">Ganhe VBP através de login diário, referências e desafios!</small>
          </div>
        </div>

        {/* VC Balance Card */}
        <div className="balance-card vc-card">
          <div className="vc-token">
            <svg className="vc-token-large" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow-large-vc" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="hexGradient-large-vc" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0A1F0A" />
                  <stop offset="100%" stopColor="#1A2E1A" />
                </linearGradient>
                
                <radialGradient id="glowGradient-large-vc" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#00C853" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="textGradient-large-vc" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00C853" />
                  <stop offset="100%" stopColor="#4CAF50" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#glowGradient-large-vc)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#hexGradient-large-vc)" 
                    stroke="#00C853" 
                    strokeWidth="2" 
                    filter="url(#glow-large-vc)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#4CAF50" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                    opacity="0.8" />
                    
              <path d="M64 32 L92 48 L92 80 L64 96 L36 80 L36 48 Z" 
                    fill="none" 
                    stroke="#81C784" 
                    strokeWidth="1.5" 
                    opacity="0.8" />
              
              <g filter="url(#glow-large-vc)">
                <text x="64" y="72" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="22" 
                      fill="url(#textGradient-large-vc)"
                      textAnchor="middle"
                      fontWeight="bold">VC</text>
              </g>
              
              <path d="M40 60 H28 V70 H36" fill="none" stroke="#4CAF50" strokeWidth="1" />
              <path d="M88 60 H100 V70 H92" fill="none" stroke="#4CAF50" strokeWidth="1" />
              <path d="M64 32 V24" fill="none" stroke="#4CAF50" strokeWidth="1" />
              <path d="M64 96 V104" fill="none" stroke="#4CAF50" strokeWidth="1" />
              
              <circle cx="28" cy="60" r="2" fill="#4CAF50" />
              <circle cx="36" cy="70" r="2" fill="#4CAF50" />
              <circle cx="100" cy="60" r="2" fill="#4CAF50" />
              <circle cx="92" cy="70" r="2" fill="#4CAF50" />
              <circle cx="64" cy="24" r="2" fill="#4CAF50" />
              <circle cx="64" cy="104" r="2" fill="#4CAF50" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#A5D6A7" 
                    strokeWidth="1" 
                    opacity="0.5">
                <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-width" values="1;3;1" dur="3s" repeatCount="indefinite" />
              </path>
            </svg>
          </div>
          <div className="balance-info">
            <h2>Vixter Credits</h2>
            <p className="balance-description">Recebidos em vendas - pode sacar para real</p>
            <div className="balance-amount">
              <span id="wallet-vc-amount">{formatCurrency(vcBalance, '')}</span>
              <span className="currency">VC</span>
            </div>
            <button 
              className="btn-success small"
              disabled
            >
              <i className="fas fa-money-bill-wave"></i> Sacar VC
            </button>
            <small className="vc-info">1 VC = R$ 1,00 | Saque mínimo: 50 VC</small>
          </div>
        </div>

        {/* VC Pending Balance Card */}
        <div className="balance-card vc-pending-card">
          <div className="vc-pending-token">
            <svg className="vc-pending-token-large" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glow-large-vc-pending" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                
                <linearGradient id="hexGradient-large-vc-pending" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1F1A0A" />
                  <stop offset="100%" stopColor="#2E2A1A" />
                </linearGradient>
                
                <radialGradient id="glowGradient-large-vc-pending" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#FF9800" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#FF9800" stopOpacity="0" />
                </radialGradient>
                
                <linearGradient id="textGradient-large-vc-pending" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF9800" />
                  <stop offset="100%" stopColor="#FF5722" />
                </linearGradient>
              </defs>
              
              <circle cx="64" cy="64" r="60" fill="url(#glowGradient-large-vc-pending)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="url(#hexGradient-large-vc-pending)" 
                    stroke="#FF9800" 
                    strokeWidth="2" 
                    filter="url(#glow-large-vc-pending)" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#FFB74D" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                    opacity="0.8" />
                    
              <path d="M64 32 L92 48 L92 80 L64 96 L36 80 L36 48 Z" 
                    fill="none" 
                    stroke="#FFCC02" 
                    strokeWidth="1.5" 
                    opacity="0.8" />
              
              <g filter="url(#glow-large-vc-pending)">
                <text x="64" y="68" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="16" 
                      fill="url(#textGradient-large-vc-pending)"
                      textAnchor="middle"
                      fontWeight="bold">VC</text>
                <text x="64" y="84" 
                      fontFamily="'Press Start 2P', monospace" 
                      fontSize="10" 
                      fill="url(#textGradient-large-vc-pending)"
                      textAnchor="middle"
                      fontWeight="bold">PEND</text>
              </g>
              
              <path d="M40 60 H28 V70 H36" fill="none" stroke="#FFB74D" strokeWidth="1" />
              <path d="M88 60 H100 V70 H92" fill="none" stroke="#FFB74D" strokeWidth="1" />
              <path d="M64 32 V24" fill="none" stroke="#FFB74D" strokeWidth="1" />
              <path d="M64 96 V104" fill="none" stroke="#FFB74D" strokeWidth="1" />
              
              <circle cx="28" cy="60" r="2" fill="#FFB74D" />
              <circle cx="36" cy="70" r="2" fill="#FFB74D" />
              <circle cx="100" cy="60" r="2" fill="#FFB74D" />
              <circle cx="92" cy="70" r="2" fill="#FFB74D" />
              <circle cx="64" cy="24" r="2" fill="#FFB74D" />
              <circle cx="64" cy="104" r="2" fill="#FFB74D" />
              
              <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                    fill="none" 
                    stroke="#FFC107" 
                    strokeWidth="1" 
                    opacity="0.5">
                <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-width" values="1;3;1" dur="3s" repeatCount="indefinite" />
              </path>
              
              {/* Ícone de relógio para indicar pendência */}
              <circle cx="90" cy="38" r="8" fill="#FF5722" opacity="0.9" />
              <path d="M90 34 L90 38 L93 41" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <div className="balance-info">
            <h2>VC Pendente</h2>
            <p className="balance-description">Aguardando confirmação de serviços</p>
            <div className="balance-amount">
              <span id="wallet-vc-pending-amount">{formatCurrency(vcPendingBalance, '')}</span>
              <span className="currency">VC</span>
            </div>
            <button 
              className="btn-warning small"
              disabled
            >
              <i className="fas fa-clock"></i> Aguardando
            </button>
            <small className="vc-pending-info">Liberado após confirmação ou 24h</small>
          </div>
        </div>
      </section>

      {/* Wallet Actions */}
      <section className="wallet-actions-section">
        <button 
          className="btn-secondary"
          onClick={() => setShowSendModal(true)}
        >
          <i className="fas fa-paper-plane"></i> Enviar VP
        </button>
        <button 
          className="btn-secondary"
          onClick={() => setShowRedeemModal(true)}
        >
          <i className="fas fa-gift"></i> Resgatar Código
        </button>
      </section>

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
                <option value="vc">VC</option>
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
            {pagedTransactions.length > 0 ? (
              pagedTransactions.map((transaction) => (
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
                  className={`btn-claim ${!canClaimDailyBonus() ? 'claimed' : ''}`}
                  onClick={handleClaimDailyBonus}
                  disabled={!canClaimDailyBonus()}
                >
                  {!canClaimDailyBonus() ? 'Recebido Hoje' : 'Receber Hoje'}
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

            <div className="earning-card vbp-earning" style={disabledCardStyle}>
              <div style={comingSoonOverlay}>Em Breve</div>
              <div className="earning-icon vbp-icon-style">
                <i className="fas fa-users"></i>
              </div>
              <div className="earning-info">
                <h3>Programa de Referência</h3>
                <p>Convide amigos para a plataforma e ganhe VBP quando eles se registrarem e fizerem sua primeira compra.</p>
                <div className="earning-amount">+200 VBP por referência</div>
                <div className="currency-tag">VBP</div>
                <button className="btn-action" disabled style={{opacity: 0.5, cursor: 'not-allowed'}}>Convidar Amigos</button>
              </div>
            </div>

            <div className="earning-card vbp-earning" style={disabledCardStyle}>
              <div style={comingSoonOverlay}>Em Breve</div>
              <div className="earning-icon vbp-icon-style">
                <i className="fas fa-trophy"></i>
              </div>
              <div className="earning-info">
                <h3>Desafios Semanais</h3>
                <p>Complete desafios criativos semanais para ganhar VBP e aumentar sua visibilidade.</p>
                <div className="earning-amount">+100-500 VBP</div>
                <div className="currency-tag">VBP</div>
                <button className="btn-action" disabled style={{opacity: 0.5, cursor: 'not-allowed'}}>Ver Desafios</button>
              </div>
            </div>

            <div className="earning-card vbp-earning" style={disabledCardStyle}>
              <div style={comingSoonOverlay}>Em Breve</div>
              <div className="earning-icon vbp-icon-style">
                <i className="fas fa-heart"></i>
              </div>
              <div className="earning-info">
                <h3>Curtidas e Interações</h3>
                <p>Ganhe VBP quando suas criações receberem curtidas e comentários da comunidade.</p>
                <div className="earning-amount">+100 VBP a cada 50 curtidas</div>
                <div className="currency-tag">VBP</div>
                <button className="btn-action" disabled style={{opacity: 0.5, cursor: 'not-allowed'}}>Explorar Comunidade</button>
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
                  max={vpBalance}
                />
                <small>Saldo disponível: {formatCurrency(vpBalance, 'VP')}</small>
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
                {[
                  { id: 'pack-20', name: 'Pacote Iniciante', amount: '30 VP', price: 'R$ 20,00', bonus: null },
                  { id: 'pack-45', name: 'Pacote Essencial', amount: '66 VP', price: 'R$ 45,00', bonus: null },
                  { id: 'pack-60', name: 'Pacote Bronze', amount: '85 VP', price: 'R$ 60,00', bonus: '+ 10 VBP' },
                  { id: 'pack-85', name: 'Pacote Prata', amount: '120 VP', price: 'R$ 85,00', bonus: '+ 22 VBP', popular: true },
                  { id: 'pack-96', name: 'Pacote Safira', amount: '138 VP', price: 'R$ 96,00', bonus: '+ 36 VBP' },
                  { id: 'pack-120', name: 'Pacote Ouro', amount: '168 VP', price: 'R$ 120,00', bonus: '+ 50 VBP' },
                  { id: 'pack-150', name: 'Pacote Platina', amount: '218 VP', price: 'R$ 150,00', bonus: '+ 65 VBP', premium: true },
                  { id: 'pack-200', name: 'Pacote Diamante', amount: '288 VP', price: 'R$ 200,00', bonus: '+ 85 VBP', premium: true },
                  { id: 'pack-255', name: 'Pacote Épico', amount: '370 VP', price: 'R$ 255,00', bonus: '+ 110 VBP', elite: true },
                  { id: 'pack-290', name: 'Pacote Lendário', amount: '415 VP', price: 'R$ 290,00', bonus: '+ 135 VBP', elite: true },
                  { id: 'pack-320', name: 'Pacote Mítico', amount: '465 VP', price: 'R$ 320,00', bonus: '+ 155 VBP', elite: true }
                ].map((pkg) => (
                  <div 
                    key={pkg.id}
                    className={`package-card ${pkg.popular ? 'popular' : ''} ${pkg.premium ? 'premium' : ''} ${pkg.elite ? 'elite' : ''} ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                    data-package-id={pkg.id}
                  >
                    {pkg.popular && <div className="popular-tag">Mais Popular</div>}
                    <div className="package-name">{pkg.name}</div>
                    <div className="package-amount">{pkg.amount}</div>
                    {pkg.bonus && <div className="package-bonus">{pkg.bonus}</div>}
                    <div className="package-price">{pkg.price}</div>
                    <button 
                      className="btn-buy-package"
                      onClick={() => handlePackageSelection(pkg)}
                    >
                      {selectedPackage?.id === pkg.id ? 'Selecionado ✓' : 'Selecionar'}
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="payment-methods">
                <h3>Métodos de Pagamento</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="credit-card" 
                      checked={selectedPaymentMethod === 'credit-card'}
                      onChange={() => handlePaymentMethodChange('credit-card')}
                    />
                    <div className="option-content">
                      <i className="fas fa-credit-card"></i>
                      <span>Cartão de Crédito</span>
                    </div>
                  </label>
                  
                  <label className="payment-option">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="pix" 
                      checked={selectedPaymentMethod === 'pix'}
                      onChange={() => handlePaymentMethodChange('pix')}
                    />
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
                onClick={() => {
                  setShowBuyVPModal(false);
                  setSelectedPackage(null);
                  setSelectedPaymentMethod('credit-card');
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                disabled={!selectedPackage}
                onClick={handleBuyVP}
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
