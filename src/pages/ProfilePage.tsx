// ProfilePage - Senior-friendly profile management with photo upload
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { useNavigate } from 'react-router-dom';
import { Camera, Trophy, Calendar, Heart, Settings, User } from 'lucide-react';
import SmartBackButton from '../components/ui/SmartBackButton';

interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  created_at: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  timezone?: string;
}

const ProfilePage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [trophyCount, setTrophyCount] = useState(0);
  const [checkInCount, setCheckInCount] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Load trivia trophy count
      const { data: trophies } = await supabase
        .from('user_trivia_trophies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (trophies) setTrophyCount(trophies.length || 0);

      // Load check-in count
      const { count: checkIns } = await supabase
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setCheckInCount(checkIns || 0);
    } catch (error) {

    }
  }, [user?.id, supabase]);

  useEffect(() => {
    if (user?.id) {
      loadProfile();
      loadStats();
    }
  }, [user?.id, loadProfile, loadStats]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user?.id || !profile) {
      return;
    }

    const file = event.target.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be smaller than 5MB' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: urlData.publicUrl });
      setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
    } catch (error: any) {

      setMessage({ type: 'error', text: 'Failed to upload photo. Please try again.' });
    } finally {
      setUploading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const getInitials = () => {
    if (!profile) return 'U';
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: branding.gradient }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4" style={{ borderColor: branding.primaryColor }}></div>
          <p className="text-xl text-white">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: branding.gradient }}>
        <div className="text-center">
          <p className="text-xl text-white">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: branding.gradient }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <SmartBackButton label="Back to Dashboard" />
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl text-center font-semibold text-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border-2 border-green-300' : 'bg-red-100 text-red-800 border-2 border-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Profile Photo */}
            <div className="shrink-0">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-40 h-40 rounded-full object-cover border-4"
                    style={{ borderColor: branding.secondaryColor }}
                  />
                ) : (
                  <div
                    className="w-40 h-40 rounded-full flex items-center justify-center text-white text-5xl font-bold border-4"
                    style={{ backgroundColor: branding.primaryColor, borderColor: branding.secondaryColor }}
                  >
                    {getInitials()}
                  </div>
                )}

                {/* Camera Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition hover:scale-110 disabled:opacity-50"
                  style={{ backgroundColor: branding.secondaryColor }}
                >
                  <Camera size={24} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {uploading && (
                <p className="text-center mt-3 text-sm font-semibold" style={{ color: branding.primaryColor }}>
                  Uploading...
                </p>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-bold mb-2" style={{ color: branding.primaryColor }}>
                {profile.first_name} {profile.last_name}
              </h1>

              <div className="space-y-2 text-lg text-gray-700 mb-6">
                {profile.phone && (
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <span className="font-semibold">📱 Phone:</span> {profile.phone}
                  </p>
                )}
                {profile.email && (
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <span className="font-semibold">📧 Email:</span> {profile.email}
                  </p>
                )}
                <p className="flex items-center justify-center md:justify-start gap-2">
                  <Calendar size={20} style={{ color: branding.secondaryColor }} />
                  <span className="font-semibold">Member since:</span> {formatDate(profile.created_at)}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center justify-center gap-2 px-6 py-3 text-white font-bold rounded-xl transition shadow-lg hover:scale-105"
                  style={{ background: `linear-gradient(90deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%)` }}
                >
                  <Settings size={20} />
                  Edit Settings
                </button>

                <button
                  onClick={() => navigate('/change-password')}
                  className="flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition shadow-lg hover:scale-105"
                  style={{ backgroundColor: `${branding.primaryColor}10`, color: branding.primaryColor, border: `2px solid ${branding.primaryColor}` }}
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Achievements */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border-2" style={{ borderColor: branding.secondaryColor }}>
            <div className="flex items-center gap-3 mb-4">
              <Trophy size={32} style={{ color: branding.secondaryColor }} />
              <h2 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>Achievements</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 rounded-xl" style={{ backgroundColor: `${branding.secondaryColor}15` }}>
                <span className="text-lg font-semibold text-gray-800">Trivia Trophies</span>
                <span className="text-2xl font-bold" style={{ color: branding.secondaryColor }}>{trophyCount}</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl" style={{ backgroundColor: `${branding.primaryColor}10` }}>
                <span className="text-lg font-semibold text-gray-800">Check-ins Completed</span>
                <span className="text-2xl font-bold" style={{ color: branding.primaryColor }}>{checkInCount}</span>
              </div>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border-2" style={{ borderColor: branding.primaryColor }}>
            <div className="flex items-center gap-3 mb-4">
              <Heart size={32} style={{ color: branding.primaryColor }} />
              <h2 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>Emergency Contact</h2>
            </div>
            {profile.emergency_contact_name || profile.emergency_contact_phone ? (
              <div className="space-y-3">
                {profile.emergency_contact_name && (
                  <div className="p-4 rounded-xl" style={{ backgroundColor: `${branding.primaryColor}10` }}>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Name</p>
                    <p className="text-lg font-bold text-gray-900">{profile.emergency_contact_name}</p>
                  </div>
                )}
                {profile.emergency_contact_phone && (
                  <div className="p-4 rounded-xl" style={{ backgroundColor: `${branding.primaryColor}10` }}>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Phone</p>
                    <p className="text-lg font-bold text-gray-900">{profile.emergency_contact_phone}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600 mb-4">No emergency contact set</p>
                <button
                  onClick={() => navigate('/settings')}
                  className="px-6 py-3 font-bold rounded-xl transition"
                  style={{ backgroundColor: branding.secondaryColor, color: 'white' }}
                >
                  Add Emergency Contact
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <User size={32} style={{ color: branding.primaryColor }} />
            <h2 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>Account Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl" style={{ backgroundColor: `${branding.secondaryColor}15` }}>
              <p className="text-sm font-semibold text-gray-600 mb-1">Timezone</p>
              <p className="text-lg font-bold text-gray-900">{profile.timezone || 'Not set'}</p>
            </div>

            <div className="p-4 rounded-xl" style={{ backgroundColor: `${branding.primaryColor}10` }}>
              <p className="text-sm font-semibold text-gray-600 mb-1">Account Status</p>
              <p className="text-lg font-bold" style={{ color: branding.secondaryColor }}>Active</p>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-6 p-6 rounded-xl border-2" style={{ backgroundColor: `${branding.primaryColor}10`, borderColor: branding.primaryColor }}>
            <h3 className="text-xl font-bold mb-3" style={{ color: branding.primaryColor }}>Need Help?</h3>
            <p className="text-gray-700 mb-4">
              Our support team is here to help you with any questions or concerns.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:1-800-WELLFIT"
                className="flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition text-center"
                style={{ backgroundColor: branding.primaryColor, color: 'white' }}
              >
                📞 Call Support
              </a>
              <button
                onClick={() => navigate('/help')}
                className="px-6 py-3 font-bold rounded-xl transition"
                style={{ backgroundColor: branding.secondaryColor, color: 'white' }}
              >
                📚 Help Center
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
