// support-functions.js - Sistema de Tickets de Suporte Vixter

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const database = admin.database();

// Configurações globais
setGlobalOptions({
  region: "us-central1",
  cpu: 0.5,
  maxInstances: 2,
  concurrency: 1,
});

// Admin UIDs - Replace with actual admin UIDs
const ADMIN_UIDS = ['admin_uid_1', 'admin_uid_2'];

// Helper function to check if user is admin
function isAdmin(uid) {
  return ADMIN_UIDS.includes(uid);
}

// Helper function to send notification
async function sendNotification(recipientId, notificationData) {
  try {
    const notificationRef = database.ref(`notifications/${recipientId}`).push();
    await notificationRef.set({
      ...notificationData,
      timestamp: Date.now(),
      read: false
    });
    return true;
  } catch (error) {
    logger.error('Error sending notification:', error);
    return false;
  }
}

// Send ticket notification
export const sendTicketNotification = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { ticketId, type, data } = request.data;
  const userId = request.auth.uid;

  if (!ticketId || !type) {
    throw new HttpsError("invalid-argument", "ticketId and type are required");
  }

  try {
    // Get ticket data
    const ticketRef = firestore.collection('supportTickets').doc(ticketId);
    const ticketSnap = await ticketRef.get();
    
    if (!ticketSnap.exists) {
      throw new HttpsError("not-found", "Ticket not found");
    }

    const ticketData = ticketSnap.data();
    let notificationData = {};

    switch (type) {
      case 'new_ticket':
        // Notify all admins about new ticket
        notificationData = {
          type: 'new_support_ticket',
          title: 'Novo Ticket de Suporte',
          message: `Novo ticket: ${ticketData.subject}`,
          ticketId: ticketId,
          priority: ticketData.priority,
          category: ticketData.category
        };

        // Send to all admins
        for (const adminId of ADMIN_UIDS) {
          await sendNotification(adminId, notificationData);
        }
        break;

      case 'status_update':
        // Notify user about status update
        notificationData = {
          type: 'ticket_status_update',
          title: 'Status do Ticket Atualizado',
          message: `Seu ticket "${ticketData.subject}" foi atualizado para: ${data.status}`,
          ticketId: ticketId,
          newStatus: data.status
        };

        await sendNotification(ticketData.userId, notificationData);
        break;

      case 'new_message':
        // Notify about new message
        const recipientId = isAdmin(userId) ? ticketData.userId : 'admin';
        
        notificationData = {
          type: 'new_ticket_message',
          title: 'Nova Mensagem no Ticket',
          message: `Nova mensagem no ticket: ${ticketData.subject}`,
          ticketId: ticketId,
          isInternal: data.isInternal || false
        };

        if (recipientId === 'admin') {
          // Send to all admins
          for (const adminId of ADMIN_UIDS) {
            await sendNotification(adminId, notificationData);
          }
        } else {
          await sendNotification(recipientId, notificationData);
        }
        break;

      case 'ticket_assigned':
        // Notify assigned admin
        notificationData = {
          type: 'ticket_assigned',
          title: 'Ticket Atribuído',
          message: `Ticket "${ticketData.subject}" foi atribuído a você`,
          ticketId: ticketId,
          priority: ticketData.priority
        };

        await sendNotification(data.assignedTo, notificationData);
        break;

      default:
        throw new HttpsError("invalid-argument", "Invalid notification type");
    }

    logger.info(`Ticket notification sent: ${type} for ticket ${ticketId}`);
    return { success: true };

  } catch (error) {
    logger.error('Error sending ticket notification:', error);
    throw new HttpsError("internal", "Failed to send notification");
  }
});

// Get ticket statistics (admin only)
export const getTicketStats = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth || !isAdmin(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  try {
    const ticketsRef = firestore.collection('supportTickets');
    
    // Get all tickets
    const ticketsSnap = await ticketsRef.get();
    const tickets = [];
    
    ticketsSnap.forEach(doc => {
      tickets.push({ id: doc.id, ...doc.data() });
    });

    // Calculate statistics
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      byPriority: {
        low: tickets.filter(t => t.priority === 'low').length,
        medium: tickets.filter(t => t.priority === 'medium').length,
        high: tickets.filter(t => t.priority === 'high').length,
        urgent: tickets.filter(t => t.priority === 'urgent').length
      },
      byCategory: {
        payment: tickets.filter(t => t.category === 'payment').length,
        technical: tickets.filter(t => t.category === 'technical').length,
        account: tickets.filter(t => t.category === 'account').length,
        content: tickets.filter(t => t.category === 'content').length,
        other: tickets.filter(t => t.category === 'other').length
      },
      avgResponseTime: 0, // Calculate based on timestamps
      avgResolutionTime: 0 // Calculate based on timestamps
    };

    return { success: true, stats };

  } catch (error) {
    logger.error('Error getting ticket stats:', error);
    throw new HttpsError("internal", "Failed to get ticket statistics");
  }
});

// Auto-assign tickets based on category and workload
export const autoAssignTicket = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth || !isAdmin(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const { ticketId } = request.data;

  if (!ticketId) {
    throw new HttpsError("invalid-argument", "ticketId is required");
  }

  try {
    // Get ticket
    const ticketRef = firestore.collection('supportTickets').doc(ticketId);
    const ticketSnap = await ticketRef.get();
    
    if (!ticketSnap.exists) {
      throw new HttpsError("not-found", "Ticket not found");
    }

    const ticketData = ticketSnap.data();

    // Simple auto-assignment logic (can be enhanced)
    // For now, assign to first available admin
    const assignedAdmin = ADMIN_UIDS[0];

    // Update ticket
    await ticketRef.update({
      assignedTo: assignedAdmin,
      status: 'in_progress',
      timestamps: {
        ...ticketData.timestamps,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    // Send notification
    await sendNotification(assignedAdmin, {
      type: 'ticket_assigned',
      title: 'Ticket Atribuído Automaticamente',
      message: `Ticket "${ticketData.subject}" foi atribuído a você automaticamente`,
      ticketId: ticketId,
      priority: ticketData.priority
    });

    logger.info(`Ticket ${ticketId} auto-assigned to ${assignedAdmin}`);
    return { success: true, assignedTo: assignedAdmin };

  } catch (error) {
    logger.error('Error auto-assigning ticket:', error);
    throw new HttpsError("internal", "Failed to auto-assign ticket");
  }
});

// Trigger: New ticket created
export const onTicketCreated = onDocumentCreated({
  document: "supportTickets/{ticketId}",
  region: "us-central1"
}, async (event) => {
  const ticketData = event.data.data();
  const ticketId = event.params.ticketId;

  try {
    // Auto-assign if no admin is assigned
    if (!ticketData.assignedTo) {
      const assignedAdmin = ADMIN_UIDS[0]; // Simple assignment
      
      await event.data.ref.update({
        assignedTo: assignedAdmin,
        status: 'in_progress',
        timestamps: {
          ...ticketData.timestamps,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      });

      // Send notification
      await sendNotification(assignedAdmin, {
        type: 'ticket_assigned',
        title: 'Novo Ticket Atribuído',
        message: `Ticket "${ticketData.subject}" foi atribuído a você`,
        ticketId: ticketId,
        priority: ticketData.priority
      });
    }

    logger.info(`New ticket created: ${ticketId}`);
  } catch (error) {
    logger.error('Error processing new ticket:', error);
  }
});

// Trigger: Ticket updated
export const onTicketUpdated = onDocumentUpdated({
  document: "supportTickets/{ticketId}",
  region: "us-central1"
}, async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const ticketId = event.params.ticketId;

  try {
    // Check if status changed
    if (beforeData.status !== afterData.status) {
      // Send notification to user
      await sendNotification(afterData.userId, {
        type: 'ticket_status_update',
        title: 'Status do Ticket Atualizado',
        message: `Seu ticket "${afterData.subject}" foi atualizado para: ${afterData.status}`,
        ticketId: ticketId,
        newStatus: afterData.status
      });
    }

    // Check if assigned to different admin
    if (beforeData.assignedTo !== afterData.assignedTo && afterData.assignedTo) {
      await sendNotification(afterData.assignedTo, {
        type: 'ticket_assigned',
        title: 'Ticket Atribuído',
        message: `Ticket "${afterData.subject}" foi atribuído a você`,
        ticketId: ticketId,
        priority: afterData.priority
      });
    }

    logger.info(`Ticket updated: ${ticketId}`);
  } catch (error) {
    logger.error('Error processing ticket update:', error);
  }
});

// Unified API function for support tickets
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
          case 'sendNotification':
            result = await sendTicketNotification(request);
            break;
          case 'getStats':
            result = await getTicketStats(request);
            break;
          case 'autoAssign':
            result = await autoAssignTicket(request);
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
