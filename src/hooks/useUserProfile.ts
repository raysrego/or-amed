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
      // Para o admin rayannyrego@gmail.com, criar perfil se não existir
      if (user?.email === 'rayannyrego@gmail.com') {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', 'rayannyrego@gmail.com')
          .single();

        if (!existingProfile) {
          // Criar perfil admin
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert([{
              user_id: user.id,
              email: 'rayannyrego@gmail.com',
              name: 'Rayanny Rego - Administrador',
              role: 'admin',
              is_admin: true,
            }]);

          if (insertError) {
            console.error('Error creating admin profile:', insertError);
          }
        }
      }

      const result = await supabase
        .from('user_profiles')
        .select(`
          *,
          doctor:user_profiles!doctor_id(id, name, specialty, crm)
        `)
        .eq('user_id', user?.id)
        .single();

      if (result.error && result.error.code !== 'PGRST116') {
        throw result.error;
      }

      if (result.data) {
        setProfile(result.data);
      } else if (user?.email === 'rayannyrego@gmail.com') {
        // Fallback para admin
        setProfile({
          id: 'admin-temp',
          user_id: user.id,
          name: 'Rayanny Rego - Administrador',
          role: 'admin',
          is_admin: true,
          email: 'rayannyrego@gmail.com',
          created_at: new Date().toISOString(),
        } as UserProfile);
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