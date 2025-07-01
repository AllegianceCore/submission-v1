import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { DashboardHeader } from './DashboardHeader';
import { DailyReflections } from './DailyReflections';
import { HabitTracker } from './HabitTracker';
import { ProgressChart } from './ProgressChart';
import { QuickActions } from './QuickActions';
import { SettingsPage } from '../settings/SettingsPage';

export function Dashboard() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleReflectionSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const showSettings = () => setCurrentView('settings');
  const showDashboard = () => setCurrentView('dashboard');

  if (currentView === 'settings') {
    return <SettingsPage onBack={showDashboard} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        user={user} 
        profile={profile} 
        onSettingsClick={showSettings}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <DailyReflections onReflectionSaved={handleReflectionSaved} />
            <ProgressChart refreshTrigger={refreshTrigger} />
          </div>
          
          {/* Sidebar */}
          <div className="space-y-8">
            <QuickActions />
            <HabitTracker />
          </div>
        </div>
      </div>
    </div>
  );
}