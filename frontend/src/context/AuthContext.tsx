import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { authService, CurrentUserResponse } from '../services/api';
import { UserProfile, StaffProfile, PatientProfile, UserRole } from '../types';

import i18n from '../i18n/i18n';

interface AuthContextType {
  user: any | null;
  userProfile: UserProfile | null;
  staffProfile: StaffProfile | null;
  patientProfile: PatientProfile | null;
  role: UserRole | null;
  permissions: string[];
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<CurrentUserResponse | null>;
  updateUserLanguage: (newLang: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (): Promise<CurrentUserResponse | null> => {
    try {
      const data = await authService.getCurrentUser();
      if (data.is_initialized && data.user) {
        setUserProfile(data.user);
        setRole(data.role as UserRole);
        setPermissions(data.permissions || []);
        setStaffProfile(data.staff_profile || null);
        setPatientProfile(data.patient_profile || null);

        // Restore individual user's saved language preference if none chosen yet in session
        const sessionLang = localStorage.getItem('hms_language_preference');
        const userLang = data.user.preferred_language || sessionLang || 'en';
        if (i18n.language !== userLang) {
          await i18n.changeLanguage(userLang);
        }
        try {
          localStorage.setItem('hms_language_preference', userLang);
        } catch (e) {
          // Ignore
        }
      }
      return data;
    } catch (err) {
      console.warn('Unable to retrieve user profile from backend:', err);
      return null;
    }
  };

  const updateUserLanguage = async (newLang: string) => {
    await i18n.changeLanguage(newLang);
    try {
      localStorage.setItem('hms_language_preference', newLang);
    } catch (e) {}

    if (userProfile) {
      setUserProfile((prev) => (prev ? { ...prev, preferred_language: newLang } : null));
      try {
        await authService.updatePreferences({ preferred_language: newLang });
      } catch (err) {
        console.warn('Failed to persist language preference to backend:', err);
      }
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile();
      } else {
        setUserProfile(null);
        setStaffProfile(null);
        setPatientProfile(null);
        setRole(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    setStaffProfile(null);
    setPatientProfile(null);
    setRole(null);
    setPermissions([]);
  };

  const refreshProfile = async () => {
    return await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        staffProfile,
        patientProfile,
        role,
        permissions,
        loading,
        logout,
        refreshProfile,
        updateUserLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
