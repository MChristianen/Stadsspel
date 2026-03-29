import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../services/api';
import type { Team, AuthResponse } from '../types/api';

interface AuthContextType {
  team: Team | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (name: string, password: string) => Promise<Team>;
  register: (name: string, password: string, gameSessionId?: number) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = apiClient.getToken();
    const storedTeam = localStorage.getItem('team');
    
    if (token && storedTeam) {
      try {
        const parsedTeam = JSON.parse(storedTeam);
        
        // If game_session_id is missing, force re-login to get it (but not for admin)
        if (!parsedTeam.is_admin && (parsedTeam.game_session_id === undefined || parsedTeam.game_session_id === null)) {
          console.warn('Team missing game_session_id - redirecting to login');
          apiClient.clearToken();
          localStorage.removeItem('team');
          setLoading(false);
          // Redirect to login page with a message
          window.location.href = '/login?expired=true';
          return;
        }
        
        setTeam(parsedTeam);
      } catch (error) {
        console.error('Failed to parse stored team:', error);
        apiClient.clearToken();
        localStorage.removeItem('team');
      }
    }
    setLoading(false);
  }, []);

  const handleAuthResponse = (response: AuthResponse) => {
    apiClient.setToken(response.access_token);
    const teamData: Team = {
      id: response.team_id,
      name: response.team_name,
      color: response.team_color,
      is_admin: response.is_admin,
      game_session_id: response.game_session_id,
      created_at: new Date().toISOString(),
    };
    setTeam(teamData);
    localStorage.setItem('team', JSON.stringify(teamData));
  };

  const login = async (name: string, password: string): Promise<Team> => {
    const response = await apiClient.login({ name, password });
    handleAuthResponse(response);
    const teamData: Team = {
      id: response.team_id,
      name: response.team_name,
      color: response.team_color,
      is_admin: response.is_admin,
      game_session_id: response.game_session_id,
      created_at: new Date().toISOString(),
    };
    return teamData;
  };

  const register = async (name: string, password: string, gameSessionId?: number) => {
    const response = await apiClient.register({ 
      name, 
      password,
      game_session_id: gameSessionId 
    });
    handleAuthResponse(response);
  };

  const logout = () => {
    apiClient.clearToken();
    localStorage.removeItem('team');
    setTeam(null);
  };

  const value: AuthContextType = {
    team,
    isAuthenticated: !!team,
    isAdmin: team?.is_admin || false,
    login,
    register,
    logout,
    loading,
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Laden...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
