import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../lib/userTypes';

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const result = await supabase
        .from('user_profiles')
        .select(`
          *,
          doctor:user_profiles!doctor_id(*)
        `)
        .eq('user_id', user?.id)
        .single();

      if (result.error && result.error.code !== 'PGRST116') {
        throw result.error;
      }

      if (result.data) {
        setProfile(result.data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = () => profile?.is_admin === true;
  const isDoctor = () => profile?.role === 'doctor';
  const isSecretary = () => profile?.role === 'secretary';
  const hasRole = (roles: string[]) => profile?.role ? roles.includes(profile.role) : false;

  return {
    profile,
    loading,
    isAdmin,
    isDoctor,
    isSecretary,
    hasRole,
    refetch: fetchProfile,
  };
}