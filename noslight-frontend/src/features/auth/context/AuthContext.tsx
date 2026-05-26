import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '@/types/user';   // ← con @

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  hasRole: (roles: Role | Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ... resto del código igual (AuthProvider, useAuth, etc.)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('noslight_user');
    const storedToken = localStorage.getItem('noslight_token');

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (err) {
        console.error('Error parsing stored auth', err);
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User, authToken: string) => {
    localStorage.setItem('noslight_user', JSON.stringify(userData));
    localStorage.setItem('noslight_token', authToken);
    setUser(userData);
    setToken(authToken);
  };

  const logout = () => {
    localStorage.removeItem('noslight_user');
    localStorage.removeItem('noslight_token');
    setUser(null);
    setToken(null);
  };

  const hasRole = (allowed: Role | Role[]) => {
    if (!user) return false;
    const roles = Array.isArray(allowed) ? allowed : [allowed];
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};