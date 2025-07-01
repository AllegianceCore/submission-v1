import React from 'react';
import { useAuth } from './hooks/useAuth';
import { useUserProfile } from './hooks/useUserProfile';
import { AuthPage } from './components/auth/AuthPage';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { Dashboard } from './components/dashboard/Dashboard';

function App() {
  const { loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();

  // Show loading state
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ThriveCoach...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!profile) {
    return <AuthPage />;
  }

  // Show onboarding if not completed
  if (!profile.onboarding_completed) {
    return <OnboardingFlow />;
  }

  // Show main dashboard
  return <Dashboard />;
}

export default App;