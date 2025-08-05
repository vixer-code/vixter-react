/**
 * Notification helper utilities for common notification patterns
 */

/**
 * Show email verification reminder notification
 * @param {Function} showWarning - The showWarning function from useNotification
 */
export const showEmailVerificationReminder = (showWarning) => {
  return showWarning(
    'Não esqueça de verificar seu e-mail para acessar todos os recursos da plataforma.',
    'E-mail não verificado',
    0 // No auto-dismiss
  );
};

/**
 * Show welcome notification for new users
 * @param {Function} showSuccess - The showSuccess function from useNotification
 * @param {string} userName - The user's name
 */
export const showWelcomeNotification = (showSuccess, userName = 'Usuário') => {
  return showSuccess(
    `Bem-vindo(a) ao Vixter, ${userName}! Explore nossos serviços e comece a conectar-se com a comunidade.`,
    'Bem-vindo(a)!',
    8000
  );
};

/**
 * Show service created notification
 * @param {Function} showSuccess - The showSuccess function from useNotification
 * @param {string} serviceName - The name of the created service
 */
export const showServiceCreatedNotification = (showSuccess, serviceName) => {
  return showSuccess(
    `Seu serviço "${serviceName}" foi criado com sucesso e está disponível para contratação.`,
    'Serviço Criado',
    6000
  );
};

/**
 * Show payment success notification
 * @param {Function} showSuccess - The showSuccess function from useNotification
 * @param {number} amount - The payment amount
 */
export const showPaymentSuccessNotification = (showSuccess, amount) => {
  return showSuccess(
    `Pagamento de ${amount} VP processado com sucesso!`,
    'Pagamento Confirmado',
    6000
  );
};

/**
 * Show error notification for failed operations
 * @param {Function} showError - The showError function from useNotification
 * @param {string} operation - The operation that failed
 * @param {string} details - Error details (optional)
 */
export const showOperationErrorNotification = (showError, operation, details = '') => {
  const message = details 
    ? `Falha ao ${operation}: ${details}`
    : `Falha ao ${operation}. Tente novamente.`;
  
  return showError(message, 'Erro na Operação', 8000);
};

/**
 * Show connection lost notification
 * @param {Function} showWarning - The showWarning function from useNotification
 */
export const showConnectionLostNotification = (showWarning) => {
  return showWarning(
    'Conexão com o servidor perdida. Verificando reconexão...',
    'Conexão Perdida',
    0 // No auto-dismiss
  );
};

/**
 * Show connection restored notification
 * @param {Function} showSuccess - The showSuccess function from useNotification
 */
export const showConnectionRestoredNotification = (showSuccess) => {
  return showSuccess(
    'Conexão com o servidor restaurada.',
    'Reconectado',
    4000
  );
};

/**
 * Show profile update notification
 * @param {Function} showSuccess - The showSuccess function from useNotification
 */
export const showProfileUpdatedNotification = (showSuccess) => {
  return showSuccess(
    'Seu perfil foi atualizado com sucesso.',
    'Perfil Atualizado',
    4000
  );
};

/**
 * Show new message notification
 * @param {Function} showInfo - The showInfo function from useNotification
 * @param {string} senderName - The name of the message sender
 */
export const showNewMessageNotification = (showInfo, senderName) => {
  return showInfo(
    `Você recebeu uma nova mensagem de ${senderName}.`,
    'Nova Mensagem',
    6000
  );
};

/**
 * Show booking confirmation notification
 * @param {Function} showSuccess - The showSuccess function from useNotification
 * @param {string} serviceName - The name of the booked service
 * @param {string} date - The booking date
 */
export const showBookingConfirmedNotification = (showSuccess, serviceName, date) => {
  return showSuccess(
    `Sua reserva para "${serviceName}" em ${date} foi confirmada.`,
    'Reserva Confirmada',
    7000
  );
};

// Export all helpers as a single object for easier importing
export const NotificationHelpers = {
  showEmailVerificationReminder,
  showWelcomeNotification,
  showServiceCreatedNotification,
  showPaymentSuccessNotification,
  showOperationErrorNotification,
  showConnectionLostNotification,
  showConnectionRestoredNotification,
  showProfileUpdatedNotification,
  showNewMessageNotification,
  showBookingConfirmedNotification
};

export default NotificationHelpers;