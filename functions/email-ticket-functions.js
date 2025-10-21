// email-ticket-functions-simple.js - Sistema de Tickets Simplificado Vixter

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { defineSecret } from 'firebase-functions/params';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Configurações globais
setGlobalOptions({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60,
});

// Email service secrets
const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');
const SUPPORT_EMAIL = defineSecret('SUPPORT_EMAIL');


// Generate unique ticket ID
function generateTicketId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  return `TKT-${timestamp}-${random}`.toUpperCase();
}

// Send email using SendGrid
async function sendEmail(to, subject, html, replyTo = null) {
  try {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(SENDGRID_API_KEY.value());
    
    const msg = {
      to,
      from: SUPPORT_EMAIL.value(),
      subject,
      html,
      replyTo: replyTo || SUPPORT_EMAIL.value()
    };
    
    await sgMail.default.send(msg);
    logger.info(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error('Error sending email:', error);
    return false;
  }
}

// Internal function to create support ticket (without onCall wrapper)
async function createSupportTicketInternal(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { payload } = request.data;
  const { subject, description, category, priority } = payload;
  const userId = request.auth.uid;
  const userEmail = request.auth.token.email;
  const userName = request.auth.token.name || 'Usuário';

  if (!subject || !description || !category) {
    throw new HttpsError("invalid-argument", "Subject, description and category are required");
  }

  try {
    const ticketId = generateTicketId();
    const createdAt = Date.now();

    // Create ticket document
    const ticketData = {
      ticketId,
      userId,
      userEmail,
      userName,
      subject,
      description,
      category,
      priority: priority || 'medium',
      status: 'open',
      createdAt,
      updatedAt: createdAt,
      messageCount: 1,
      lastMessageAt: createdAt
    };

    // Save to Firestore
    const ticketRef = firestore.collection('supportTickets').doc(ticketId);
    await ticketRef.set(ticketData);

    // Send confirmation email to user
    try {
      const userEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8A2BE2;">Ticket de Suporte Criado</h2>
          <p>Olá ${userName},</p>
          <p>Seu ticket de suporte foi criado com sucesso!</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>ID do Ticket:</strong> ${ticketId}</p>
            <p><strong>Assunto:</strong> ${subject}</p>
            <p><strong>Categoria:</strong> ${category}</p>
            <p><strong>Prioridade:</strong> ${priority}</p>
            <p><strong>Status:</strong> Aberto</p>
          </div>
          <p>Nossa equipe entrará em contato em breve.</p>
          <p>Atenciosamente,<br>Equipe Vixter</p>
        </div>
      `;
      
      await sendEmail(
        userEmail,
        `[${ticketId}] Ticket de Suporte Criado - ${subject}`,
        userEmailHtml,
        userEmail
      );
    } catch (emailError) {
      logger.warn('Failed to send user confirmation email:', emailError);
    }

    // Send notification email to admins (using Gmail directly)
    try {
      const adminEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF4444;">Novo Ticket de Suporte</h2>
          <p>Um novo ticket de suporte foi criado:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>ID do Ticket:</strong> ${ticketId}</p>
            <p><strong>Usuário:</strong> ${userName} (${userEmail})</p>
            <p><strong>Assunto:</strong> ${subject}</p>
            <p><strong>Categoria:</strong> ${category}</p>
            <p><strong>Prioridade:</strong> ${priority}</p>
            <p><strong>Descrição:</strong></p>
            <div style="background: white; padding: 10px; border-left: 3px solid #8A2BE2;">
              ${description.replace(/\n/g, '<br>')}
            </div>
          </div>
          <p>Por favor, acesse o painel administrativo para responder ao ticket.</p>
        </div>
      `;
      
      await sendEmail(
        'vixterwebser@gmail.com', // Usar Gmail diretamente
        `[${ticketId}] Novo Ticket de Suporte - ${subject}`,
        adminEmailHtml,
        userEmail
      );
    } catch (emailError) {
      logger.warn('Failed to send admin notification email:', emailError);
    }

    logger.info(`Support ticket created: ${ticketId} for user ${userId}`);
    
    return {
      success: true,
      ticketId,
      message: "Ticket criado com sucesso!"
    };

  } catch (error) {
    logger.error('Error creating support ticket:', error);
    throw new HttpsError("internal", "Failed to create support ticket");
  }
}

// Internal function to get user tickets (without onCall wrapper)
async function getUserTicketsInternal(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = request.auth.uid;

  try {
    const ticketsRef = firestore.collection('supportTickets');
    // Try without orderBy first to avoid index issues
    const q = ticketsRef.where('userId', '==', userId);
    const snapshot = await q.get();

    const tickets = [];
    snapshot.forEach(doc => {
      tickets.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by createdAt descending
    tickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    logger.info(`Retrieved ${tickets.length} tickets for user ${userId}`);
    
    return {
      success: true,
      tickets
    };

  } catch (error) {
    logger.error('Error getting user tickets:', error);
    throw new HttpsError("internal", "Failed to get user tickets");
  }
}


// Internal function to get ticket by ID (without onCall wrapper)
async function getTicketByIdInternal(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { payload } = request.data;
  const { ticketId } = payload;
  const userId = request.auth.uid;

  if (!ticketId) {
    throw new HttpsError("invalid-argument", "Ticket ID is required");
  }

  try {
    const ticketRef = firestore.collection('supportTickets').doc(ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      throw new HttpsError("not-found", "Ticket not found");
    }

    const ticketData = ticketSnap.data();

    // Check if user owns the ticket
    if (ticketData.userId !== userId) {
      throw new HttpsError("permission-denied", "Access denied");
    }

    return {
      success: true,
      ticket: {
        id: ticketSnap.id,
        ...ticketData
      }
    };

  } catch (error) {
    logger.error('Error getting ticket:', error);
    throw new HttpsError("internal", "Failed to get ticket");
  }
}

// Unified API function
export const api = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: [SENDGRID_API_KEY, SUPPORT_EMAIL]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { resource, action, payload } = request.data;
  const userId = request.auth.uid;

  logger.info(`Support API Call: ${resource}/${action}`, { userId });

  try {
    let result;
    
    switch (resource) {
      case 'supportTicket':
        switch (action) {
          case 'create':
            result = await createSupportTicketInternal(request);
            break;
          case 'getUserTickets':
            result = await getUserTicketsInternal(request);
            break;
          case 'getById':
            result = await getTicketByIdInternal(request);
            break;
          default:
            throw new HttpsError("invalid-argument", "Invalid action");
        }
        break;
      default:
        throw new HttpsError("invalid-argument", "Invalid resource");
    }

    return result;
  } catch (error) {
    logger.error(`Support API Error: ${resource}/${action}`, error);
    throw error;
  }
});
