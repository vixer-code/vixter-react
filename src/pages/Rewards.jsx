import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../../config/firebase';
import { ref, get, set, push, update } from 'firebase/database';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './Rewards.css';

const Rewards = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [userVP, setUserVP] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [claimingReward, setClaimingReward] = useState(null);

  // Daily tasks configuration
  const defaultDailyTasks = [
    {
      id: 'login',
      title: 'Login Diário',
      description: 'Faça login no Vixter',
      reward: 10,
      icon: 'fas fa-sign-in-alt',
      completed: false
    },
    {
      id: 'profile_visit',
      title: 'Visite um Perfil',
      description: 'Visite o perfil de outro usuário',
      reward: 5,
      icon: 'fas fa-user',
      completed: false
    },
    {
      id: 'service_view',
      title: 'Explore Serviços',
      description: 'Visualize 3 serviços diferentes',
      reward: 15,
      icon: 'fas fa-search',
      completed: false,
      progress: 0,
      target: 3
    },
    {
      id: 'message_send',
      title: 'Seja Social',
      description: 'Envie uma mensagem para outro usuário',
      reward: 20,
      icon: 'fas fa-message',
      completed: false
    }
  ];

  // Achievement configurations
  const defaultAchievements = [
    {
      id: 'first_service',
      title: 'Primeiro Serviço',
      description: 'Crie seu primeiro serviço',
      reward: 100,
      icon: 'fas fa-star',
      unlocked: false
    },
    {
      id: 'social_butterfly',
      title: 'Borboleta Social',
      description: 'Tenha 10 seguidores',
      reward: 150,
      icon: 'fas fa-users',
      unlocked: false,
      progress: 0,
      target: 10
    },
    {
      id: 'service_master',
      title: 'Mestre dos Serviços',
      description: 'Complete 50 pedidos de serviços',
      reward: 500,
      icon: 'fas fa-trophy',
      unlocked: false,
      progress: 0,
      target: 50
    },
    {
      id: 'reviewer',
      title: 'Avaliador',
      description: 'Receba 25 avaliações positivas',
      reward: 300,
      icon: 'fas fa-thumbs-up',
      unlocked: false,
      progress: 0,
      target: 25
    }
  ];

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    loadRewardsData();
  }, [currentUser, navigate]);

  const loadRewardsData = async () => {
    try {
      setIsLoading(true);
      
      // Load user VP balance
      const userRef = ref(database, `users/${currentUser.uid}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val() || {};
      setUserVP(userData.vpBalance || 0);

      // Load daily tasks
      const tasksRef = ref(database, `dailyTasks/${currentUser.uid}/${getTodayString()}`);
      const tasksSnapshot = await get(tasksRef);
      
      if (tasksSnapshot.exists()) {
        setDailyTasks(tasksSnapshot.val());
      } else {
        // Initialize daily tasks for today
        const initialTasks = defaultDailyTasks.map(task => ({
          ...task,
          lastUpdated: Date.now()
        }));
        await set(tasksRef, initialTasks);
        setDailyTasks(initialTasks);
      }

      // Load achievements
      const achievementsRef = ref(database, `achievements/${currentUser.uid}`);
      const achievementsSnapshot = await get(achievementsRef);
      
      if (achievementsSnapshot.exists()) {
        setAchievements(achievementsSnapshot.val());
      } else {
        // Initialize achievements
        await set(achievementsRef, defaultAchievements);
        setAchievements(defaultAchievements);
      }

      // Load reward history (last 10 rewards)
      const historyRef = ref(database, `rewardHistory/${currentUser.uid}`);
      const historySnapshot = await get(historyRef);
      
      if (historySnapshot.exists()) {
        const historyData = Object.values(historySnapshot.val())
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);
        setRewardHistory(historyData);
      }

    } catch (error) {
      console.error('Error loading rewards data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTodayString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const claimDailyTask = async (taskId) => {
    if (claimingReward) return;

    setClaimingReward(taskId);

    try {
      const task = dailyTasks.find(t => t.id === taskId);
      if (!task || task.completed) {
        setClaimingReward(null);
        return;
      }

      // Update task as completed
      const updatedTasks = dailyTasks.map(t => 
        t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t
      );
      
      const tasksRef = ref(database, `dailyTasks/${currentUser.uid}/${getTodayString()}`);
      await set(tasksRef, updatedTasks);
      setDailyTasks(updatedTasks);

      // Add VP to user balance
      const newVPBalance = userVP + task.reward;
      const userRef = ref(database, `users/${currentUser.uid}/vpBalance`);
      await set(userRef, newVPBalance);
      setUserVP(newVPBalance);

      // Record in history
      const historyRef = push(ref(database, `rewardHistory/${currentUser.uid}`));
      await set(historyRef, {
        type: 'daily_task',
        title: task.title,
        reward: task.reward,
        timestamp: Date.now()
      });

      // Update local history
      setRewardHistory(prev => [{
        type: 'daily_task',
        title: task.title,
        reward: task.reward,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);

    } catch (error) {
      console.error('Error claiming daily task:', error);
      alert('Erro ao reclamar recompensa. Tente novamente.');
    } finally {
      setClaimingReward(null);
    }
  };

  const claimAchievement = async (achievementId) => {
    if (claimingReward) return;

    setClaimingReward(achievementId);

    try {
      const achievement = achievements.find(a => a.id === achievementId);
      if (!achievement || achievement.unlocked) {
        setClaimingReward(null);
        return;
      }

      // Update achievement as unlocked
      const updatedAchievements = achievements.map(a => 
        a.id === achievementId ? { ...a, unlocked: true, unlockedAt: Date.now() } : a
      );
      
      const achievementsRef = ref(database, `achievements/${currentUser.uid}`);
      await set(achievementsRef, updatedAchievements);
      setAchievements(updatedAchievements);

      // Add VP to user balance
      const newVPBalance = userVP + achievement.reward;
      const userRef = ref(database, `users/${currentUser.uid}/vpBalance`);
      await set(userRef, newVPBalance);
      setUserVP(newVPBalance);

      // Record in history
      const historyRef = push(ref(database, `rewardHistory/${currentUser.uid}`));
      await set(historyRef, {
        type: 'achievement',
        title: achievement.title,
        reward: achievement.reward,
        timestamp: Date.now()
      });

      // Update local history
      setRewardHistory(prev => [{
        type: 'achievement',
        title: achievement.title,
        reward: achievement.reward,
        timestamp: Date.now()
      }, ...prev.slice(0, 9)]);

    } catch (error) {
      console.error('Error claiming achievement:', error);
      alert('Erro ao reclamar conquista. Tente novamente.');
    } finally {
      setClaimingReward(null);
    }
  };

  const formatVP = (amount) => {
    return `VP ${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProgressPercentage = (current, target) => {
    return Math.min((current / target) * 100, 100);
  };

  if (isLoading) {
    return (
      <div className="rewards-loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Carregando recompensas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rewards-page">
      <Header />
      
      <main className="rewards-container">
        <div className="rewards-header">
          <div className="header-content">
            <h1>
              <i className="fas fa-gift"></i>
              Recompensas
            </h1>
            <p>Complete tarefas e conquiste prêmios para ganhar VP!</p>
          </div>
          <div className="vp-display">
            <div className="vp-icon">
              <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0F0F1A" />
                    <stop offset="100%" stopColor="#1A1A2E" />
                  </linearGradient>
                  <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#8A2BE2" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00FFCA" />
                    <stop offset="100%" stopColor="#00D4AA" />
                  </linearGradient>
                </defs>
                
                <circle cx="64" cy="64" r="60" fill="url(#glowGradient)" />
                <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                      fill="url(#hexGradient)" 
                      stroke="#8A2BE2" 
                      strokeWidth="2" 
                      filter="url(#glow)" />
                <path d="M64 14 L110 40 L110 88 L64 114 L18 88 L18 40 Z" 
                      fill="none" 
                      stroke="#00FFCA" 
                      strokeWidth="1.5" 
                      strokeDasharray="4,4"
                      opacity="0.8" />
                <path d="M64 32 L92 48 L92 80 L64 96 L36 80 L36 48 Z" 
                      fill="none" 
                      stroke="#FF2E63" 
                      strokeWidth="1.5" 
                      opacity="0.8" />
                <g filter="url(#glow)">
                  <text x="64" y="72" 
                        fontFamily="'Press Start 2P', monospace" 
                        fontSize="24" 
                        fill="url(#textGradient)"
                        textAnchor="middle"
                        fontWeight="bold">VP</text>
                </g>
              </svg>
            </div>
            <div className="vp-amount">{formatVP(userVP)}</div>
          </div>
        </div>

        <div className="rewards-content">
          <div className="daily-tasks-section">
            <h2>
              <i className="fas fa-calendar-day"></i>
              Tarefas Diárias
            </h2>
            <p>Complete suas tarefas diárias para ganhar VP todos os dias!</p>
            
            <div className="tasks-grid">
              {dailyTasks.map((task) => (
                <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
                  <div className="task-icon">
                    <i className={task.icon}></i>
                  </div>
                  <div className="task-content">
                    <h3 className="task-title">{task.title}</h3>
                    <p className="task-description">{task.description}</p>
                    {task.target && (
                      <div className="task-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${getProgressPercentage(task.progress || 0, task.target)}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">
                          {task.progress || 0}/{task.target}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="task-reward">
                    <div className="reward-amount">+{task.reward} VP</div>
                    <button 
                      className={`claim-btn ${task.completed ? 'claimed' : ''}`}
                      onClick={() => claimDailyTask(task.id)}
                      disabled={task.completed || claimingReward === task.id}
                    >
                      {claimingReward === task.id ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : task.completed ? (
                        <i className="fas fa-check"></i>
                      ) : (
                        'Reclamar'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="achievements-section">
            <h2>
              <i className="fas fa-trophy"></i>
              Conquistas
            </h2>
            <p>Desbloqueie conquistas especiais e ganhe grandes recompensas!</p>
            
            <div className="achievements-grid">
              {achievements.map((achievement) => (
                <div key={achievement.id} className={`achievement-card ${achievement.unlocked ? 'unlocked' : ''}`}>
                  <div className="achievement-icon">
                    <i className={achievement.icon}></i>
                  </div>
                  <div className="achievement-content">
                    <h3 className="achievement-title">{achievement.title}</h3>
                    <p className="achievement-description">{achievement.description}</p>
                    {achievement.target && (
                      <div className="achievement-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${getProgressPercentage(achievement.progress || 0, achievement.target)}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">
                          {achievement.progress || 0}/{achievement.target}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="achievement-reward">
                    <div className="reward-amount">+{achievement.reward} VP</div>
                    <button 
                      className={`claim-btn ${achievement.unlocked ? 'claimed' : ''}`}
                      onClick={() => claimAchievement(achievement.id)}
                      disabled={achievement.unlocked || claimingReward === achievement.id}
                    >
                      {claimingReward === achievement.id ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : achievement.unlocked ? (
                        <i className="fas fa-check"></i>
                      ) : (
                        'Reclamar'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="reward-history-section">
            <h2>
              <i className="fas fa-history"></i>
              Histórico de Recompensas
            </h2>
            
            {rewardHistory.length > 0 ? (
              <div className="history-list">
                {rewardHistory.map((reward, index) => (
                  <div key={index} className="history-item">
                    <div className="history-icon">
                      <i className={reward.type === 'daily_task' ? 'fas fa-calendar-day' : 'fas fa-trophy'}></i>
                    </div>
                    <div className="history-content">
                      <div className="history-title">{reward.title}</div>
                      <div className="history-date">{formatDate(reward.timestamp)}</div>
                    </div>
                    <div className="history-reward">+{reward.reward} VP</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-history">
                <i className="fas fa-inbox"></i>
                <p>Nenhuma recompensa reclamada ainda</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Rewards;