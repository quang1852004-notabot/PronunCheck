'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/app/firebase';

interface AuthContextType {
  user: User | null;
  userRole: 'student' | 'teacher' | null;
  loading: boolean;
  login: (e: string, p: string) => Promise<'student' | 'teacher' | null>;
  register: (e: string, p: string, role: 'student' | 'teacher') => Promise<void>;
  logout: () => Promise<void>;
  setUserRole: (role: 'student' | 'teacher' | null) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            setUserRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string): Promise<'student' | 'teacher' | null> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const currentUser = userCredential.user;
      setUser(currentUser);
      
      let role: 'student' | 'teacher' | null = null;
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          role = userDoc.data().role as 'student' | 'teacher';
          setUserRole(role);
        } else {
          setUserRole(null);
        }
      } catch (err) {
        console.error("Error fetching user role on login:", err);
        setUserRole(null);
      }
      return role;
    } finally {
      setLoading(false);
    }
  };
  
  const register = async (email: string, pass: string, role: 'student' | 'teacher') => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        role
      });
      setUser(userCredential.user);
      setUserRole(role);
    } finally {
      setLoading(false);
    }
  };
  
  const logout = async () => {
    setUser(null);
    setUserRole(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, login, register, logout, setUserRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
