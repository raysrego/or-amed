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
    if (!user?.id) {
      console.log('No user ID available for profile fetch');
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      // Para o admin rayannyrego@gmail.com, criar perfil se não existir
      if (user?.email === 'rayannyrego@gmail.com') {
        console.log('Handling admin user profile...');
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', 'rayannyrego@gmail.com')
          .single();

        if (!existingProfile) {
          console.log('Creating admin profile...');
          // Criar perfil admin
          const { data: newProfile } = await supabase
            .from('user_profiles')
            .insert({
              user_id: user.id,
              email: 'rayannyrego@gmail.com',
              name: 'Rayanny Rego - Administrador',
              role: 'admin',
              is_admin: true,
            })
            .select()
            .single();

          if (newProfile) {
            console.log('Admin profile created successfully');
            setProfile(newProfile);
            return;
          }
        } else if (existingProfile && (!existingProfile.is_admin || existingProfile.role !== 'admin')) {
          console.log('Updating existing profile to admin...');
          // Atualizar perfil existente para admin
          const { data: updatedProfile } = await supabase
            .from('user_profiles')
            .update({
              role: 'admin',
              is_admin: true,
              name: existingProfile.name || 'Rayanny Rego - Administrador'
            })
            .eq('email', 'rayannyrego@gmail.com')
            .select()
            .single();

          if (updatedProfile) {
            console.log('Admin profile updated successfully');
            setProfile(updatedProfile);
            return;
          }
        } else {
          console.log('Using existing admin profile');
          setProfile(existingProfile);
          return;
        }
      }

      console.log('Fetching regular user profile for:', user.email);

      const result = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (result.error && result.error.code !== 'PGRST116') {
        console.error('❌ Profile fetch error:', result.error.message);
      }

      if (result.data) {
        console.log('Profile loaded successfully for:', result.data.name);
        setProfile(result.data);
      } else if (user?.email === 'rayannyrego@gmail.com') {
        console.log('Using fallback admin profile');
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
      } else {
        console.log('No profile found for user:', user.email);
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      // Fallback para admin em caso de erro
      if (user?.email === 'rayannyrego@gmail.com') {
        console.log('Using error fallback admin profile');
        setProfile({
          id: 'admin-fallback',
          user_id: user.id,
          name: 'Rayanny Rego - Administrador',
          role: 'admin',
          is_admin: true,
          email: 'rayannyrego@gmail.com',
          created_at: new Date().toISOString(),
        } as UserProfile);
      }
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = () => profile?.is_admin === true || user?.email === 'rayannyrego@gmail.com';
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