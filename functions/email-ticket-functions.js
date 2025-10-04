// email-ticket-functions.js - Sistema de Tickets via Email Vixter

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions";
import { defineSecret } from 'firebase-functions/params';
import {
  getTicketCreatedTemplate,
  getAdminNotificationTemplate,
  getTicketStatusUpdateTemplate,
  getAdminResponseTemplate,
  getTicketResolvedTemplate,
  getTicketClosedTemplate
} from './email-templates.js';

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

// Helper function to check if user is admin
function isAdmin(uid) {
  return ADMIN_UIDS.includes(uid);
}

// Generate unique ticket ID
function generateTicketId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  return `TKT-${timestamp}-${random}`.toUpperCase();
}

// Templates moved to email-templates.js

// Templates moved to email-templates.js

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

// Create support ticket
export const createSupportTicket = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: [SENDGRID_API_KEY, SUPPORT_EMAIL]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { subject, description, category, priority } = request.data;
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
    const userEmailHtml = getTicketCreatedTemplate(ticketData);
    await sendEmail(
      userEmail,
      `[${ticketId}] Ticket de Suporte Criado - ${subject}`,
      userEmailHtml,
      userEmail
    );

    // Send notification email to admins
    const adminEmailHtml = getAdminNotificationTemplate(ticketData);
    await sendEmail(
      SUPPORT_EMAIL.value(),
      `[${ticketId}] Novo Ticket de Suporte - ${subject}`,
      adminEmailHtml,
      userEmail
    );

    logger.info(`Support ticket created: ${ticketId} for user ${userId}`);
    
    return {
      success: true,
      ticketId,
      message: "Ticket criado com sucesso. Você receberá um email de confirmação em breve."
    };

  } catch (error) {
    logger.error('Error creating support ticket:', error);
    throw new HttpsError("internal", "Failed to create support ticket");
  }
});

// Get user tickets
export const getUserTickets = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = request.auth.uid;

  try {
    const ticketsRef = firestore.collection('supportTickets');
    const q = ticketsRef.where('userId', '==', userId).orderBy('createdAt', 'desc');
    const snapshot = await q.get();

    const tickets = [];
    snapshot.forEach(doc => {
      tickets.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      tickets
    };

  } catch (error) {
    logger.error('Error getting user tickets:', error);
    throw new HttpsError("internal", "Failed to get user tickets");
  }
});

// Get ticket by ID
export const getTicketById = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { ticketId } = request.data;
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

    // Check if user owns the ticket or is admin
    if (ticketData.userId !== userId && !isAdmin(userId)) {
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
});

// Update ticket status (admin only)
export const updateTicketStatus = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth || !isAdmin(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const { ticketId, status, adminMessage } = request.data;

  if (!ticketId || !status) {
    throw new HttpsError("invalid-argument", "Ticket ID and status are required");
  }

  try {
    const ticketRef = firestore.collection('supportTickets').doc(ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      throw new HttpsError("not-found", "Ticket not found");
    }

    const ticketData = ticketSnap.data();
    const updatedAt = Date.now();

    // Update ticket
    await ticketRef.update({
      status,
      updatedAt,
      lastMessageAt: updatedAt,
      messageCount: admin.firestore.FieldValue.increment(1)
    });

    // Send status update email to user
    const statusUpdateHtml = getTicketStatusUpdateTemplate(ticketData, status, adminMessage);
    await sendEmail(
      ticketData.userEmail,
      `[${ticketData.ticketId}] Status Atualizado - ${ticketData.subject}`,
      statusUpdateHtml
    );

    logger.info(`Ticket ${ticketId} status updated to ${status}`);
    
    return {
      success: true,
      message: "Ticket status updated successfully"
    };

  } catch (error) {
    logger.error('Error updating ticket status:', error);
    throw new HttpsError("internal", "Failed to update ticket status");
  }
});

// Trigger: New ticket created
export const onTicketCreated = onDocumentCreated({
  document: "supportTickets/{ticketId}",
  region: "us-east1"
}, async (event) => {
  const ticketData = event.data.data();
  const ticketId = event.params.ticketId;

  try {
    logger.info(`New support ticket created: ${ticketId} for user ${ticketData.userId}`);
    
    // You can add additional processing here, such as:
    // - Auto-assignment to available admins
    // - Integration with external ticketing systems
    // - Slack/Discord notifications
    
  } catch (error) {
    logger.error('Error processing new ticket:', error);
  }
});

// Unified API function
export const api = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
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
            result = await createSupportTicket(request);
            break;
          case 'getUserTickets':
            result = await getUserTickets(request);
            break;
          case 'getById':
            result = await getTicketById(request);
            break;
          case 'updateStatus':
            result = await updateTicketStatus(request);
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
