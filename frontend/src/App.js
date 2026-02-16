import './styles/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import Auth from './pages/Auth';
import SSOCallback from './pages/SSOCallback';
import Dashboard from './pages/Dashboard';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthSuccess from './pages/OAuthSuccess';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import QuestionGenerator from './pages/QuestionGenerator';

import ToastProvider from './components/ui/ToastProvider';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';

const clerkPubKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <ClerkProvider publishableKey={clerkPubKey}>
          <BrowserRouter>
            <ToastProvider />
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth />} />
              <Route path="/sso" element={<SSOCallback />} />
              <Route path="/sso-callback" element={<SSOCallback />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/oauth-success" element={<OAuthSuccess />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile/edit" 
                element={
                  <ProtectedRoute>
                    <ProfileEdit />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/questions/generate" 
                element={
                  <ProtectedRoute>
                    <QuestionGenerator />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </BrowserRouter>
        </ClerkProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;