// email-reply-webhook.js - Processamento de Réplicas de Email

import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions";
import { defineSecret } from 'firebase-functions/params';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Configurações globais
setGlobalOptions({
  region: "us-east1",
  memory: "256MiB",
  timeoutSeconds: 60,
});

// Email service secrets
const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');
const SUPPORT_EMAIL = defineSecret('SUPPORT_EMAIL');

// Admin UIDs
const ADMIN_UIDS = ['admin_uid_1', 'admin_uid_2'];

/**
 * Extrai o ID do ticket do assunto do email
 * @param {string} subject - Assunto do email
 * @returns {string|null} - ID do ticket ou null
 */
function extractTicketIdFromSubject(subject) {
  // Padrões possíveis:
  // [TKT-1703123456-ABC12] Ticket de Suporte Criado - Problema
  // Re: [TKT-1703123456-ABC12] Problema com pagamento
  // Fwd: [TKT-1703123456-ABC12] Problema com pagamento
  
  const patterns = [
    /\[(TKT-\d+-\w+)\]/i,           // [TKT-123456-ABC12]
    /Re:\s*\[(TKT-\d+-\w+)\]/i,     // Re: [TKT-123456-ABC12]
    /Fwd:\s*\[(TKT-\d+-\w+)\]/i,    // Fwd: [TKT-123456-ABC12]
    /(TKT-\d+-\w+)/i                 // TKT-123456-ABC12 (sem colchetes)
  ];
  
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

/**
 * Extrai o conteúdo da mensagem do email
 * @param {string} emailBody - Corpo do email
 * @returns {string} - Conteúdo limpo da mensagem
 */
function extractMessageContent(emailBody) {
  // Remove headers de email comuns
  const lines = emailBody.split('\n');
  const contentLines = [];
  let inContent = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Pular headers comuns
    if (trimmedLine.startsWith('From:') || 
        trimmedLine.startsWith('To:') || 
        trimmedLine.startsWith('Subject:') ||
        trimmedLine.startsWith('Date:') ||
        trimmedLine.startsWith('Sent:') ||
        trimmedLine.startsWith('-----Original Message-----') ||
        trimmedLine.startsWith('On ') && trimmedLine.includes('wrote:')) {
      continue;
    }
    
    // Se encontrou linha vazia, começou o conteúdo
    if (trimmedLine === '' && !inContent) {
      inContent = true;
      continue;
    }
    
    // Se está no conteúdo, adicionar linha
    if (inContent) {
      contentLines.push(line);
    }
  }
  
  return contentLines.join('\n').trim();
}

/**
 * Envia notificação para admin sobre nova réplica
 */
async function notifyAdminNewReply(ticketData, userMessage, userEmail) {
  try {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(SENDGRID_API_KEY.value());
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nova Réplica no Ticket - Vixter</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #0F0F1A; color: #FFFFFF;">
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 100%); padding: 20px;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; color: white;">💬 Nova Réplica no Ticket</h1>
          </div>
          
          <!-- Content -->
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 30px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1);">
            
            <p>O usuário respondeu ao ticket de suporte.</p>
            
            <div style="background: rgba(245, 158, 11, 0.1); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
              <h3 style="margin: 0 0 15px 0; color: #F59E0B; font-size: 18px;">📋 Detalhes do Ticket</h3>
              <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.9);"><strong>ID do Ticket:</strong> ${ticketData.ticketId}</p>
              <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.9);"><strong>Usuário:</strong> ${ticketData.userName} (${ticketData.userEmail})</p>
              <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.9);"><strong>Assunto:</strong> ${ticketData.subject}</p>
              <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.9);"><strong>Status:</strong> ${ticketData.status}</p>
            </div>
            
            <div style="background: rgba(0, 255, 202, 0.1); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00FFCA;">
              <h3 style="margin: 0 0 15px 0; color: #00FFCA; font-size: 18px;">💬 Nova Mensagem do Usuário</h3>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.8); white-space: pre-wrap;">${userMessage}</p>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #FFFFFF; font-size: 18px;">📧 Como Responder</h3>
              <p style="margin: 0 0 10px 0; color: rgba(255, 255, 255, 0.8);">
                Para responder ao ticket, envie um email para: <strong>${userEmail}</strong>
              </p>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">
                <strong>Assunto:</strong> Re: [${ticketData.ticketId}] ${ticketData.subject}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${userEmail}?subject=Re: [${ticketData.ticketId}] ${ticketData.subject}" 
                 style="background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                Responder ao Ticket
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <p style="color: rgba(255, 255, 255, 0.6); margin: 0 0 10px 0; font-size: 14px;">Central de Suporte Vixter</p>
            <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; margin: 15px 0 0 0;">
              Esta é uma notificação automática de nova réplica no ticket.
            </p>
          </div>
          
        </div>
      </body>
      </html>
    `;
    
    const msg = {
      to: SUPPORT_EMAIL.value(),
      from: SUPPORT_EMAIL.value(),
      subject: `[${ticketData.ticketId}] Nova Réplica - ${ticketData.subject}`,
      html: html,
      replyTo: userEmail
    };
    
    await sgMail.default.send(msg);
    logger.info(`Admin notification sent for ticket ${ticketData.ticketId}`);
    
  } catch (error) {
    logger.error('Error sending admin notification:', error);
  }
}

/**
 * Webhook do SendGrid para processar réplicas de email
 */
export const processEmailReply = onRequest({
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: [SENDGRID_API_KEY, SUPPORT_EMAIL]
}, async (req, res) => {
  try {
    // Verificar se é POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Parse do webhook do SendGrid
    const events = req.body;
    
    if (!Array.isArray(events)) {
      logger.error('Invalid webhook format:', events);
      res.status(400).json({ error: 'Invalid webhook format' });
      return;
    }

    // Processar cada evento
    for (const event of events) {
      try {
        // Verificar se é um email inbound (réplica)
        if (event.event === 'inbound' && event.email) {
          const email = event.email;
          const subject = email.subject || '';
          const fromEmail = email.from || '';
          const emailBody = email.text || email.html || '';
          
          logger.info(`Processing inbound email from ${fromEmail} with subject: ${subject}`);
          
          // Extrair ID do ticket do assunto
          const ticketId = extractTicketIdFromSubject(subject);
          
          if (!ticketId) {
            logger.warn(`No ticket ID found in subject: ${subject}`);
            continue;
          }
          
          // Buscar ticket no Firestore
          const ticketRef = firestore.collection('supportTickets').doc(ticketId);
          const ticketSnap = await ticketRef.get();
          
          if (!ticketSnap.exists) {
            logger.warn(`Ticket not found: ${ticketId}`);
            continue;
          }
          
          const ticketData = ticketSnap.data();
          
          // Verificar se o email é do usuário do ticket
          if (ticketData.userEmail !== fromEmail) {
            logger.warn(`Email from ${fromEmail} doesn't match ticket user ${ticketData.userEmail}`);
            continue;
          }
          
          // Extrair conteúdo da mensagem
          const userMessage = extractMessageContent(emailBody);
          
          if (!userMessage || userMessage.length < 10) {
            logger.warn(`Message too short or empty for ticket ${ticketId}`);
            continue;
          }
          
          // Atualizar ticket no Firestore
          const updatedAt = Date.now();
          await ticketRef.update({
            status: 'waiting_admin', // Mudar status para aguardando admin
            updatedAt: updatedAt,
            lastMessageAt: updatedAt,
            messageCount: admin.firestore.FieldValue.increment(1),
            lastUserMessage: userMessage,
            lastUserMessageAt: updatedAt
          });
          
          logger.info(`Ticket ${ticketId} updated with new user message`);
          
          // Enviar notificação para admin
          await notifyAdminNewReply(ticketData, userMessage, fromEmail);
          
          logger.info(`✅ Email reply processed successfully for ticket ${ticketId}`);
        }
      } catch (eventError) {
        logger.error('Error processing individual event:', eventError);
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Email replies processed successfully',
      processed: events.length
    });
    
  } catch (error) {
    logger.error('Error processing email reply webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Função para testar o processamento de réplicas
 */
export const testEmailReply = onRequest({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (req, res) => {
  try {
    const { ticketId, userMessage, userEmail } = req.body;
    
    if (!ticketId || !userMessage || !userEmail) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    // Buscar ticket
    const ticketRef = firestore.collection('supportTickets').doc(ticketId);
    const ticketSnap = await ticketRef.get();
    
    if (!ticketSnap.exists) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    
    const ticketData = ticketSnap.data();
    
    // Atualizar ticket
    const updatedAt = Date.now();
    await ticketRef.update({
      status: 'waiting_admin',
      updatedAt: updatedAt,
      lastMessageAt: updatedAt,
      messageCount: admin.firestore.FieldValue.increment(1),
      lastUserMessage: userMessage,
      lastUserMessageAt: updatedAt
    });
    
    // Enviar notificação para admin
    await notifyAdminNewReply(ticketData, userMessage, userEmail);
    
    res.status(200).json({ 
      success: true, 
      message: 'Test email reply processed successfully' 
    });
    
  } catch (error) {
    logger.error('Error in test email reply:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});
