import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { StatusProvider } from './contexts/StatusContext';
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
import Messages from './pages/Messages';
import Services from './pages/Services';
import Settings from './pages/Settings';
import Vixies from './pages/Vixies';
import Vixink from './pages/Vixink';

import NotFound from './pages/NotFound';
import { preloadCommonImages } from './utils/imagePreloader';

import './App.css';

function App() {
  // Preload common images when the app starts
  useEffect(() => {
    preloadCommonImages().catch(error => {
      console.warn('Failed to preload common images:', error);
    });
  }, []);

  return (
    <AuthProvider>
      <StatusProvider>
        <NotificationProvider>
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
                <Route path="/messages" element={<Messages />} />
                <Route path="/services" element={<Services />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/vixies" element={<Vixies />} />
                <Route path="/vixink" element={<Vixink />} />
        
                
                {/* Catch-all route - must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <NotificationContainer />
          </div>
        </Router>
        </NotificationProvider>
      </StatusProvider>
    </AuthProvider>
  );
}

export default App;
