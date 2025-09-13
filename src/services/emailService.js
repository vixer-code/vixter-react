// emailService.js - Serviço para envio de notificações por e-mail
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// Função para enviar e-mail de status de serviço
const sendServiceStatusEmail = httpsCallable(functions, 'sendServiceStatusEmail');

/**
 * Envia notificação por e-mail para mudanças de status de serviços
 * @param {Object} emailData - Dados do e-mail
 * @param {string} emailData.serviceOrderId - ID do pedido de serviço
 * @param {string} emailData.serviceName - Nome do serviço
 * @param {string} emailData.status - Status do serviço (ACCEPTED, DELIVERED, CONFIRMED, CANCELLED)
 * @param {string} emailData.recipientEmail - E-mail do destinatário
 * @param {string} emailData.recipientName - Nome do destinatário
 * @param {string} emailData.sellerName - Nome do vendedor
 * @param {string} emailData.buyerName - Nome do comprador
 * @param {number} emailData.vpAmount - Valor em VP
 * @param {Object} emailData.additionalInfo - Informações adicionais (opcional)
 * @returns {Promise<Object>} Resultado do envio
 */
export const sendServiceStatusEmailNotification = async (emailData) => {
  try {
    const result = await sendServiceStatusEmail(emailData);
    return result.data;
  } catch (error) {
    console.error('Error sending service status email:', error);
    throw error;
  }
};

/**
 * Envia e-mail de notificação quando serviço é aceito
 * @param {Object} serviceOrder - Dados do pedido de serviço
 * @param {Object} sellerData - Dados do vendedor
 * @param {Object} buyerData - Dados do comprador
 */
export const sendServiceAcceptedEmail = async (serviceOrder, sellerData, buyerData) => {
  const emailData = {
    serviceOrderId: serviceOrder.id,
    serviceName: serviceOrder.metadata?.serviceName || serviceOrder.serviceName || 'Serviço',
    status: 'ACCEPTED',
    recipientEmail: buyerData.email,
    recipientName: buyerData.displayName || buyerData.name || 'Cliente',
    sellerName: sellerData.displayName || sellerData.name || 'Vendedor',
    buyerName: buyerData.displayName || buyerData.name || 'Cliente',
    vpAmount: serviceOrder.vpAmount
  };

  return await sendServiceStatusEmailNotification(emailData);
};

/**
 * Envia e-mail de notificação quando serviço é entregue
 * @param {Object} serviceOrder - Dados do pedido de serviço
 * @param {Object} sellerData - Dados do vendedor
 * @param {Object} buyerData - Dados do comprador
 */
export const sendServiceDeliveredEmail = async (serviceOrder, sellerData, buyerData) => {
  const emailData = {
    serviceOrderId: serviceOrder.id,
    serviceName: serviceOrder.metadata?.serviceName || serviceOrder.serviceName || 'Serviço',
    status: 'DELIVERED',
    recipientEmail: buyerData.email,
    recipientName: buyerData.displayName || buyerData.name || 'Cliente',
    sellerName: sellerData.displayName || sellerData.name || 'Vendedor',
    buyerName: buyerData.displayName || buyerData.name || 'Cliente',
    vpAmount: serviceOrder.vpAmount
  };

  return await sendServiceStatusEmailNotification(emailData);
};

/**
 * Envia e-mail de notificação quando serviço é concluído
 * @param {Object} serviceOrder - Dados do pedido de serviço
 * @param {Object} sellerData - Dados do vendedor
 * @param {Object} buyerData - Dados do comprador
 */
export const sendServiceCompletedEmail = async (serviceOrder, sellerData, buyerData) => {
  const emailData = {
    serviceOrderId: serviceOrder.id,
    serviceName: serviceOrder.metadata?.serviceName || serviceOrder.serviceName || 'Serviço',
    status: 'CONFIRMED',
    recipientEmail: buyerData.email,
    recipientName: buyerData.displayName || buyerData.name || 'Cliente',
    sellerName: sellerData.displayName || sellerData.name || 'Vendedor',
    buyerName: buyerData.displayName || buyerData.name || 'Cliente',
    vpAmount: serviceOrder.vpAmount
  };

  return await sendServiceStatusEmailNotification(emailData);
};

/**
 * Envia e-mail de notificação quando serviço é cancelado
 * @param {Object} serviceOrder - Dados do pedido de serviço
 * @param {Object} sellerData - Dados do vendedor
 * @param {Object} buyerData - Dados do comprador
 * @param {string} reason - Motivo do cancelamento
 */
export const sendServiceCancelledEmail = async (serviceOrder, sellerData, buyerData, reason = '') => {
  const emailData = {
    serviceOrderId: serviceOrder.id,
    serviceName: serviceOrder.metadata?.serviceName || serviceOrder.serviceName || 'Serviço',
    status: 'CANCELLED',
    recipientEmail: buyerData.email,
    recipientName: buyerData.displayName || buyerData.name || 'Cliente',
    sellerName: sellerData.displayName || sellerData.name || 'Vendedor',
    buyerName: buyerData.displayName || buyerData.name || 'Cliente',
    vpAmount: serviceOrder.vpAmount,
    additionalInfo: { reason }
  };

  return await sendServiceStatusEmailNotification(emailData);
};

export default {
  sendServiceStatusEmailNotification,
  sendServiceAcceptedEmail,
  sendServiceDeliveredEmail,
  sendServiceCompletedEmail,
  sendServiceCancelledEmail
};
