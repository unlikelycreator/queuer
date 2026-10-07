import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '@/api/endpoints';
import { TOKEN_KEY, USER_KEY } from '@/api/axios';

const AuthContext = createContext(null);

function readUser() {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [loading, setLoading] = useState(true);

  const storeUser = (data) => {
    localStorage.setItem(USER_KEY, JSON.stringify(data));
    setUser(data);
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then((res) => storeUser(res.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const persistSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    const userData = { ...data };
    delete userData.token;
    storeUser(userData);
  };

  // Every login path may come back with { twoFactorRequired, tempToken } instead of a
  // session — callers then show the 2FA step and call verifyTwoFactor.
  const handleAuthResponse = (data) => {
    if (data.twoFactorRequired) return data;
    persistSession(data);
    return data;
  };

  const registerOwner = async (payload) => handleAuthResponse((await api.registerOwner(payload)).data);
  const joinCompany = async (payload) => handleAuthResponse((await api.joinCompany(payload)).data);
  const login = async (payload) => handleAuthResponse((await api.login(payload)).data);
  const googleAuth = async (payload) => handleAuthResponse((await api.googleAuth(payload)).data);
  const verifyTwoFactor = async (payload) => handleAuthResponse((await api.verifyTwoFactorLogin(payload)).data);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.getMe();
    storeUser(res.data);
    return res.data;
  }, []);

  // After a password change the server revokes older tokens and hands back a new one.
  const replaceToken = useCallback((token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        registerOwner,
        joinCompany,
        login,
        googleAuth,
        verifyTwoFactor,
        logout,
        refreshUser,
        replaceToken,
        isAdmin: user?.role === 'owner' || user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
