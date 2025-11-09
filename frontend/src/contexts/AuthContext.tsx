import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  verifyAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Verify authentication on mount
  useEffect(() => {
    verifyAuth();
  }, []);

  const verifyAuth = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/auth/verify`, {
        withCredentials: true
      });
      setIsAuthenticated(response.data.authenticated || false);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/login`,
        { username, password },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        setIsAuthenticated(true);
        if (response.data.token) {
          // Store token for Authorization header
          localStorage.setItem('authToken', response.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        }
        return true;
      }
      return false;
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.message.includes('ERR_CONNECTION_REFUSED')) {
        console.error('❌ Backend server is not running! Please start the backend server first.');
        console.error('💡 To start the backend: cd backend && npm run dev');
        // Don't show alert for connection refused - user will see error in UI
      } else if (error.response?.status === 401) {
        console.error('Login failed: Invalid credentials');
        // Credential error will be shown in login form
      } else {
        console.error('Login failed:', error.response?.data || error.message);
      }
      setIsAuthenticated(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsAuthenticated(false);
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Set up axios defaults
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    axios.defaults.withCredentials = true;
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, verifyAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
