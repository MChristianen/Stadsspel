import React from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Join from './pages/Join';
import Waiting from './pages/Waiting';
import Game from './pages/Game';
import Admin from './pages/Admin';
import Leaderboard from './pages/Leaderboard';
import Speluitleg from './pages/Speluitleg';
import PublicResults from './pages/PublicResults';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Navigation: React.FC = () => {
  const { isAuthenticated, isAdmin, team, logout } = useAuth();

  return (
    <nav className="main-nav">
      <div className="nav-links">
        <Link to="/uitleg">Speluitleg</Link>
        {isAuthenticated && (
          <>
            {isAdmin && <Link to="/admin">Admin</Link>}
            <Link to="/">Spel</Link>
            <Link to="/leaderboard">Scorebord</Link>
          </>
        )}
        {!isAuthenticated && <Link to="/login">Inloggen</Link>}
      </div>
      {isAuthenticated && (
        <div className="nav-user">
          <span className="team-badge" style={{ backgroundColor: team?.color }}>
            {team?.name}
          </span>
          <button onClick={logout} className="btn-logout">
            Uitloggen
          </button>
        </div>
      )}
    </nav>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <div className="app">
              <Navigation />
              <main className="main-content">
                <Routes>
                  <Route path="/join/:joinCode" element={<Join />} />
                  <Route path="/join" element={<Join />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/uitleg" element={<Speluitleg />} />
                  <Route path="/results/:joinCode" element={<PublicResults />} />
                  <Route
                    path="/waiting"
                    element={
                      <ProtectedRoute>
                        <Waiting />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Game />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/leaderboard"
                    element={
                      <ProtectedRoute>
                        <Leaderboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute adminOnly>
                        <Admin />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/uitleg" replace />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
