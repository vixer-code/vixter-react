// email-functions.js - Sistema de Notificações por E-mail Vixter
// Funções para envio de e-mails de notificação de serviços

/* eslint-env node */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Configurações globais
setGlobalOptions({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60,
});

// const db = admin.firestore(); // Will be used for future database operations

/**
 * Envia notificação por e-mail para mudanças de status de serviços
 */
export const sendServiceStatusEmail = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const {
    serviceOrderId,
    serviceName,
    status,
    recipientEmail,
    recipientName
    // sellerName, buyerName, vpAmount, additionalInfo - will be used for actual email sending
  } = request.data;

  try {
    // const userId = request.auth.uid; // Will be used for future user tracking
    
    // Templates de e-mail baseados no status
    let emailSubject = '';
    // let emailContent = ''; // Will be used for actual email sending
    
    switch (status) {
      case 'ACCEPTED':
        emailSubject = `✅ Seu pedido foi aceito - ${serviceName}`;
        // emailContent = getServiceAcceptedTemplate(serviceName, sellerName, buyerName, vpAmount);
        break;
        
      case 'DELIVERED':
        emailSubject = `📦 Serviço entregue - ${serviceName}`;
        // emailContent = getServiceDeliveredTemplate(serviceName, sellerName, buyerName, vpAmount);
        break;
        
      case 'CONFIRMED':
        emailSubject = `🎉 Serviço concluído - ${serviceName}`;
        // emailContent = getServiceCompletedTemplate(serviceName, sellerName, buyerName, vpAmount);
        break;
        
      case 'CANCELLED':
        emailSubject = `❌ Pedido cancelado - ${serviceName}`;
        // emailContent = getServiceCancelledTemplate(serviceName, sellerName, buyerName, vpAmount, additionalInfo.reason);
        break;
        
      default:
        emailSubject = `📋 Atualização do serviço - ${serviceName}`;
        // emailContent = getServiceUpdateTemplate(serviceName, sellerName, buyerName, status, vpAmount);
    }

    // Dados do email (preparados para envio futuro)
    // const emailData = {
    //   to: recipientEmail,
    //   subject: emailSubject,
    //   html: emailContent
    // };

    logger.info(`📧 Service status email prepared for ${recipientEmail}: ${status} - ${serviceName}`);

    return {
      success: true,
      message: "Email de notificação preparado",
      emailData: {
        to: recipientEmail,
        subject: emailSubject,
        serviceName,
        status,
        recipientName
      }
    };

  } catch (error) {
    logger.error(`💥 Error sending service status email for ${serviceOrderId}:`, error);
    throw new HttpsError("internal", "Erro ao enviar email de notificação");
  }
});

// Templates de e-mail (comentados para uso futuro)
/*
function getServiceAcceptedTemplate(serviceName, sellerName, buyerName, vpAmount) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #00ffca 0%, #8a2be2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">✅ Pedido Aceito!</h1>
          </div>
        </div>

        <!-- Content -->
        <div style="color: #333; line-height: 1.6;">
          <p>Olá <strong>${buyerName}</strong>,</p>
          
          <p>Ótimas notícias! Seu pedido foi aceito pelo vendedor.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00ffca;">
            <h3 style="margin: 0 0 10px 0; color: #00ffca;">📋 Detalhes do Serviço</h3>
            <p style="margin: 5px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 5px 0;"><strong>Vendedor:</strong> ${sellerName}</p>
            <p style="margin: 5px 0;"><strong>Valor:</strong> ${vpAmount} VP</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Aceito - Em Andamento</p>
          </div>
          
          <p>O vendedor começará a trabalhar no seu serviço em breve. Você pode acompanhar o progresso através da conversa no Vixter.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://vixter.com/messages" style="background: linear-gradient(135deg, #00ffca 0%, #8a2be2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Ver Conversa
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 0 0 10px 0;">Precisa de ajuda?</p>
          <p style="margin: 0;">
            <a href="mailto:suporte@vixter.com" style="color: #8A2BE2; text-decoration: none;">suporte@vixter.com</a>
          </p>
          <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
            Este é um email automático. Não responda a esta mensagem.
          </p>
        </div>

      </div>
    </div>
  `;
}

function getServiceDeliveredTemplate(serviceName, sellerName, buyerName, vpAmount) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">📦 Serviço Entregue!</h1>
          </div>
        </div>

        <!-- Content -->
        <div style="color: #333; line-height: 1.6;">
          <p>Olá <strong>${buyerName}</strong>,</p>
          
          <p>Seu serviço foi entregue pelo vendedor!</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="margin: 0 0 10px 0; color: #28a745;">📋 Detalhes do Serviço</h3>
            <p style="margin: 5px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 5px 0;"><strong>Vendedor:</strong> ${sellerName}</p>
            <p style="margin: 5px 0;"><strong>Valor:</strong> ${vpAmount} VP</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Entregue - Aguardando Confirmação</p>
          </div>
          
          <p><strong>⚠️ Importante:</strong> Confirme o recebimento do serviço para liberar o pagamento ao vendedor. Acesse "Minhas Compras" no Vixter para confirmar.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://vixter.com/my-purchases" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Confirmar Recebimento
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 0 0 10px 0;">Precisa de ajuda?</p>
          <p style="margin: 0;">
            <a href="mailto:suporte@vixter.com" style="color: #8A2BE2; text-decoration: none;">suporte@vixter.com</a>
          </p>
          <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
            Este é um email automático. Não responda a esta mensagem.
          </p>
        </div>

      </div>
    </div>
  `;
}

function getServiceCompletedTemplate(serviceName, sellerName, buyerName, vpAmount) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #8A2BE2 0%, #00ffca 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">🎉 Serviço Concluído!</h1>
          </div>
        </div>

        <!-- Content -->
        <div style="color: #333; line-height: 1.6;">
          <p>Olá <strong>${buyerName}</strong>,</p>
          
          <p>Parabéns! Seu serviço foi concluído com sucesso.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8A2BE2;">
            <h3 style="margin: 0 0 10px 0; color: #8A2BE2;">📋 Detalhes do Serviço</h3>
            <p style="margin: 5px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 5px 0;"><strong>Vendedor:</strong> ${sellerName}</p>
            <p style="margin: 5px 0;"><strong>Valor:</strong> ${vpAmount} VP</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Concluído</p>
          </div>
          
          <p>O pagamento foi liberado para o vendedor e a conversa foi finalizada. Você pode comprar novamente este serviço se desejar.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://vixter.com/my-purchases" style="background: linear-gradient(135deg, #8A2BE2 0%, #00ffca 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Ver Minhas Compras
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 0 0 10px 0;">Precisa de ajuda?</p>
          <p style="margin: 0;">
            <a href="mailto:suporte@vixter.com" style="color: #8A2BE2; text-decoration: none;">suporte@vixter.com</a>
          </p>
          <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
            Este é um email automático. Não responda a esta mensagem.
          </p>
        </div>

      </div>
    </div>
  `;
}

function getServiceCancelledTemplate(serviceName, sellerName, buyerName, vpAmount, reason) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">❌ Pedido Cancelado</h1>
          </div>
        </div>

        <!-- Content -->
        <div style="color: #333; line-height: 1.6;">
          <p>Olá <strong>${buyerName}</strong>,</p>
          
          <p>Infelizmente, seu pedido foi cancelado.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="margin: 0 0 10px 0; color: #dc3545;">📋 Detalhes do Serviço</h3>
            <p style="margin: 5px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 5px 0;"><strong>Vendedor:</strong> ${sellerName}</p>
            <p style="margin: 5px 0;"><strong>Valor:</strong> ${vpAmount} VP</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Cancelado</p>
            ${reason ? `<p style="margin: 5px 0;"><strong>Motivo:</strong> ${reason}</p>` : ''}
          </div>
          
          <p>O valor foi devolvido para sua carteira. Você pode procurar por outros serviços similares na plataforma.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://vixter.com/vixies" style="background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Procurar Serviços
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 0 0 10px 0;">Precisa de ajuda?</p>
          <p style="margin: 0;">
            <a href="mailto:suporte@vixter.com" style="color: #8A2BE2; text-decoration: none;">suporte@vixter.com</a>
          </p>
          <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
            Este é um email automático. Não responda a esta mensagem.
          </p>
        </div>

      </div>
    </div>
  `;
}

function getServiceUpdateTemplate(serviceName, sellerName, buyerName, status, vpAmount) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">📋 Atualização do Serviço</h1>
          </div>
        </div>

        <!-- Content -->
        <div style="color: #333; line-height: 1.6;">
          <p>Olá <strong>${buyerName}</strong>,</p>
          
          <p>Houve uma atualização no status do seu serviço.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
            <h3 style="margin: 0 0 10px 0; color: #6c757d;">📋 Detalhes do Serviço</h3>
            <p style="margin: 5px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 5px 0;"><strong>Vendedor:</strong> ${sellerName}</p>
            <p style="margin: 5px 0;"><strong>Valor:</strong> ${vpAmount} VP</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${status}</p>
          </div>
          
          <p>Acesse o Vixter para mais detalhes sobre a atualização.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://vixter.com/my-purchases" style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
              Ver Minhas Compras
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 0 0 10px 0;">Precisa de ajuda?</p>
          <p style="margin: 0;">
            <a href="mailto:suporte@vixter.com" style="color: #8A2BE2; text-decoration: none;">suporte@vixter.com</a>
          </p>
          <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
            Este é um email automático. Não responda a esta mensagem.
          </p>
        </div>

      </div>
    </div>
  `;
}

*/

logger.info('✅ Email functions loaded - Service notification templates ready');
