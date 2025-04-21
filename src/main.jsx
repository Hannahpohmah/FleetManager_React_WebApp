import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import LandingPage from './LandingPage.jsx'
import App from './App.jsx'

// Simple authentication check
const PrivateRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? children : <Navigate to="/" />;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route 
          path="/app" 
          element={
            <PrivateRoute>
              <App />
            </PrivateRoute>
          } 
        />
      </Routes>
    </Router>
  </StrictMode>,
)
