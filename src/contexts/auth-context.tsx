
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/lib/types';
import { userService } from '@/lib/firestore';
import Cookies from 'js-cookie';

type SignupData = Omit<User, 'password'> & { password?: string };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (userData: SignupData) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_COOKIE_KEY = 'mindmate-auth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    const initializeAuth = async () => {
      if (isDemo) {
        // Demo mode - create a test user automatically
        const demoUser: User = {
          firstName: 'Demo',
          lastName: 'User',
          email: 'demo@example.com',
        };
        setUser(demoUser);
        // Set the auth cookie for middleware
        Cookies.set(AUTH_COOKIE_KEY, demoUser.email, { expires: 7, path: '/' });
        setLoading(false);
        return;
      }

      const userEmail = Cookies.get(AUTH_COOKIE_KEY);
      if (userEmail) {
        try {
          const currentUser = await userService.getUser(userEmail);
          if (currentUser) {
            setUser(currentUser);
          } else {
            // User not found in Firestore, clear cookie
            Cookies.remove(AUTH_COOKIE_KEY, { path: '/' });
          }
        } catch (error) {
          console.error('Error fetching user:', error);
          Cookies.remove(AUTH_COOKIE_KEY, { path: '/' });
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, [isDemo]);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (isDemo) {
      // Demo mode - always succeed
      const demoUser: User = {
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
      };
      setUser(demoUser);
      return true;
    }

    try {
      const foundUser = await userService.getUser(email);
      if (foundUser && foundUser.password === password) {
        setUser(foundUser);
        Cookies.set(AUTH_COOKIE_KEY, foundUser.email, { expires: 7, path: '/' });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    }
  };

  const signup = async (userData: SignupData): Promise<boolean> => {
    if (isDemo) {
      // Demo mode - always succeed
      const demoUser: User = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        dob: userData.dob,
      };
      setUser(demoUser);
      return true;
    }

    try {
      const userExists = await userService.userExists(userData.email);
      if (userExists) {
        return false; // User already exists
      }
      
      const newUser: User = { ...userData };
      await userService.createUser(newUser);
      setUser(newUser);
      Cookies.set(AUTH_COOKIE_KEY, newUser.email, { expires: 7, path: '/' });
      return true;
    } catch (error) {
      console.error('Error during signup:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    Cookies.remove(AUTH_COOKIE_KEY, { path: '/' });
  };
  
  const updateUser = async (updates: Partial<User>): Promise<void> => {
    if (!user) return;
    
    try {
      await userService.updateUser(user.email, updates);
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

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
