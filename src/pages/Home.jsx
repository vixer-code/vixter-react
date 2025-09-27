import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [stats, setStats] = useState({
    users: 0,
    duos: 0,
    companions: 0,
    satisfaction: 0
  });
  const [activeFAQ, setActiveFAQ] = useState(null);

  // Remove header padding for home page
  useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.add('no-header-padding');
    }
    
    return () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.classList.remove('no-header-padding');
      }
    };
  }, []);

  useEffect(() => {
    // Animate stats counter
    const animateStats = () => {
      const targets = {
        users: 15000,
        duos: 8500,
        companions: 5000,
        satisfaction: 98
      };

      const duration = 2000;
      const steps = 60;
      const stepDuration = duration / steps;

      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;

        setStats({
          users: Math.floor(targets.users * progress),
          duos: Math.floor(targets.duos * progress),
          companions: Math.floor(targets.companions * progress),
          satisfaction: Math.floor(targets.satisfaction * progress)
        });

        if (currentStep >= steps) {
          clearInterval(interval);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    };

    // Start animation when component mounts
    const timer = setTimeout(animateStats, 500);
    return () => clearTimeout(timer);
  }, []);

  const toggleFAQ = (index) => {
    setActiveFAQ(activeFAQ === index ? null : index);
  };

  return (
    <main className="home-container">
      
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="glitch-text">Um Novo Universo de Conexões</h1>
          <p className="hero-subtitle">Viva intensamente cada momento, com as companhias certas ao seu lado</p>
          <div className="hero-cta">
            <Link to="/register" className="btn-primary">Começar Agora</Link>
            <a href="#how-it-works" className="btn-secondary">Como Funciona</a>
          </div>
        </div>
        <div className="hero-image">
          <img src="/images/Flor-Colorida.png" alt="Vixter experience" className="hero-img" />
          <div className="glow-overlay"></div>
        </div>
      </section>

      {/* Stats Counter */}
      <section className="stats-section">
        <div className="stat-counter">
          <div className="stat-icon"><i className="fas fa-users"></i></div>
          <div className="stat-number">{stats.users.toLocaleString()}</div>
          <div className="stat-label">Usuários Ativos</div>
        </div>
        <div className="stat-counter">
          <div className="stat-icon"><i className="fas fa-gamepad"></i></div>
          <div className="stat-number">{stats.duos.toLocaleString()}</div>
          <div className="stat-label">Duo Partners</div>
        </div>
        <div className="stat-counter">
          <div className="stat-icon"><i className="fas fa-heart"></i></div>
          <div className="stat-number">{stats.companions.toLocaleString()}</div>
          <div className="stat-label">Companhias Virtuais</div>
        </div>
        <div className="stat-counter">
          <div className="stat-icon"><i className="fas fa-star"></i></div>
          <div className="stat-number">{stats.satisfaction}%</div>
          <div className="stat-label">Satisfação</div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services-section">
        <div className="section-header">
          <h2>Nossos Serviços</h2>
          <p>Encontre exatamente o que você procura na Vixter</p>
        </div>
        
        <div className="services-grid">
          <div className="service-card">
            <div className="service-icon">
              <i className="fas fa-gamepad"></i>
            </div>
            <h3>Duo Gaming</h3>
            <p>Encontre parceiros para jogar seus games favoritos. Melhore seu gameplay com players experientes ou divirta-se com companhias descontraídas.</p>
            <Link to="/vixink" className="btn-service">Encontrar Duo</Link>
          </div>
          
          <div className="service-card featured">
            <div className="featured-badge">Mais Popular</div>
            <div className="service-icon">
              <i className="fas fa-heart"></i>
            </div>
            <h3>Companhia Virtual</h3>
            <p>Contrate companhias virtuais para conversas, jogos, ou apenas para passar o tempo. Nossas Vixies são selecionadas para proporcionar a melhor experiência.</p>
            <Link to="/vixies" className="btn-service">Conhecer Vixies</Link>
          </div>
          
          <div className="service-card">
            <div className="service-icon">
              <i className="fas fa-graduation-cap"></i>
            </div>
            <h3>Serviços Educacionais</h3>
            <p>Aprenda com quem gosta de ensinar. Aulas personalizadas, conteúdo interativo e ajuda naquele projeto que você quer tirar do papel.</p>
            <Link to="/vixink" className="btn-service">Encontrar Aulas</Link>
          </div>
          </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-section">
        <div className="section-header">
          <h2>Como Funciona</h2>
          <p>Simples, rápido e seguro</p>
        </div>
        
        <div className="how-steps">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon"><i className="fas fa-user-plus"></i></div>
            <h3>Crie sua conta</h3>
            <p>Registre-se gratuitamente e configure seu perfil com seus jogos favoritos e preferências.</p>
          </div>
          
          <div className="step-connector">
            <svg width="80" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 10 L80 10" stroke="#8A2BE2" strokeWidth="2" strokeDasharray="5,5" />
              <circle cx="40" cy="10" r="3" fill="#00FFCA" />
            </svg>
          </div>
          
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon"><i className="fas fa-search"></i></div>
            <h3>Encontre serviços</h3>
            <p>Navegue por nossa seleção de jogadores, vixies e coaches com filtros personalizados.</p>
          </div>
          
          <div className="step-connector">
            <svg width="80" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 10 L80 10" stroke="#8A2BE2" strokeWidth="2" strokeDasharray="5,5" />
              <circle cx="40" cy="10" r="3" fill="#00FFCA" />
            </svg>
          </div>
          
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon"><i className="fas fa-coins"></i></div>
            <h3>Compre Vixter Points</h3>
            <p>Carregue sua carteira com VP, nossa moeda digital para contratar serviços na plataforma.</p>
          </div>
          
          <div className="step-connector">
            <svg width="80" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 10 L80 10" stroke="#8A2BE2" strokeWidth="2" strokeDasharray="5,5" />
              <circle cx="40" cy="10" r="3" fill="#00FFCA" />
            </svg>
          </div>
          
          <div className="step-card">
            <div className="step-number">4</div>
            <div className="step-icon"><i className="fas fa-handshake"></i></div>
            <h3>Contrate e divirta-se</h3>
            <p>Escolha o serviço desejado, faça o pagamento com VP e aproveite a experiência.</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="section-header">
          <h2>O que Dizem Nossos Usuários</h2>
          <p>Experiências reais de nossa comunidade</p>
        </div>
        
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <div className="testimonial-avatar">
              <img src="/images/defpfp1.png" alt="User testimonial" />
            </div>
            <div className="testimonial-content">
              <div className="testimonial-rating">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p className="testimonial-text">"Encontrei uma duo parceira incrível no LoL que me ajudou a subir de elo. Além de ser uma ótima player, me deu várias dicas. Vale cada VP investido!"</p>
              <div className="testimonial-author">
                <span className="author-name">Rafael S.</span>
                <span className="author-date">Há 3 dias</span>
              </div>
            </div>
          </div>
          
          <div className="testimonial-card">
            <div className="testimonial-avatar">
              <img src="/images/defpfp2.png" alt="User testimonial" />
            </div>
            <div className="testimonial-content">
              <div className="testimonial-rating">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star-half-alt"></i>
              </div>
              <p className="testimonial-text">"Sou tímido e tinha dificuldade em jogar com pessoas aleatórias. Na Vixter encontrei uma companhia que me deixou super à vontade. Agora jogo Valorant toda semana com ela."</p>
              <div className="testimonial-author">
                <span className="author-name">Lucas M.</span>
                <span className="author-date">Há 1 semana</span>
              </div>
            </div>
          </div>
          
          <div className="testimonial-card">
            <div className="testimonial-avatar">
              <img src="/images/defpfp3.png" alt="User testimonial" />
            </div>
            <div className="testimonial-content">
              <div className="testimonial-rating">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p className="testimonial-text">"As sessões de coaching me ajudaram muito a melhorar meu gameplay. Meu coach é super atencioso e me ensinou estratégias que eu nunca teria descoberto sozinho."</p>
              <div className="testimonial-author">
                <span className="author-name">Mariana C.</span>
                <span className="author-date">Há 2 semanas</span>
              </div>
            </div>
          </div>
          
          <div className="testimonial-card">
            <div className="testimonial-avatar">
              <img src="/images/admin.png" alt="User testimonial" />
            </div>
            <div className="testimonial-content">
              <div className="testimonial-rating">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="far fa-star"></i>
              </div>
              <p className="testimonial-text">"Estava me sentindo sozinho durante a pandemia e encontrar uma companhia virtual para conversar e jogar foi uma experiência incrível. Recomendo para quem quer uma companhia descontraída."</p>
              <div className="testimonial-author">
                <span className="author-name">Pedro L.</span>
                <span className="author-date">Há 1 mês</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Join Now CTA Section */}
      <section className="join-section">
        <div className="join-content">
          <h2>Pronto para Começar?</h2>
          <p>Registre-se agora e ganhe <span className="highlight">5 VP</span> de bônus para experimentar nossos serviços!</p>
          <div className="join-cta">
            <Link to="/register" className="btn-primary-large">Criar Conta Grátis</Link>
            <Link to="/vixies" className="btn-secondary-large">Explorar Vixies</Link>
          </div>
        </div>
        
        <div className="join-image">
          <img src="/images/vixia-5vp.png" alt="Join Vixter" />
          <div className="glow-overlay"></div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-header">
          <h2>Perguntas Frequentes</h2>
          <p>Tudo que você precisa saber sobre a Vixter</p>
        </div>
        
        <div className="faq-accordion">
          <div className={`faq-item ${activeFAQ === 0 ? 'active' : ''}`} onClick={() => toggleFAQ(0)}>
            <div className="faq-question">
              <h3>O que é a Vixter?</h3>
              <span className="faq-toggle"><i className="fas fa-chevron-down"></i></span>
            </div>
            <div className="faq-answer">
              <p>A Vixter é uma plataforma que conecta pessoas a gamers e companhias virtuais. Aqui você pode encontrar parceiros para jogar seus games favoritos, conversar, receber aulas ou simplesmente ter uma companhia virtual para passar o tempo.</p>
            </div>
          </div>
          
          <div className={`faq-item ${activeFAQ === 1 ? 'active' : ''}`} onClick={() => toggleFAQ(1)}>
            <div className="faq-question">
              <h3>Como funcionam os Vixter Points (VP)?</h3>
              <span className="faq-toggle"><i className="fas fa-chevron-down"></i></span>
            </div>
            <div className="faq-answer">
              <p>Vixter Points (VP) são a moeda virtual da plataforma. Você pode adquirir VP através de compras com cartão de crédito, e em breve com PIX. Os VP são utilizados para contratar serviços na plataforma, como sessões com duo partners, companhias virtuais ou coaching.</p>
            </div>
          </div>
          
          <div className={`faq-item ${activeFAQ === 2 ? 'active' : ''}`} onClick={() => toggleFAQ(2)}>
            <div className="faq-question">
              <h3>É seguro contratar serviços na Vixter?</h3>
              <span className="faq-toggle"><i className="fas fa-chevron-down"></i></span>
            </div>
            <div className="faq-answer">
              <p>Sim, priorizamos a segurança de todos os usuários. Todos os prestadores de serviço passam por um processo de verificação, e implementamos sistemas de avaliação para garantir a qualidade das experiências. Além disso, todas as transações são seguras e protegidas.</p>
            </div>
          </div>
          
          <div className={`faq-item ${activeFAQ === 3 ? 'active' : ''}`} onClick={() => toggleFAQ(3)}>
            <div className="faq-question">
              <h3>Posso me tornar um prestador de serviços?</h3>
              <span className="faq-toggle"><i className="fas fa-chevron-down"></i></span>
            </div>
            <div className="faq-answer">
              <p>Sim! Qualquer pessoa maior de 18 anos pode se candidatar para ser um prestador de serviços na Vixter. Basta criar sua conta, completar seu perfil com informações detalhadas e enviar uma solicitação de verificação (KYC). Nossa equipe analisará seu perfil e entrará em contato com mais informações.</p>
            </div>
          </div>
          
          <div className={`faq-item ${activeFAQ === 4 ? 'active' : ''}`} onClick={() => toggleFAQ(4)}>
            <div className="faq-question">
              <h3>Existem reembolsos na plataforma?</h3>
              <span className="faq-toggle"><i className="fas fa-chevron-down"></i></span>
            </div>
            <div className="faq-answer">
              <p>Sim. Entretanto, por tratarmos de pessoas reais que fornecem serviços e packs, a aquisição não é reembolsável. O reembolso somente é aplicado em casos de serviço defeituoso ou caso a criadora de conteúdo não aceite sua solicitação. O reembolso é feito diretamente na carteira virtual do usuário em VP.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;