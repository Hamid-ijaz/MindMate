
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/lib/types';
import Cookies from 'js-cookie';

type SignupData = Omit<User, 'password'> & { password?: string };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => boolean;
  signup: (userData: SignupData) => boolean;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'mindmate-users';
const AUTH_COOKIE_KEY = 'mindmate-auth';

const getStoredUsers = (): User[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = window.localStorage.getItem(USERS_STORAGE_KEY);
    return item ? JSON.parse(item) : [];
  } catch (error) {
    console.error('Error reading users from localStorage', error);
    return [];
  }
};

const setStoredUsers = (users: User[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Error writing users to localStorage', error);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userEmail = Cookies.get(AUTH_COOKIE_KEY);
    if (userEmail) {
      const users = getStoredUsers();
      const currentUser = users.find(u => u.email === userEmail);
      if (currentUser) {
        setUser(currentUser);
      }
    }
    setLoading(false);
  }, []);

  const login = (email: string, password: string): boolean => {
    const users = getStoredUsers();
    const foundUser = users.find(u => u.email === email && u.password === password);
    if (foundUser) {
      setUser(foundUser);
      Cookies.set(AUTH_COOKIE_KEY, foundUser.email, { expires: 7, path: '/' });
      return true;
    }
    return false;
  };

  const signup = (userData: SignupData): boolean => {
    const users = getStoredUsers();
    if (users.find(u => u.email === userData.email)) {
      return false; // User already exists
    }
    const newUser: User = { ...userData };
    const updatedUsers = [...users, newUser];
    setStoredUsers(updatedUsers);
    setUser(newUser);
    Cookies.set(AUTH_COOKIE_KEY, newUser.email, { expires: 7, path: '/' });
    return true;
  };

  const logout = () => {
    setUser(null);
    Cookies.remove(AUTH_COOKIE_KEY, { path: '/' });
  };
  
  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const users = getStoredUsers();
    const updatedUser = { ...user, ...updates };
    const updatedUsers = users.map(u => u.email === user.email ? updatedUser : u);
    setStoredUsers(updatedUsers);
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
