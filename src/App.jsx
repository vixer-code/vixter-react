import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { StatusProvider } from './contexts/StatusContext';
import { UserProvider } from './contexts/UserContext';
import { WalletProvider } from './contexts/WalletContext';
import { PacksProviderR2 as PacksProvider } from './contexts/PacksContextR2';
import { ServicesProviderR2 as ServicesProvider } from './contexts/ServicesContextR2';
import { CentrifugoProvider } from './contexts/CentrifugoContext';
import { EnhancedMessagingProvider as MessagingProvider } from './contexts/EnhancedMessagingContext';
import { ServiceOrderProvider } from './contexts/ServiceOrderContext';
import { PackOrderProvider } from './contexts/PackOrderContext';
import { ReviewProvider } from './contexts/ReviewContext';
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
const Messages = lazy(() => import('./pages/EnhancedMessages'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthAction = lazy(() => import('./pages/AuthAction'));
const HandleAuthAction = lazy(() => import('./pages/HandleAuthAction'));
const Vixies = lazy(() => import('./pages/Vixies'));
const Vixink = lazy(() => import('./pages/Vixink'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const MyServices = lazy(() => import('./pages/MyProducts'));
const MyPurchases = lazy(() => import('./pages/MyPurchases'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const PackDetail = lazy(() => import('./pages/PackDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const Success = lazy(() => import('./pages/Success'));
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
          <UserProvider>
            <WalletProvider>
              <PacksProvider>
                <ServicesProvider>
                  <ServiceOrderProvider>
                    <PackOrderProvider>
                      <ReviewProvider>
                        <CentrifugoProvider>
                          <MessagingProvider>
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
                                <Route path="/profile/:username" element={<Profile />} />
                                <Route path="/wallet" element={<Wallet />} />
                                <Route path="/messages" element={<Messages />} />
                                <Route path="/verify-email" element={<VerifyEmail />} />
                                <Route path="/forgot-password" element={<ForgotPassword />} />
                                <Route path="/reset-password" element={<ResetPassword />} />
                                <Route path="/auth-action" element={<AuthAction />} />
                                <Route path="/handle-auth-action" element={<HandleAuthAction />} />
                                <Route path="/vixies" element={<Vixies />} />
                                <Route path="/vixink" element={<Vixink />} />
                                <Route path="/search" element={<SearchResults />} />
                                <Route path="/my-services" element={<MyServices />} />
                                <Route path="/my-purchases" element={<MyPurchases />} />
                                <Route path="/service/:serviceId" element={<ServiceDetail />} />
                                <Route path="/pack/:packId" element={<PackDetail />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/success" element={<Success />} />
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
                          </MessagingProvider>
                        </CentrifugoProvider>
                      </ReviewProvider>
                    </PackOrderProvider>
                  </ServiceOrderProvider>
                </ServicesProvider>
              </PacksProvider>
            </WalletProvider>
          </UserProvider>
        </NotificationProvider>
      </StatusProvider>
    </AuthProvider>
  );
}

export default App;
