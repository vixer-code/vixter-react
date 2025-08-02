import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Star, Users, Shield, Zap } from 'lucide-react';
import './Home.css';

const Home = () => {
  const { currentUser } = useAuth();

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Bem-vindo ao Vixter</h1>
          <p className="hero-subtitle">
            Sua plataforma de companhia virtual onde você pode conectar-se, 
            oferecer serviços e construir relacionamentos únicos.
          </p>
          
          {!currentUser ? (
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary">
                Começar Agora
                <ArrowRight size={20} />
              </Link>
              <Link to="/login" className="btn btn-secondary">
                Entrar
              </Link>
            </div>
          ) : (
            <div className="hero-actions">
              <Link to="/feed" className="btn btn-primary">
                Ver Comunidade
                <ArrowRight size={20} />
              </Link>
              <Link to="/services" className="btn btn-secondary">
                Explorar Serviços
              </Link>
            </div>
          )}
        </div>
        
        <div className="hero-image">
          <img src="/images/hero-illustration.svg" alt="Vixter Platform" />
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2>Por que escolher o Vixter?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Users size={32} />
              </div>
              <h3>Comunidade Vibrante</h3>
              <p>
                Conecte-se com pessoas incríveis e construa relacionamentos 
                significativos em nossa comunidade ativa.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Shield size={32} />
              </div>
              <h3>Segurança Garantida</h3>
              <p>
                Sistema de verificação robusto e pagamentos seguros para 
                garantir sua tranquilidade em todas as interações.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={32} />
              </div>
              <h3>Fácil de Usar</h3>
              <p>
                Interface intuitiva e recursos poderosos que tornam a 
                experiência simples e agradável para todos.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Star size={32} />
              </div>
              <h3>Qualidade Premium</h3>
              <p>
                Oferecemos uma experiência premium com recursos exclusivos 
                e suporte dedicado para nossos usuários.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Pronto para começar sua jornada?</h2>
            <p>
              Junte-se a milhares de usuários que já descobriram uma nova forma 
              de conectar-se e oferecer serviços únicos.
            </p>
            
            {!currentUser ? (
              <Link to="/register" className="btn btn-primary btn-large">
                Criar Conta Grátis
                <ArrowRight size={20} />
              </Link>
            ) : (
              <Link to="/my-services" className="btn btn-primary btn-large">
                Meus Serviços
                <ArrowRight size={20} />
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;