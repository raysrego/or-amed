import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../lib/userTypes';

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      // Se não há usuário, pare o loading
      setLoading(false);
      setProfile(null);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user?.id) {
      console.log('No user ID available for profile fetch');
      setProfile(null);
      setLoading(false);
      return;
    }

    setError(null);
    
    try {
      // Para o admin rayannyrego@gmail.com, criar perfil se não existir
      if (user?.email === 'rayannyrego@gmail.com') {
        console.log('Handling admin user profile...');
        
        // Primeiro, tenta buscar perfil existente
        const { data: existingProfile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', 'rayannyrego@gmail.com')
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('❌ Error fetching admin profile:', fetchError);
          throw fetchError;
        }

        if (!existingProfile || fetchError?.code === 'PGRST116') {
          console.log('Creating admin profile...');
          
          const { data: newProfile, error: insertError } = await supabase
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

          if (insertError) {
            console.error('❌ Error creating admin profile:', insertError);
            throw insertError;
          }

          if (newProfile) {
            console.log('Admin profile created successfully');
            setProfile(newProfile);
          } else {
            throw new Error('Failed to create admin profile');
          }
        } else if (existingProfile && (!existingProfile.is_admin || existingProfile.role !== 'admin')) {
          console.log('Updating existing profile to admin...');
          
          const { data: updatedProfile, error: updateError } = await supabase
            .from('user_profiles')
            .update({
              role: 'admin',
              is_admin: true,
              name: existingProfile.name || 'Rayanny Rego - Administrador'
            })
            .eq('email', 'rayannyrego@gmail.com')
            .select()
            .single();

          if (updateError) {
            console.error('❌ Error updating admin profile:', updateError);
            throw updateError;
          }

          if (updatedProfile) {
            console.log('Admin profile updated successfully');
            setProfile(updatedProfile);
          } else {
            throw new Error('Failed to update admin profile');
          }
        } else {
          console.log('Using existing admin profile');
          setProfile(existingProfile);
        }
      } else {
        // Para usuários regulares
        console.log('Fetching regular user profile for:', user.email);

        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.log('No profile found for user:', user.email);
            setProfile(null);
          } else {
            console.error('❌ Profile fetch error:', profileError);
            throw profileError;
          }
        } else {
          console.log('Profile loaded successfully for:', profileData.name);
          setProfile(profileData);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      
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
      } else {
        setProfile(null);
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
    error,
    isAdmin,
    isDoctor,
    isSecretary,
    hasRole,
    refetch: fetchProfile,
  };
}