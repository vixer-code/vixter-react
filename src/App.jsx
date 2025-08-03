import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { StatusProvider } from './contexts/StatusContext';
import { usePresenceSystem } from './hooks/usePresence';
import Header from './components/Header';
import Footer from './components/Footer';
import NotificationContainer from './components/NotificationContainer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import VerifyEmail from './pages/VerifyEmail';
import CreateService from './pages/CreateService';
import CreatePack from './pages/CreatePack';
import CreateSubscription from './pages/CreateSubscription';
import NotFound from './pages/NotFound';

import './App.css';

function AppContent() {
  usePresenceSystem(); // Initialize presence system

  return (
    <Router>
      <div className="App">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/create-service" element={<CreateService />} />
            <Route path="/create-pack" element={<CreatePack />} />
            <Route path="/create-subscription" element={<CreateSubscription />} />
            {/* Placeholder routes for other pages */}
            <Route path="/vixies" element={<div>Vixies Page - Coming Soon</div>} />
            <Route path="/vixink" element={<div>Vixink Page - Coming Soon</div>} />
            <Route path="/settings" element={<div>Settings Page - Coming Soon</div>} />
            <Route path="/my-services" element={<div>My Services Page - Coming Soon</div>} />
            <Route path="/services" element={<div>Services Page - Coming Soon</div>} />
            
            {/* Catch-all route - must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
        <NotificationContainer />
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <StatusProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </StatusProvider>
    </AuthProvider>
  );
}

export default App;
