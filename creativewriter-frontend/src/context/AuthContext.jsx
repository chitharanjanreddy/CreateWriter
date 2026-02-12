import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cw_token');
    if (token) {
      api.setToken(token);
      api.getMe()
        .then(res => setUser(res.data))
        .catch(() => { api.setToken(''); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    api.setToken(res.token);
    setUser(res.data);
    return res;
  };

  const register = async (body) => {
    const res = await api.register(body);
    api.setToken(res.token);
    setUser(res.data);
    return res;
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    api.setToken('');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      setUser(res.data);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
