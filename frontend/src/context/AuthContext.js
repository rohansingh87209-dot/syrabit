import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'syrabit:token';

const getStoredToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
};
const setStoredToken = (token) => {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch {}
};
const buildAuthHeaders = () => {
  const t = getStoredToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, {
        withCredentials: true,
        headers: buildAuthHeaders(),
      });
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchMe();
      setLoading(false);
    };
    init();
  }, [fetchMe]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    const { access_token, user: userData } = res.data;
    setStoredToken(access_token);
    setUser(userData);
    try {
      const { Analytics } = await import('@/utils/analytics');
      Analytics.login(userData.id, userData.email);
    } catch {}
    return userData;
  };

  const signup = async (name, email, password) => {
    const res = await axios.post(`${API}/auth/signup`, { name, email, password }, { withCredentials: true });
    const { access_token, user: userData } = res.data;
    setStoredToken(access_token);
    setUser(userData);
    try {
      const { Analytics } = await import('@/utils/analytics');
      Analytics.signup(userData.email, userData.plan);
    } catch {}
    return userData;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true, headers: buildAuthHeaders() });
    } catch {}
    setStoredToken(null);
    localStorage.removeItem('syrabit:onboarding');
    setUser(null);
    try {
      import('@/utils/analytics').then(({ Analytics }) => Analytics.logout());
    } catch {}
  };

  const refreshUser = async () => {
    await fetchMe();
  };

  const token = getStoredToken();

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      signup,
      logout,
      refreshUser,
      authHeader: token ? { Authorization: `Bearer ${token}` } : {},
      API,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
