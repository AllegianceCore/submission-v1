import React from 'react';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../../lib/supabase';
import { LogOut, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface DashboardHeaderProps {
  user: User | null;
  profile: UserProfile | null;
  onSettingsClick: () => void;
}

export function DashboardHeader({ user, profile, onSettingsClick }: DashboardHeaderProps) {
  const { signOut } = useAuth();
  const currentHour = new Date().getHours();
  
  const getGreeting = () => {
    if (currentHour < 12) return 'Good morning';
    if (currentHour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-white border-b border-gray-200 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AiCareOfYou</h1>
            </div>
          </div>

          {/* Greeting and User Menu */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">{getGreeting()},</p>
              <p className="font-semibold text-gray-900">
                {profile?.full_name || user?.email?.split('@')[0] || 'there'}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={onSettingsClick}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}