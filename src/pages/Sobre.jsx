import React, { useState } from 'react';
import './Sobre.css';

const Sobre = () => {
  const [activeTab, setActiveTab] = useState('privacy');

  const tabs = [
    { id: 'privacy', label: 'Política de Privacidade', icon: 'fas fa-shield-alt' },
    { id: 'terms', label: 'Termos de Serviço', icon: 'fas fa-file-contract' },
    { id: 'about', label: 'Sobre Nós', icon: 'fas fa-info-circle' }
  ];

  return (
    <div className="sobre-container">
      <div className="sobre-header">
        <h1>Informações Legais</h1>
        <p>Conheça nossas políticas e termos de uso</p>
      </div>

      <div className="sobre-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={tab.icon}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sobre-content">
        {activeTab === 'privacy' && <PrivacyPolicy />}
        {activeTab === 'terms' && <TermsOfService />}
        {activeTab === 'about' && <AboutUs />}
      </div>
    </div>
  );
};

const PrivacyPolicy = () => (
  <div className="document-content">
    <div className="document-header">
      <h2>Política de Privacidade</h2>
      <a 
        href="/pdfs/politica-privacidade.pdf" 
        target="_blank" 
        rel="noopener noreferrer"
        className="pdf-download-btn"
      >
        <i className="fas fa-download"></i>
        Baixar PDF
      </a>
    </div>
    <p className="last-updated">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

    <section>
      <h3>1. Introdução</h3>
      <p>Esta Política de Privacidade descreve como coletamos, usamos e protegemos suas informações em nossa plataforma, que combina marketplace, rede social e múltiplas moedas virtuais (VP, VC, VBP). Certos conteúdos e serviços são destinados a adultos e exigem verificação de identidade (KYC) para garantir a segurança de menores.</p>
    </section>

    <section>
      <h3>2. Informações que Coletamos</h3>

      <h4>2.1 Informações Pessoais</h4>
      <ul>
        <li>Nome completo, endereço de e-mail e telefone</li>
        <li>Data de nascimento e documentos de identificação para KYC</li>
        <li>Perfil público (foto, biografia)</li>
        <li>Preferências e configurações da conta</li>
      </ul>

      <h4>2.2 Informações Financeiras</h4>
      <ul>
        <li>Saldo e histórico de transações de moedas virtuais (VP, VC, VBP)</li>
        <li>Informações bancárias para saques (em caso de usuário ser vendedor(a) de serviços ou pack)</li>
        <li>Histórico de compras e vendas de packs/serviços</li>
      </ul>

      <h4>2.3 Informações Técnicas</h4>
      <ul>
        <li>Endereço IP, localização aproximada</li>
        <li>Informações do dispositivo e navegador</li>
        <li>Logs de atividade e uso da plataforma</li>
        <li>Cookies e tecnologias similares</li>
      </ul>

      <h4>2.4 Informações Sensíveis (Conteúdo Adulto)</h4>
      <ul>
        <li>Identificação de usuários maiores de idade para acesso a conteúdo adulto</li>
        <li>Histórico de interação com conteúdo adulto e packs restritos</li>
        <li>Dados de verificação KYC para garantir segurança de menores</li>
      </ul>
    </section>

    <section>
      <h3>3. Como Utilizamos suas Informações</h3>
      <ul>
        <li><strong>Prestação de serviços:</strong> Facilitar comunicação, feeds, marketplace, transações de moedas virtuais</li>
        <li><strong>Segurança e prevenção de fraudes:</strong> KYC, monitoramento de transações, proteção de menores</li>
        <li><strong>Gerenciamento de conteúdo adulto:</strong> Exibição apenas para usuários verificados maiores de idade</li>
        <li><strong>Suporte ao cliente:</strong> Responder consultas e resolver problemas</li>
        <li><strong>Melhoria da plataforma:</strong> Analisar uso e desenvolver novos recursos</li>
        <li><strong>Comunicações:</strong> Notificações importantes, atualizações e promoções</li>
      </ul>
    </section>

    <section>
      <h3>4. Compartilhamento de Informações</h3>

      <h4>4.1 Prestadores de serviços</h4>
      <ul>
        <li>Stripe: Processamento de pagamentos e prevenção de fraudes</li>
        <li>Firebase: Autenticação, hospedagem de dados e backup</li>
        <li>Provedores de e-mail: Envio de comunicações</li>
        <li>Serviços de análise: Monitoramento de performance e uso</li>
      </ul>

      <h4>4.2 Terceiros legais e obrigatórios</h4>
      <ul>
        <li>Autoridades regulatórias quando exigido por lei</li>
        <li>Forças policiais em investigações criminais</li>
        <li>Prevenção de fraudes ou atividades ilegais</li>
      </ul>

      <h4>4.3 Outros usuários</h4>
      <ul>
        <li>Informações públicas do perfil</li>
        <li>Conteúdo adulto e restrito é ocultado para usuários não verificados ou menores</li>
      </ul>
    </section>

    <section>
      <h3>5. Segurança dos Dados</h3>
      <ul>
        <li>Criptografia em trânsito e repouso</li>
        <li>Controle de acesso baseado na necessidade</li>
        <li>Monitoramento 24/7 e detecção de intrusão</li>
        <li>Backups criptografados</li>
        <li>Proteção de menores por restrição de conteúdo adulto e KYC</li>
      </ul>
    </section>

    <section>
      <h3>6. Direitos dos Usuários</h3>
      <ul>
        <li>Acesso: Solicitar cópia dos dados pessoais</li>
        <li>Retificação: Corrigir informações incorretas</li>
        <li>Exclusão: Solicitar remoção de dados</li>
        <li>Portabilidade: Transferir dados para outro serviço</li>
        <li>Oposição: Opor-se ao processamento de dados</li>
        <li>Gerenciamento de preferências de privacidade e visibilidade de conteúdo adulto</li>
      </ul>
    </section>

    <section>
      <h3>7. Retenção de Dados</h3>
      <ul>
        <li>Dados financeiros: São armazenados pelo Stripe, a Vixter não armazena dados financeiros fora da nossa plataforma.</li>
        <li>Dados de perfil e KYC: O usuário se reserva no direito de revogar acesso aos dados a qualquer momento. Nós, como empresa, faremos o que estiver de acordo com as leis aplicáveis. Para KYC, mantemos os dados em nosso banco de dados por 6 meses a partir do envio de documentos.</li>
        <li>Logs e backups: conforme necessidade de segurança</li>
      </ul>
    </section>

    <section>
      <h3>8. Conteúdo Adulto e Restrições</h3>
      <ul>
        <li>Todos os packs e serviços com conteúdo adulto são visíveis apenas para usuários KYC+18</li>
        <li>Usuários menores de idade não visualizam conteúdo adulto</li>
        <li>KYC garante que usuários tenham idade legal e impede exposição de menores</li>
      </ul>
    </section>

    <section>
      <h3>9. Cookies e Tecnologias Similares</h3>
      <ul>
        <li>Manter sessões de usuário</li>
        <li>Personalizar experiência</li>
        <li>Analisar tráfego e uso da plataforma</li>
        <li>Prevenir fraudes e atividades suspeitas</li>
      </ul>
      <p>Você pode gerenciar preferências de cookies nas configurações do navegador.</p>
    </section>

    <section>
      <h3>10. Alterações nesta Política</h3>
      <p>Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas por e-mail ou através da plataforma. O uso continuado após alterações constitui aceitação da nova política.</p>
    </section>

    <section>
      <h3>11. Contato para questões de privacidade e proteção de dados</h3>
      <ul>
        <li><strong>E-mail:</strong> contato@vixter.com.br</li>
      </ul>
    </section>
  </div>
);

const TermsOfService = () => (
  <div className="document-content">
    <div className="document-header">
      <h2>Termos de Serviço</h2>
      <a 
        href="/pdfs/termos-servico.pdf" 
        target="_blank" 
        rel="noopener noreferrer"
        className="pdf-download-btn"
      >
        <i className="fas fa-download"></i>
        Baixar PDF
      </a>
    </div>
    <p className="last-updated">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

    <section>
      <h3>1. Aceitação dos Termos</h3>
      <p>Ao acessar e usar a plataforma Vixter, você concorda em cumprir estes Termos de Serviço. Se você não concorda com qualquer parte destes termos, não deve usar nossos serviços.</p>
    </section>

    <section>
      <h3>2. Descrição do Serviço</h3>
      <p>A Vixter é uma plataforma inovadora que conecta usuários e vendedores(as) de conteúdo através de:</p>
      <ul>
        <li><strong>Feeds Sociais:</strong> Vixies e Vixink para descoberta de conteúdo e conexões</li>
        <li><strong>Marketplace de Serviços:</strong> Profissionais que oferecem serviços diversos</li>
        <li><strong>Marketplace de Packs:</strong> Criadores de conteúdo digital premium</li>
        <li><strong>Sistema de Gorjetas:</strong> Vixtip para apoiar criadores favoritos</li>
        <li><strong>Comunidade Gaming:</strong> Encontre parceiros para jogar seus games favoritos</li>
        <li><strong>Companhias Virtuais:</strong> Conecte-se para conversar e passar o tempo</li>
      </ul>
    </section>

    <section>
      <h3>3. Elegibilidade</h3>
      <p>Para usar nossos serviços, você deve:</p>
      <ul>
        <li>Ter pelo menos 18 anos de idade</li>
        <li>Fornecer informações verdadeiras e precisas</li>
        <li>Manter a segurança de sua conta</li>
        <li>Cumprir todas as leis aplicáveis</li>
        <li>Não ter sido previamente suspenso da plataforma</li>
      </ul>
    </section>

    <section>
      <h3>4. Contas de Usuário</h3>
      <h4>4.1 Criação de Conta</h4>
      <ul>
        <li>Você é responsável por manter a confidencialidade de suas credenciais</li>
        <li>Deve notificar imediatamente sobre uso não autorizado</li>
        <li>Uma conta por pessoa física</li>
        <li>Verificação de identidade obrigatória (KYC)</li>
      </ul>

      <h4>4.2 Tipos de Conta</h4>
      <ul>
        <li><strong>Conta Usuário:</strong> Acesso para utilizar a plataforma como rede social e adquirir serviços e packs destinado ao público geral.</li>
        <li><strong>Conta Vendedor(a):</strong> Acesso para utilizar a plataforma como rede social e criar serviços e packs destinado ao público geral.</li>
        <li><strong>Conta Usuário KYC:</strong> Habilitada a partir da verificação KYC, para acesso a conteúdo adulto e restrito.</li>
        <li><strong>Conta Vendedor(a) KYC:</strong> Habilitada a partir da verificação KYC, para acesso a criação de conteúdo em categorias adulto e restrito, além da funcionalidade de payout.</li>
      </ul>
    </section>

    <section>
      <h3>5. Transações e Pagamentos</h3>
      <h4>5.1 Sistema de Moedas Virtuais</h4>
      <ul>
        <li><strong>VP (Vixter Points):</strong> Moeda principal para transações na plataforma</li>
        <li><strong>VBP (Vixter Bonus Points):</strong> Moeda de bônus obtida através de compras</li>
        <li><strong>Conversão:</strong> 1 VC = 1.5 VP (arredondado para cima)</li>
        <li><strong>Aquisição:</strong> VP podem ser comprados com cartão de crédito via Stripe por contas de tipo usuário.</li>
        <li><strong>Uso:</strong> VP são utilizados para contratar serviços, comprar packs e enviar gorjetas para contas de tipo vendedor(a).</li>
      </ul>

      <h4>5.2 Política de Reembolso</h4>
      <ul>
        <li>Reembolsos são aplicáveis somente conforme política explícita no momento de aquisição de serviço ou pack.</li>
        <li>Os reembolsos são feitos diretamente na carteira virtual do usuário em VP.</li>
        <li>Disputas resolvidas através de processo interno de medição.</li>
        <li>Taxas de processamento não reembolsáveis</li>
        <li>Reembolsos serão aplicáveis somente em casos de serviço defeituoso ou caso o(a) criador(a) de conteúdo não aceite sua solicitação.</li>
      </ul>
    </section>

    <section>
      <h3>6. Conduta do Usuário</h3>
      <h4>6.1 Atividades Proibidas</h4>
      <ul>
        <li>Oferecer serviços ilegais ou prejudiciais</li>
        <li>Fraude, phishing ou atividades enganosas</li>
        <li>Spam ou comunicações não solicitadas</li>
        <li>Violar direitos de propriedade intelectual</li>
        <li>Interferir no funcionamento da plataforma</li>
        <li>Usar contas falsas ou múltiplas</li>
        <li>Publicar conteúdo inadequado nos feeds Vixies/Vixink/Feed</li>
        <li>Utilizar a plataforma para importunação dos usuários e(ou) vendedores(as)</li>
        <li>Usar a plataforma para atividades não relacionadas ao entretenimento</li>
        <li>Manipular o sistema de gorjetas (Vixtip) de forma fraudulenta</li>
        <li>Compartilhar conteúdo de packs sem autorização prévia do autor</li>
      </ul>

      <h4>6.2 Conteúdo Aceitável</h4>
      <ul>
        <li>Respeitar direitos autorais e marcas registradas</li>
        <li>Não publicar conteúdo ofensivo ou inadequado</li>
        <li>Manter informações precisas e atualizadas</li>
        <li>Cumprir padrões de qualidade estabelecidos</li>
        <li>Conteúdo relacionado ao gaming, entretenimento e comunidade virtual</li>
        <li>Conteúdo direcionado ao público adulto deve ser categorizado corretamente como +18 e publicado somente na área restrita (Vixies)</li>
        <li>Posts nos feeds Vixies/Vixink devem ser apropriados e construtivos</li>
        <li>Packs devem conter conteúdo original e de qualidade</li>
        <li>Serviços devem ser legítimos e bem descritos</li>
      </ul>
    </section>

    <section>
      <h3>7. Propriedade Intelectual</h3>
      <h4>7.1 Conteúdo da Plataforma</h4>
      <ul>
        <li>Software, design e funcionalidades são propriedade da Vixter</li>
        <li>Marca registrada protegida</li>
        <li>Conteúdo licenciado para uso pessoal</li>
      </ul>

      <h4>7.2 Conteúdo do Usuário</h4>
      <ul>
        <li>Usuários mantêm direitos sobre seu conteúdo</li>
        <li>Concedem licença para uso na plataforma</li>
        <li>Responsáveis por violações de direitos autorais</li>
      </ul>
    </section>

    <section>
      <h3>8. Limitação de Responsabilidade</h3>
      <p>A Vixter não se responsabiliza por:</p>
      <ul>
        <li>Qualidade dos serviços prestados por terceiros</li>
        <li>Disputas entre usuários</li>
        <li>Danos indiretos ou consequenciais</li>
        <li>Interrupções temporárias do serviço</li>
        <li>Perdas financeiras decorrentes de uso inadequado</li>
      </ul>
    </section>

    <section>
      <h3>9. Suspensão e Encerramento</h3>
      <h4>9.1 Suspensão de Conta</h4>
      <ul>
        <li>Violation dos termos de serviço</li>
        <li>Atividades fraudulentas</li>
        <li>Comportamento inadequado</li>
        <li>Investigações de segurança</li>
      </ul>

      <h4>9.2 Encerramento de Conta</h4>
      <ul>
        <li>Solicitação do usuário</li>
        <li>Violations graves ou repetidas</li>
        <li>Inatividade prolongada</li>
        <li>Decisão judicial</li>
      </ul>
    </section>

    <section>
      <h3>10. Resolução de Disputas</h3>
      <h4>10.1 Processo de Mediação</h4>
      <ul>
        <li>Disputas resolvidas através de sistema interno</li>
        <li>Processo de arbitragem disponível</li>
        <li>Suporte ao cliente como primeira instância</li>
      </ul>

      <h4>10.2 Jurisdição</h4>
      <p>Estes termos são regidos pelas leis brasileiras. Disputas serão resolvidas nos tribunais competentes do Brasil.</p>
    </section>

    <section>
      <h3>11. Modificações dos Termos</h3>
      <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. Usuários serão notificados sobre mudanças significativas. O uso continuado constitui aceitação dos novos termos.</p>
    </section>

    <section>
      <h3>12. Contato</h3>
      <p>Para questões sobre estes termos de serviço:</p>
      <ul>
        <li><strong>E-mail:</strong> contato@vixter.com.br</li>
      </ul>
    </section>
  </div>
);

const AboutUs = () => (
  <div className="document-content">
    <h2>Sobre a Vixter</h2>
    
    <section>
      <h3>Nossa Missão</h3>
      <p>A Vixter é uma plataforma inovadora que conecta pessoas. Desde gamers a companhias virtuais, nascemos com o objetivo de criar um universo onde você pode viver intensamente cada momento, encontrando as companhias certas para jogar seus games favoritos, conversar, receber aulas ou simplesmente ter uma companhia virtual para passar o tempo.</p>
    </section>

    <section>
      <h3>Como Funciona</h3>
      <div className="how-it-works">
        <div className="step">
          <h4>1. Cadastro e Verificação</h4>
          <p>Crie sua conta gratuitamente, complete seu perfil e passe pela verificação KYC para acesso completo à plataforma.</p>
        </div>
        <div className="step">
          <h4>2. Explore o Universo</h4>
          <p>Navegue pelos feeds Vixies e Vixink, descubra serviços, packs de conteúdo ou encontre parceiros para jogar.</p>
        </div>
        <div className="step">
          <h4>3. Conecte-se</h4>
          <p>Converse com outros usuários, contrate serviços, compre packs ou envie gorjetas (Vixtip) para apoiar criadores.</p>
        </div>
        <div className="step">
          <h4>4. Viva a Experiência</h4>
          <p>Desfrute de sessões de jogos, conversas, receba aulas ou simplesmente ter uma companhia virtual para passar o tempo, participe da comunidade e construa conexões duradouras.</p>
        </div>
      </div>
    </section>

    <section>
      <h3>Nossos Valores</h3>
      <ul>
        <li><strong>Conectividade:</strong> Unimos pessoas através do gaming e entretenimento virtual</li>
        <li><strong>Segurança:</strong> Verificação KYC obrigatória para acesso completo à plataforma e proteção máxima dos dados</li>
        <li><strong>Transparência:</strong> Sistema de moedas virtuais (VP/VBP) e transações claras</li>
        <li><strong>Comunidade:</strong> Espaço respeitoso e seguro para todos aproveitarem suas conexões, desde usuários a criadores(as) de conteúdo</li>
      </ul>
    </section>

    <section>
      <h3>Recursos da Plataforma</h3>
      <div className="features-grid">
        <div className="feature">
          <h4>🎮 Feeds Sociais</h4>
          <p>Vixies e Vixink para descobrir conteúdo e conectar-se com a comunidade</p>
        </div>
        <div className="feature">
          <h4>💎 Sistema de Moedas</h4>
          <p>VP (Vixter Points) e VBP (Vixter Bonus Points) para transações seguras</p>
        </div>
        <div className="feature">
          <h4>🎁 Sistema Vixtip</h4>
          <p>Envie gorjetas para apoiar seus criadores favoritos</p>
        </div>
        <div className="feature">
          <h4>📦 Marketplace de Packs</h4>
          <p>Conteúdo digital com proteção de direitos autorais e watermarks</p>
        </div>
        <div className="feature">
          <h4>🛠️ Marketplace de Serviços</h4>
          <p>Contrate serviços diversos dos seus vendedores(as) de conteúdo preferidos</p>
        </div>
        <div className="feature">
          <h4>🔒 Verificação KYC</h4>
          <p>Identidade verificada para maior segurança e confiança</p>
        </div>
        <div className="feature">
          <h4>💬 Mensagens em Tempo Real</h4>
          <p>Comunicação instantânea via chat entre todos os usuários</p>
        </div>
        <div className="feature">
          <h4>💳 Pagamentos Seguros</h4>
          <p>Processamento via Stripe com proteção total</p>
        </div>
      </div>
    </section>

    <section>
      <h3>Contato</h3>
      <p>Quer saber mais sobre a Vixter ou tem alguma sugestão? Entre em contato conosco:</p>
      <ul>
        <li><strong>E-mail:</strong> contato@vixter.com.br</li>
      </ul>
    </section>
  </div>
);

export default Sobre;
