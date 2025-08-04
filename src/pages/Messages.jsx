import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { db } from '../config/firebase';
import { ref, onValue, push, set, off, query, orderByChild, equalTo } from 'firebase/database';
import './Messages.css';

const Messages = () => {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;

    // Load conversations
    const conversationsRef = ref(db, 'conversations');
    const userConversationsQuery = query(
      conversationsRef,
      orderByChild('participants'),
      equalTo(currentUser.uid)
    );

    const unsubscribeConversations = onValue(userConversationsQuery, (snapshot) => {
      const conversationsData = [];
      snapshot.forEach((childSnapshot) => {
        const conversation = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        conversationsData.push(conversation);
      });
      setConversations(conversationsData);
      setLoading(false);
    });

    // Load users data
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const usersData = {};
      snapshot.forEach((childSnapshot) => {
        usersData[childSnapshot.key] = childSnapshot.val();
      });
      setUsers(usersData);
    });

    return () => {
      off(conversationsRef);
      off(usersRef);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!selectedConversation) return;

    // Load messages for selected conversation
    const messagesRef = ref(db, `messages/${selectedConversation.id}`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'));

    const unsubscribeMessages = onValue(messagesQuery, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((childSnapshot) => {
        messagesData.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      setMessages(messagesData);
    });

    return () => {
      off(messagesRef);
    };
  }, [selectedConversation]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const messageData = {
        senderId: currentUser.uid,
        text: newMessage.trim(),
        timestamp: Date.now(),
        read: false
      };

      const messagesRef = ref(db, `messages/${selectedConversation.id}`);
      await push(messagesRef, messageData);

      // Update conversation last message
      const conversationRef = ref(db, `conversations/${selectedConversation.id}`);
      await set(conversationRef, {
        ...selectedConversation,
        lastMessage: messageData.text,
        lastMessageTime: messageData.timestamp,
        lastSenderId: currentUser.uid
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification('Error sending message', 'error');
    }
  };

  const getOtherParticipant = (conversation) => {
    const otherId = conversation.participants.find(id => id !== currentUser.uid);
    return users[otherId] || {};
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    const otherUser = getOtherParticipant(conversation);
    return otherUser.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           otherUser.username?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="messages-container">
        <div className="loading-spinner">Carregando conversas...</div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      <div className="messages-sidebar">
        <div className="messages-header">
          <h2>Mensagens</h2>
          <div className="search-container">
            <input
              type="text"
              placeholder="Pesquisar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        
        <div className="conversations-list">
          {filteredConversations.length === 0 ? (
            <div className="no-conversations">
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const otherUser = getOtherParticipant(conversation);
              const isSelected = selectedConversation?.id === conversation.id;
              
              return (
                <div
                  key={conversation.id}
                  className={`conversation-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="conversation-avatar">
                    <img
                      src={otherUser.photoURL || '/images/defpfp1.png'}
                      alt={otherUser.displayName || 'User'}
                      onError={(e) => {
                        e.target.src = '/images/defpfp1.png';
                      }}
                    />
                    <div className={`status-indicator ${otherUser.status || 'offline'}`}></div>
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-name">
                      {otherUser.displayName || otherUser.username || 'Usuário'}
                    </div>
                    <div className="conversation-preview">
                      {conversation.lastMessage || 'Nenhuma mensagem ainda'}
                    </div>
                  </div>
                  {conversation.lastMessageTime && (
                    <div className="conversation-time">
                      {formatTime(conversation.lastMessageTime)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="messages-main">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <img
                  src={getOtherParticipant(selectedConversation).photoURL || '/images/defpfp1.png'}
                  alt={getOtherParticipant(selectedConversation).displayName || 'User'}
                  onError={(e) => {
                    e.target.src = '/images/defpfp1.png';
                  }}
                />
                <div>
                  <h3>{getOtherParticipant(selectedConversation).displayName || 'Usuário'}</h3>
                  <span className={`status-text ${getOtherParticipant(selectedConversation).status || 'offline'}`}>
                    {getOtherParticipant(selectedConversation).status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="messages-list">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>Nenhuma mensagem ainda. Inicie uma conversa!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.senderId === currentUser.uid;
                  const sender = isOwnMessage ? currentUser : users[message.senderId];
                  
                  return (
                    <div
                      key={message.id}
                      className={`message ${isOwnMessage ? 'own-message' : 'other-message'}`}
                    >
                      {!isOwnMessage && (
                        <img
                          src={sender?.photoURL || '/images/defpfp1.png'}
                          alt={sender?.displayName || 'User'}
                          className="message-avatar"
                          onError={(e) => {
                            e.target.src = '/images/defpfp1.png';
                          }}
                        />
                      )}
                      <div className="message-content">
                        <div className="message-text">{message.text}</div>
                        <div className="message-time">
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-container">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Digite sua mensagem..."
                className="message-input"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="send-button"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </>
        ) : (
          <div className="no-conversation-selected">
            <div className="select-conversation-message">
              <i className="fas fa-comments"></i>
              <h3>Selecione uma conversa</h3>
              <p>Escolha uma conversa para começar a enviar mensagens</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages; 