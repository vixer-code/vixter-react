import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              {/* Placeholder routes for other pages */}
              <Route path="/vixies" element={<div>Vixies Page - Coming Soon</div>} />
              <Route path="/vixink" element={<div>Vixink Page - Coming Soon</div>} />
              <Route path="/feed" element={<div>Feed Page - Coming Soon</div>} />
              <Route path="/profile" element={<div>Profile Page - Coming Soon</div>} />
              <Route path="/settings" element={<div>Settings Page - Coming Soon</div>} />
              <Route path="/my-services" element={<div>My Services Page - Coming Soon</div>} />
              <Route path="/services" element={<div>Services Page - Coming Soon</div>} />
              <Route path="/wallet" element={<div>Wallet Page - Coming Soon</div>} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
