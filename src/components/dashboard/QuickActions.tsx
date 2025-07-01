import React from 'react';
import { Video, Volume2, BookOpen, Award, Brain, Sparkles, TrendingUp, Dumbbell } from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import { Modal } from '../ui/Modal';
import { WeeklyRecapModal } from './WeeklyRecapModal';
import { VoiceLibraryModal } from './VoiceLibraryModal';
import { ReflectionHistoryModal } from './ReflectionHistoryModal';
import { AchievementsModal } from './AchievementsModal';
import { AIRecapsModal } from './AIRecapsModal';
import { AIStylistRecapModal } from './AIStylistRecapModal';
import { GrowthReportsModal } from './GrowthReportsModal';
import { BodyCoachRecapModal } from './BodyCoachRecapModal';

export function QuickActions() {
  const weeklyRecapModal = useModal();
  const voiceLibraryModal = useModal();
  const reflectionHistoryModal = useModal();
  const achievementsModal = useModal();
  const aiRecapsModal = useModal();
  const aiStylistRecapModal = useModal();
  const growthReportsModal = useModal();
  const bodyCoachRecapModal = useModal();

  const actions = [
    {
      icon: Brain,
      label: 'AI Insights',
      description: 'Get personalized AI-powered recaps and coaching',
      color: 'from-purple-500 to-purple-600',
      action: aiRecapsModal.open,
    },
    {
      icon: TrendingUp,
      label: 'Growth Reports',
      description: 'Review your saved AI insights over time',
      color: 'from-indigo-500 to-purple-600',
      action: growthReportsModal.open,
      emoji: '📈',
    },
    {
      icon: Sparkles,
      label: 'Style Journal',
      description: 'Get AI feedback on your outfits and browse history',
      color: 'from-pink-500 to-rose-600',
      action: aiStylistRecapModal.open,
      emoji: '👗',
    },
    {
      icon: Dumbbell,
      label: 'AI Body Coach',
      description: 'Get personalized coaching plans and track your progress over time',
      color: 'from-blue-500 to-indigo-600',
      action: bodyCoachRecapModal.open,
      emoji: '💪',
    },
    {
      icon: Video,
      label: 'Weekly Recap',
      description: 'View your AI-generated video summary',
      color: 'from-indigo-500 to-indigo-600',
      action: weeklyRecapModal.open,
    },
    {
      icon: Volume2,
      label: 'Voice Library',
      description: 'Listen to your reflection recordings',
      color: 'from-green-500 to-green-600',
      action: voiceLibraryModal.open,
    },
    {
      icon: BookOpen,
      label: 'Reflection History',
      description: 'Browse past reflections',
      color: 'from-blue-500 to-blue-600',
      action: reflectionHistoryModal.open,
    },
    {
      icon: Award,
      label: 'Achievements',
      description: 'See your milestones and rewards',
      color: 'from-orange-500 to-orange-600',
      action: achievementsModal.open,
    },
  ];

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        
        <div className="space-y-3">
          {actions.map((action, index) => {
            const Icon = action.icon;
            
            return (
              <button
                key={index}
                onClick={action.action}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left group"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  {action.emoji ? (
                    <span className="text-2xl">{action.emoji}</span>
                  ) : (
                    <Icon className="w-6 h-6 text-white" />
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {action.label}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={aiRecapsModal.isOpen}
        onClose={aiRecapsModal.close}
        title="AI-Powered Insights"
        size="lg"
      >
        <AIRecapsModal
          isOpen={aiRecapsModal.isOpen}
          onClose={aiRecapsModal.close}
        />
      </Modal>

      <Modal
        isOpen={growthReportsModal.isOpen}
        onClose={growthReportsModal.close}
        title=""
        size="lg"
      >
        <GrowthReportsModal
          isOpen={growthReportsModal.isOpen}
          onClose={growthReportsModal.close}
        />
      </Modal>

      <Modal
        isOpen={aiStylistRecapModal.isOpen}
        onClose={aiStylistRecapModal.close}
        title=""
        size="lg"
      >
        <AIStylistRecapModal
          isOpen={aiStylistRecapModal.isOpen}
          onClose={aiStylistRecapModal.close}
        />
      </Modal>

      <Modal
        isOpen={bodyCoachRecapModal.isOpen}
        onClose={bodyCoachRecapModal.close}
        title=""
        size="lg"
      >
        <BodyCoachRecapModal
          isOpen={bodyCoachRecapModal.isOpen}
          onClose={bodyCoachRecapModal.close}
        />
      </Modal>

      <Modal
        isOpen={weeklyRecapModal.isOpen}
        onClose={weeklyRecapModal.close}
        title="Weekly Recap"
        size="lg"
      >
        <WeeklyRecapModal
          isOpen={weeklyRecapModal.isOpen}
          onClose={weeklyRecapModal.close}
        />
      </Modal>

      <Modal
        isOpen={voiceLibraryModal.isOpen}
        onClose={voiceLibraryModal.close}
        title="Voice Library"
        size="lg"
      >
        <VoiceLibraryModal
          isOpen={voiceLibraryModal.isOpen}
          onClose={voiceLibraryModal.close}
        />
      </Modal>

      <Modal
        isOpen={reflectionHistoryModal.isOpen}
        onClose={reflectionHistoryModal.close}
        title="Reflection History"
        size="lg"
      >
        <ReflectionHistoryModal
          isOpen={reflectionHistoryModal.isOpen}
          onClose={reflectionHistoryModal.close}
        />
      </Modal>

      <Modal
        isOpen={achievementsModal.isOpen}
        onClose={achievementsModal.close}
        title="Achievements"
        size="lg"
      >
        <AchievementsModal
          isOpen={achievementsModal.isOpen}
          onClose={achievementsModal.close}
        />
      </Modal>
    </>
  );
}