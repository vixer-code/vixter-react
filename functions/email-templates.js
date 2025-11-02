// email-templates.js - Templates de Email para SendGrid Vixter

// Get frontend URL from environment or use default
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://vixter.com.br';

/**
 * Template base para todos os emails da Vixter
 * @param {string} title - Título do email
 * @param {string} content - Conteúdo principal do email
 * @param {string} actionText - Texto do botão de ação (opcional)
 * @param {string} actionUrl - URL do botão de ação (opcional)
 * @param {string} footerText - Texto adicional no rodapé (opcional)
 * @returns {string} HTML do email
 */
function getBaseTemplate(title, content, actionText = null, actionUrl = null, footerText = null) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${title} - Vixter</title>
      <style>
        /* Reset styles */
        body, table, td, p, a, li, blockquote {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        table, td {
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }
        img {
          -ms-interpolation-mode: bicubic;
          border: 0;
          height: auto;
          line-height: 100%;
          outline: none;
          text-decoration: none;
        }
        
        /* Main styles */
        body {
          margin: 0 !important;
          padding: 0 !important;
          background-color: #0F0F1A;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 100%);
        }
        
        .header {
          background: linear-gradient(135deg, #8A2BE2 0%, #00FFCA 100%);
          padding: 30px 20px;
          text-align: center;
          border-radius: 16px 16px 0 0;
        }
        
        .header h1 {
          margin: 0;
          color: white;
          font-size: 28px;
          font-weight: 700;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .content {
          background: rgba(255, 255, 255, 0.05);
          padding: 40px 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }
        
        .content h2 {
          color: #FFFFFF;
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 20px 0;
          background: linear-gradient(135deg, #8A2BE2 0%, #00FFCA 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .content p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 20px 0;
        }
        
        .info-box {
          background: rgba(138, 43, 226, 0.1);
          border: 1px solid rgba(138, 43, 226, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .info-box h3 {
          color: #8A2BE2;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 15px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .info-box p {
          color: rgba(255, 255, 255, 0.8);
          margin: 8px 0;
        }
        
        .highlight-box {
          background: rgba(0, 255, 202, 0.1);
          border: 1px solid rgba(0, 255, 202, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .highlight-box h3 {
          color: #00FFCA;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 15px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #8A2BE2 0%, #00FFCA 100%);
          color: white !important;
          text-decoration: none;
          padding: 15px 30px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 16px;
          text-align: center;
          margin: 25px 0;
          box-shadow: 0 4px 15px rgba(138, 43, 226, 0.3);
          transition: all 0.3s ease;
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(138, 43, 226, 0.4);
        }
        
        .footer {
          background: rgba(255, 255, 255, 0.05);
          padding: 30px;
          text-align: center;
          border-radius: 0 0 16px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .footer p {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          margin: 5px 0;
        }
        
        .footer a {
          color: #00FFCA;
          text-decoration: none;
        }
        
        .footer a:hover {
          text-decoration: underline;
        }
        
        .logo {
          width: 60px;
          height: 60px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
          margin-bottom: 15px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-open { background: rgba(59, 130, 246, 0.2); color: #3B82F6; }
        .status-progress { background: rgba(139, 92, 246, 0.2); color: #8B5CF6; }
        .status-resolved { background: rgba(16, 185, 129, 0.2); color: #10B981; }
        .status-closed { background: rgba(107, 114, 128, 0.2); color: #6B7280; }
        
        .priority-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 15px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .priority-low { background: rgba(16, 185, 129, 0.2); color: #10B981; }
        .priority-medium { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
        .priority-high { background: rgba(239, 68, 68, 0.2); color: #EF4444; }
        .priority-urgent { background: rgba(220, 38, 38, 0.2); color: #DC2626; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
          }
          .content {
            padding: 30px 20px !important;
          }
          .header {
            padding: 25px 15px !important;
          }
          .header h1 {
            font-size: 24px !important;
          }
          .cta-button {
            display: block !important;
            text-align: center !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="header">
          <div class="logo">🎫</div>
          <h1>${title}</h1>
        </div>
        
        <!-- Content -->
        <div class="content">
          ${content}
          
          ${actionText && actionUrl ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" class="cta-button">${actionText}</a>
            </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p><strong>Vixter - Sua Plataforma de Conteúdo Digital</strong></p>
          <p>Precisa de ajuda? Entre em contato conosco:</p>
          <p><a href="mailto:contato@vixter.com.br">contato@vixter.com.br</a></p>
          ${footerText ? `<p style="margin-top: 20px; font-size: 12px; color: rgba(255, 255, 255, 0.4);">${footerText}</p>` : ''}
          <p style="margin-top: 20px; font-size: 12px; color: rgba(255, 255, 255, 0.4);">
            Este é um email automático. Para responder a este ticket, simplesmente responda este email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template para confirmação de ticket criado
 */
export function getTicketCreatedTemplate(ticketData) {
  const content = `
    <h2>🎫 Ticket de Suporte Criado!</h2>
    <p>Olá <strong>${ticketData.userName}</strong>,</p>
    <p>Seu ticket de suporte foi criado com sucesso! Nossa equipe analisará seu problema e responderá em breve.</p>
    
    <div class="info-box">
      <h3>📋 Detalhes do Ticket</h3>
      <p><strong>ID do Ticket:</strong> ${ticketData.ticketId}</p>
      <p><strong>Assunto:</strong> ${ticketData.subject}</p>
      <p><strong>Categoria:</strong> ${getCategoryDisplayName(ticketData.category)}</p>
      <p><strong>Prioridade:</strong> <span class="priority-badge priority-${ticketData.priority}">${getPriorityDisplayName(ticketData.priority)}</span></p>
      <p><strong>Status:</strong> <span class="status-badge status-open">Aberto</span></p>
      <p><strong>Criado em:</strong> ${new Date(ticketData.createdAt).toLocaleString('pt-BR')}</p>
    </div>
    
    <div class="highlight-box">
      <h3>💬 Sua Mensagem</h3>
      <p style="white-space: pre-wrap; margin: 0;">${ticketData.description}</p>
    </div>
    
    <div class="info-box">
      <h3>📧 Como Responder</h3>
      <p>Para responder a este ticket, simplesmente responda este email. Sua resposta será automaticamente adicionada ao ticket.</p>
      <p><strong>Importante:</strong> Não altere o assunto do email para manter o rastreamento do ticket.</p>
    </div>
  `;

  return getBaseTemplate(
    'Ticket de Suporte Criado',
    content,
    'Acessar Central de Suporte',
    `${FRONTEND_URL}/support`,
    'Tempo de resposta: até 24 horas em dias úteis'
  );
}

/**
 * Template para notificação de novo ticket (admin)
 */
export function getAdminNotificationTemplate(ticketData) {
  const content = `
    <h2>🚨 Novo Ticket de Suporte</h2>
    <p>Um novo ticket de suporte foi criado na plataforma Vixter.</p>
    
    <div class="info-box">
      <h3>📋 Detalhes do Ticket</h3>
      <p><strong>ID do Ticket:</strong> ${ticketData.ticketId}</p>
      <p><strong>Usuário:</strong> ${ticketData.userName} (${ticketData.userEmail})</p>
      <p><strong>Assunto:</strong> ${ticketData.subject}</p>
      <p><strong>Categoria:</strong> ${getCategoryDisplayName(ticketData.category)}</p>
      <p><strong>Prioridade:</strong> <span class="priority-badge priority-${ticketData.priority}">${getPriorityDisplayName(ticketData.priority)}</span></p>
      <p><strong>Criado em:</strong> ${new Date(ticketData.createdAt).toLocaleString('pt-BR')}</p>
    </div>
    
    <div class="highlight-box">
      <h3>💬 Mensagem do Usuário</h3>
      <p style="white-space: pre-wrap; margin: 0;">${ticketData.description}</p>
    </div>
    
    <div class="info-box">
      <h3>📧 Como Responder</h3>
      <p>Para responder ao ticket, envie um email para: <strong>${ticketData.userEmail}</strong></p>
      <p><strong>Assunto:</strong> Re: [${ticketData.ticketId}] ${ticketData.subject}</p>
    </div>
  `;

  return getBaseTemplate(
    'Novo Ticket de Suporte',
    content,
    'Responder ao Ticket',
    `mailto:${ticketData.userEmail}?subject=Re: [${ticketData.ticketId}] ${ticketData.subject}`,
    'Responda em até 24 horas para manter SLA'
  );
}

/**
 * Template para atualização de status do ticket
 */
export function getTicketStatusUpdateTemplate(ticketData, newStatus, adminMessage = '') {
  const content = `
    <h2>📋 Status do Ticket Atualizado</h2>
    <p>Olá <strong>${ticketData.userName}</strong>,</p>
    <p>O status do seu ticket foi atualizado pela nossa equipe de suporte.</p>
    
    <div class="info-box">
      <h3>📋 Detalhes do Ticket</h3>
      <p><strong>ID do Ticket:</strong> ${ticketData.ticketId}</p>
      <p><strong>Assunto:</strong> ${ticketData.subject}</p>
      <p><strong>Novo Status:</strong> <span class="status-badge status-${newStatus}">${getStatusDisplayName(newStatus)}</span></p>
      <p><strong>Atualizado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    ${adminMessage ? `
      <div class="highlight-box">
        <h3>💬 Mensagem da Equipe</h3>
        <p style="white-space: pre-wrap; margin: 0;">${adminMessage}</p>
      </div>
    ` : ''}
    
    <div class="info-box">
      <h3>📧 Próximos Passos</h3>
      <p>${getStatusInstructions(newStatus)}</p>
    </div>
  `;

  return getBaseTemplate(
    'Status do Ticket Atualizado',
    content,
    'Ver Ticket',
    `${FRONTEND_URL}/support`,
    'Para responder, simplesmente responda este email'
  );
}

/**
 * Template para resposta do admin
 */
export function getAdminResponseTemplate(ticketData, adminMessage, adminName = 'Equipe Vixter') {
  const content = `
    <h2>💬 Resposta da Equipe de Suporte</h2>
    <p>Olá <strong>${ticketData.userName}</strong>,</p>
    <p>Recebemos sua mensagem e nossa equipe respondeu ao seu ticket.</p>
    
    <div class="info-box">
      <h3>📋 Detalhes do Ticket</h3>
      <p><strong>ID do Ticket:</strong> ${ticketData.ticketId}</p>
      <p><strong>Assunto:</strong> ${ticketData.subject}</p>
      <p><strong>Status:</strong> <span class="status-badge status-${ticketData.status}">${getStatusDisplayName(ticketData.status)}</span></p>
      <p><strong>Respondido por:</strong> ${adminName}</p>
      <p><strong>Data da Resposta:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    <div class="highlight-box">
      <h3>💬 Resposta da Equipe</h3>
      <p style="white-space: pre-wrap; margin: 0;">${adminMessage}</p>
    </div>
    
    <div class="info-box">
      <h3>📧 Como Continuar</h3>
      <p>Se você precisar de mais informações ou tiver outras dúvidas, simplesmente responda este email.</p>
      <p>Nossa equipe continuará acompanhando este ticket até que seja resolvido.</p>
    </div>
  `;

  return getBaseTemplate(
    'Resposta da Equipe de Suporte',
    content,
    'Ver Ticket',
    `${FRONTEND_URL}/support`,
    'Para continuar a conversa, responda este email'
  );
}

/**
 * Template para ticket resolvido
 */
export function getTicketResolvedTemplate(ticketData, resolutionMessage = '') {
  const content = `
    <h2>✅ Ticket Resolvido!</h2>
    <p>Olá <strong>${ticketData.userName}</strong>,</p>
    <p>Ótimas notícias! Seu ticket foi resolvido pela nossa equipe de suporte.</p>
    
    <div class="info-box">
      <h3>📋 Detalhes do Ticket</h3>
      <p><strong>ID do Ticket:</strong> ${ticketData.ticketId}</p>
      <p><strong>Assunto:</strong> ${ticketData.subject}</p>
      <p><strong>Status:</strong> <span class="status-badge status-resolved">Resolvido</span></p>
      <p><strong>Resolvido em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    ${resolutionMessage ? `
      <div class="highlight-box">
        <h3>💬 Solução Aplicada</h3>
        <p style="white-space: pre-wrap; margin: 0;">${resolutionMessage}</p>
      </div>
    ` : ''}
    
    <div class="info-box">
      <h3>📊 Avaliação do Atendimento</h3>
      <p>Gostaríamos de saber como foi sua experiência com nosso suporte. Sua opinião é muito importante para nós!</p>
    </div>
    
    <div class="info-box">
      <h3>🔄 Reabrir Ticket</h3>
      <p>Se você ainda tiver problemas relacionados a este ticket, pode reabri-lo respondendo este email.</p>
    </div>
  `;

  return getBaseTemplate(
    'Ticket Resolvido',
    content,
    'Avaliar Atendimento',
    `${FRONTEND_URL}/support`,
    'Este ticket foi marcado como resolvido'
  );
}

/**
 * Template para ticket fechado
 */
export function getTicketClosedTemplate(ticketData, closeReason = '') {
  const content = `
    <h2>🔒 Ticket Fechado</h2>
    <p>Olá <strong>${ticketData.userName}</strong>,</p>
    <p>Seu ticket foi fechado pela nossa equipe de suporte.</p>
    
    <div class="info-box">
      <h3>📋 Detalhes do Ticket</h3>
      <p><strong>ID do Ticket:</strong> ${ticketData.ticketId}</p>
      <p><strong>Assunto:</strong> ${ticketData.subject}</p>
      <p><strong>Status:</strong> <span class="status-badge status-closed">Fechado</span></p>
      <p><strong>Fechado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    ${closeReason ? `
      <div class="highlight-box">
        <h3>📝 Motivo do Fechamento</h3>
        <p style="white-space: pre-wrap; margin: 0;">${closeReason}</p>
      </div>
    ` : ''}
    
    <div class="info-box">
      <h3>🔄 Reabrir Ticket</h3>
      <p>Se você ainda precisar de ajuda com este assunto, pode reabrir o ticket respondendo este email.</p>
    </div>
    
    <div class="info-box">
      <h3>📞 Outros Canais de Suporte</h3>
      <p>Para outras questões, você pode:</p>
      <p>• Criar um novo ticket em nossa central de suporte</p>
      <p>• Entrar em contato via email: contato@vixter.com.br</p>
    </div>
  `;

  return getBaseTemplate(
    'Ticket Fechado',
    content,
    'Criar Novo Ticket',
    `${FRONTEND_URL}/support`,
    'Este ticket foi fechado'
  );
}

// Helper functions
function getCategoryDisplayName(category) {
  const categories = {
    'payment': 'Pagamentos',
    'technical': 'Problemas Técnicos',
    'account': 'Conta e Perfil',
    'content': 'Conteúdo e Packs',
    'services': 'Serviços',
    'other': 'Outros'
  };
  return categories[category] || 'Outros';
}

function getPriorityDisplayName(priority) {
  const priorities = {
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'urgent': 'Urgente'
  };
  return priorities[priority] || 'Média';
}

function getStatusDisplayName(status) {
  const statuses = {
    'open': 'Aberto',
    'in_progress': 'Em Andamento',
    'waiting_user': 'Aguardando Usuário',
    'resolved': 'Resolvido',
    'closed': 'Fechado'
  };
  return statuses[status] || 'Aberto';
}

function getStatusInstructions(status) {
  const instructions = {
    'open': 'Seu ticket foi recebido e está sendo analisado por nossa equipe.',
    'in_progress': 'Nossa equipe está trabalhando na solução do seu problema.',
    'waiting_user': 'Aguardamos sua resposta para continuar com o atendimento.',
    'resolved': 'Seu problema foi resolvido! Se precisar de mais ajuda, responda este email.',
    'closed': 'Este ticket foi fechado. Para reabrir, responda este email.'
  };
  return instructions[status] || 'Seu ticket está sendo processado.';
}

export default {
  getTicketCreatedTemplate,
  getAdminNotificationTemplate,
  getTicketStatusUpdateTemplate,
  getAdminResponseTemplate,
  getTicketResolvedTemplate,
  getTicketClosedTemplate
};
