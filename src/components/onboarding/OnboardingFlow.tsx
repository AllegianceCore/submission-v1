import React, { useState } from 'react';
import { ArrowRight, Target, Heart, Zap, CheckCircle } from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';

const GOAL_OPTIONS = [
  { id: 'fitness', name: 'Improve Physical Fitness', icon: Zap, color: 'text-orange-500' },
  { id: 'mindfulness', name: 'Practice Mindfulness', icon: Heart, color: 'text-pink-500' },
  { id: 'productivity', name: 'Boost Productivity', icon: Target, color: 'text-blue-500' },
  { id: 'sleep', name: 'Better Sleep Habits', icon: Heart, color: 'text-purple-500' },
  { id: 'learning', name: 'Learn New Skills', icon: Target, color: 'text-green-500' },
  { id: 'relationships', name: 'Strengthen Relationships', icon: Heart, color: 'text-red-500' },
];

export function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { updateProfile } = useUserProfile();

  const handleGoalToggle = (goalId: string) => {
    setSelectedGoals(prev => 
      prev.includes(goalId) 
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateProfile({
        goals: selectedGoals,
        onboarding_completed: true,
      });
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-12">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
              <Heart className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              Welcome to AiCareOfYou!
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Your personal AI companion for transformation and growth. 
              We'll help you build better habits, reflect on your journey, 
              and achieve your goals with personalized insights.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="p-6 bg-blue-50 rounded-2xl">
                <Heart className="w-8 h-8 text-blue-600 mb-3 mx-auto" />
                <h3 className="font-semibold text-gray-900 mb-2">Daily Reflections</h3>
                <p className="text-sm text-gray-600">Record your thoughts and track your mood</p>
              </div>
              
              <div className="p-6 bg-green-50 rounded-2xl">
                <Target className="w-8 h-8 text-green-600 mb-3 mx-auto" />
                <h3 className="font-semibold text-gray-900 mb-2">Habit Tracking</h3>
                <p className="text-sm text-gray-600">Build streaks and celebrate milestones</p>
              </div>
              
              <div className="p-6 bg-purple-50 rounded-2xl">
                <Zap className="w-8 h-8 text-purple-600 mb-3 mx-auto" />
                <h3 className="font-semibold text-gray-900 mb-2">AI Insights</h3>
                <p className="text-sm text-gray-600">Get personalized coaching and recaps</p>
              </div>
            </div>
            
            <button
              onClick={() => setStep(2)}
              className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-green-700 transition-all inline-flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What are your main goals?
            </h2>
            <p className="text-gray-600">
              Select the areas you'd like to focus on. You can always adjust these later.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {GOAL_OPTIONS.map((goal) => {
              const Icon = goal.icon;
              const isSelected = selectedGoals.includes(goal.id);
              
              return (
                <button
                  key={goal.id}
                  onClick={() => handleGoalToggle(goal.id)}
                  className={`p-6 rounded-2xl border-2 transition-all text-left relative ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon className={`w-8 h-8 ${goal.color}`} />
                    <span className="font-medium text-gray-900">{goal.name}</span>
                  </div>
                  
                  {isSelected && (
                    <CheckCircle className="w-6 h-6 text-blue-500 absolute top-4 right-4" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => setStep(1)}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              Back
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                disabled={loading}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-300 transition-all"
              >
                Skip for now
              </button>
              
              <button
                onClick={handleComplete}
                disabled={selectedGoals.length === 0 || loading}
                className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
              >
                {loading ? 'Setting up...' : 'Continue'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}