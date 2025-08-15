import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { StatusProvider } from './contexts/StatusContext';
import { WalletProvider } from './contexts/WalletContext';
import Header from './components/Header';
import Footer from './components/Footer';
import NotificationContainer from './components/NotificationContainer';
import { preloadCommonImages } from './utils/imagePreloader';

import './App.css';

// Route-level code splitting
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Feed = lazy(() => import('./pages/Feed'));
const Profile = lazy(() => import('./pages/Profile'));
const Wallet = lazy(() => import('./pages/Wallet'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  // Preload common images when the app starts
  useEffect(() => {
    const run = () => {
      preloadCommonImages().catch(error => {
        console.warn('Failed to preload common images:', error);
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run);
    } else {
      setTimeout(run, 0);
    }
  }, []);

  return (
    <AuthProvider>
      <StatusProvider>
        <NotificationProvider>
          <WalletProvider>
            <Router>
          <div className="App">
            <Header />
            <main className="main-content">
              <Suspense fallback={<div className="page-loading">Carregando...</div>}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  {/* Placeholder routes for other pages */}
                  <Route path="/vixies" element={<div>Vixies Page - Coming Soon</div>} />
                  <Route path="/vixink" element={<div>Vixink Page - Coming Soon</div>} />
                  <Route path="/settings" element={<div>Settings Page - Coming Soon</div>} />
                  <Route path="/my-services" element={<div>My Services Page - Coming Soon</div>} />
                  <Route path="/services" element={<div>Services Page - Coming Soon</div>} />
                  
                  {/* Catch-all route - must be last */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
            <NotificationContainer />
          </div>
            </Router>
          </WalletProvider>
        </NotificationProvider>
      </StatusProvider>
    </AuthProvider>
  );
}

export default App;
