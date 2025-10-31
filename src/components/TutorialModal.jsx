import React, { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import './TutorialModal.css';

const TutorialModal = () => {
  const { currentUser } = useAuth();
  const { userProfile, updateUserProfile, loading: userLoading } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState('aceite'); // aceite, video, guiaEscrito
  const videoRef = useRef(null);

  // Verificar se o tutorial já foi completado e se deve mostrar
  useEffect(() => {
    if (!userLoading && currentUser && userProfile) {
      // Se o tutorial não foi completado, mostrar o modal
      if (!userProfile.tutorialCompleted) {
        setIsOpen(true);
      }
    }
  }, [currentUser, userProfile, userLoading]);

  // Ao completar o tutorial, salvar no perfil
  const handleCompleteTutorial = async () => {
    if (currentUser) {
      try {
        await updateUserProfile({
          tutorialCompleted: true,
          tutorialCompletedAt: Timestamp.now()
        });
        setIsOpen(false);
      } catch (error) {
        console.error('Erro ao salvar conclusão do tutorial:', error);
      }
    }
  };

  // Navegar para o passo do vídeo
  const handleVideoChoice = () => {
    setCurrentStep('video');
    // Reproduzir o vídeo quando mudar para este passo
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(error => {
          console.error('Erro ao reproduzir vídeo:', error);
        });
      }
    }, 100);
  };

  // Navegar para o guia escrito
  const handleTextChoice = () => {
    setCurrentStep('guiaEscrito');
  };

  // Fechar o modal (não permitir fechar antes de completar)
  const handleClose = () => {
    // Só permitir fechar se o tutorial foi completado
    if (userProfile?.tutorialCompleted) {
      setIsOpen(false);
    }
  };

  if (!isOpen || userLoading) {
    return null;
  }

  return (
    <div className="tutorial-modal-overlay" onClick={handleClose}>
      <div className="tutorial-modal-content" onClick={(e) => e.stopPropagation()}>
        {currentStep === 'aceite' && (
          <div className="tutorial-step aceite-step">
            <div className="tutorial-svg-container">
              <img 
                src="/tutorials/aceite.svg" 
                alt="Tutorial de Aceite" 
                className="tutorial-svg-image"
              />
              {/* Botões sobrepostos */}
              <button 
                className="tutorial-button video-button"
                onClick={handleVideoChoice}
              >
                Vídeo com áudio
              </button>
              <button 
                className="tutorial-button text-button"
                onClick={handleTextChoice}
              >
                Texto com imagens
              </button>
            </div>
          </div>
        )}

        {currentStep === 'video' && (
          <div className="tutorial-step video-step">
            <div className="tutorial-svg-container">
              <img 
                src="/tutorials/video.svg" 
                alt="Tutorial de Vídeo" 
                className="tutorial-svg-image"
              />
              {/* Vídeo sobreposto no meio do SVG */}
              <div className="tutorial-video-container">
                <video 
                  ref={videoRef}
                  src="/tutorials/videoLobby.mp4" 
                  controls
                  className="tutorial-video"
                  onEnded={handleCompleteTutorial}
                >
                  Seu navegador não suporta vídeos HTML5.
                </video>
              </div>
            </div>
            <div className="tutorial-actions">
              <button 
                className="tutorial-complete-btn"
                onClick={handleCompleteTutorial}
              >
                Li e Entendi!
              </button>
            </div>
          </div>
        )}

        {currentStep === 'guiaEscrito' && (
          <div className="tutorial-step guia-escrito-step">
            <div className="tutorial-svg-container">
              <img 
                src="/tutorials/guiaEscrito.svg" 
                alt="Guia Escrito" 
                className="tutorial-svg-image"
              />
              {/* Conteúdo de texto com scroll */}
              <div className="tutorial-text-container">
                <div className="tutorial-text-content">
                  <h2>ATENÇÃO PARA O CONTEÚDO ABAIXO</h2>
                  <p>
                    Como idealizador aqui na Vixter você poderá explorar o mundo Vix, um mundo repleto de interações e possibilidades que está em constantes mudanças e ampliações. Para realizar suas postagens e se conectar com outros idealizadores, você pode ir até o Lobby, lá poderá se expressar, compartilhar ideias e muito mais. Lembrando que o Lobby será constantemente atualizado, para tornar sua experiencia mais imersiva no universo Vix.
                  </p>
                  <p>
                    Você é livre para explorar nossa plataforma por conta própria, porém, aqui vão alguns avisos de segurança:
                  </p>
                  <ul>
                    <li>
                      Não é permitido citar temas de conteúdo para maiores (+18), incluindo conteúdos sugestivos sem selecionar a opção de conteúdo tendencioso. Lembrando que não é permitido nenhum tipo de Nudez explicita no Lobby;
                    </li>
                    <li>
                      Ao criar um post que remete ao uso de drogas, álcool, conteúdo delicado, sugestivo sexualmente e demais temas destinados a maiores de idade é obrigatório o uso da Tag de conteúdo tendencioso, assim o post será visto apenas por maiores de idade.
                    </li>
                  </ul>
                  <p><strong>Em Resumo:</strong></p>
                  <p>
                    Você pode postar sobre temas como drogas, álcool, sexo, etc, desde que:
                  </p>
                  <ul>
                    <li>Não incentive os usos (ex.: "use isso", "é bom fazer tal coisa");</li>
                    <li>Não mostre consumo explícito de drogas ilegais;</li>
                    <li>Não inclua menores de idade em nenhum contexto adulto;</li>
                    <li>Não seja violento, discriminatório ou gráfico (ex.: cenas de overdose, mutilação, etc.).</li>
                    <li>USE OBRIGATORIAMENTE A TAG DE: "CONTEÚDO TENDENCIOSO/SENSÍVEL para assuntos relacionados.</li>
                  </ul>
                  <p><strong>O que é proibido no uso do Lobby:</strong></p>
                  <ul>
                    <li>Mostrar uso de drogas ilegais;</li>
                    <li>Conteúdo pornográfico explícito sem o uso da tag +18;</li>
                    <li>Conteúdo pornográfico explícito pessoal em forma de autopromoção (de maneira alguma será aceito);</li>
                    <li>Conteúdo que promova venda, compra ou fabricação de drogas;</li>
                    <li>Apologia a crimes;</li>
                    <li>Quaisquer conteúdos adultos sem marcação;</li>
                    <li>Não é permitido nenhum tipo de autopromoção no Lobby;</li>
                    <li>Não é permitido a venda de serviços e produtos dentro do Lobby;</li>
                  </ul>
                  <p>O Lobby não foi desenvolvido para ser um marketplace;</p>
                  <p>
                    Não nos responsabilizamos por ofensas e preconceitos que quaisquer usuários possam cometer utilizando seu próprio perfil na plataforma (Com relação a outros usuários, atos e temas políticos, conteúdos sensíveis e etc) devido à liberdade de expressão do mesmo. Entretanto, atos criminosos serão penalizados dentro da plataforma, podendo a conta sofrer restrição dado ao nível de teor abusivo/criminoso no post;
                  </p>
                  <p><strong>É proibido:</strong></p>
                  <ul>
                    <li>A organização, promoção ou participação de qualquer tipo de comportamento ilegal;</li>
                    <li>Se envolver em atividades que possam danificar ou comprometer a segurança de uma conta, rede ou sistema;</li>
                    <li>Divulgar jogos de azar e casas de apostas;</li>
                    <li>Compartilhar conteúdo que viole os direitos de propriedade intelectual ou outros direitos de qualquer pessoa.</li>
                  </ul>
                  <p>
                    O desacato a qualquer uma dessas <strong>RESTRIÇÕES DENTRO DO LOBBY</strong>, estará sujeito a penalidades, sendo elas: Aviso/advertência, restrição temporária do uso do LOBBY, restrição severa e até mesmo banimento da plataforma. Você tem direitos e deveres aqui dentro, lembre-se sempre: <strong>COM GRANDES PODERES VEM GRANDES RESPONSABILIDADES!</strong>
                  </p>
                  <p>
                    Para quaisquer dúvidas relacionadas ao Lobby pode sempre entrar em contato com nosso suporte.
                  </p>
                  <p className="welcome-text"><strong>Seja bem-vindo a Vixter!</strong></p>
                </div>
              </div>
              <div className="tutorial-actions">
                <button 
                  className="tutorial-complete-btn"
                  onClick={handleCompleteTutorial}
                >
                  LI E ENTENDI!
                </button>
                <a 
                  href="/terms" 
                  className="tutorial-terms-link"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  Para acessar todos os Termos de Uso da plataforma clique aqui
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorialModal;

