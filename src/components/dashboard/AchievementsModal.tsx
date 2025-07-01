import React, { useState, useEffect } from 'react';
import { Award, Target, Calendar, Flame, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  achieved: boolean;
  progress?: number;
  target?: number;
  color: string;
}

export function AchievementsModal({ isOpen, onClose }: AchievementsModalProps) {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState({
    totalReflections: 0,
    longestStreak: 0,
    currentStreak: 0,
    totalHabits: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      fetchAchievements();
    }
  }, [isOpen, user]);

  const fetchAchievements = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch reflections count
      const { count: reflectionCount } = await supabase
        .from('reflections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch habit data for streak calculation
      const { data: habitCompletions } = await supabase
        .from('habit_completions')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      // Fetch habits count
      const { count: habitCount } = await supabase
        .from('habits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Calculate streaks
      const { longestStreak, currentStreak } = calculateStreaks(habitCompletions || []);

      const userStats = {
        totalReflections: reflectionCount || 0,
        longestStreak,
        currentStreak,
        totalHabits: habitCount || 0,
      };

      setStats(userStats);
      setAchievements(generateAchievements(userStats));
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreaks = (completions: { completed_at: string }[]) => {
    if (completions.length === 0) return { longestStreak: 0, currentStreak: 0 };

    // Group completions by date
    const dates = [...new Set(completions.map(c => c.completed_at))].sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    let longestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 1;

    // Calculate current streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (dates[0] === today || dates[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const current = new Date(dates[i - 1]);
        const next = new Date(dates[i]);
        const diffTime = current.getTime() - next.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    for (let i = 1; i < dates.length; i++) {
      const current = new Date(dates[i - 1]);
      const next = new Date(dates[i]);
      const diffTime = current.getTime() - next.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { longestStreak, currentStreak };
  };

  const generateAchievements = (stats: typeof stats): Achievement[] => [
    {
      id: 'first-reflection',
      title: 'First Steps',
      description: 'Record your first reflection',
      icon: Target,
      achieved: stats.totalReflections >= 1,
      color: 'text-blue-600',
    },
    {
      id: 'week-reflections',
      title: 'Week Warrior',
      description: 'Record reflections for 7 days',
      icon: Calendar,
      achieved: stats.totalReflections >= 7,
      progress: stats.totalReflections,
      target: 7,
      color: 'text-green-600',
    },
    {
      id: 'month-reflections',
      title: 'Monthly Master',
      description: 'Record reflections for 30 days',
      icon: TrendingUp,
      achieved: stats.totalReflections >= 30,
      progress: stats.totalReflections,
      target: 30,
      color: 'text-purple-600',
    },
    {
      id: 'first-habit',
      title: 'Habit Builder',
      description: 'Create your first habit',
      icon: Target,
      achieved: stats.totalHabits >= 1,
      color: 'text-orange-600',
    },
    {
      id: 'week-streak',
      title: 'Streak Starter',
      description: 'Maintain a 7-day habit streak',
      icon: Flame,
      achieved: stats.longestStreak >= 7,
      progress: stats.longestStreak,
      target: 7,
      color: 'text-red-600',
    },
    {
      id: 'month-streak',
      title: 'Consistency Champion',
      description: 'Maintain a 30-day habit streak',
      icon: Flame,
      achieved: stats.longestStreak >= 30,
      progress: stats.longestStreak,
      target: 30,
      color: 'text-red-600',
    },
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const achievedCount = achievements.filter(a => a.achieved).length;
  const nextMilestone = achievements.find(a => !a.achieved && a.progress !== undefined);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalReflections}
          </div>
          <div className="text-sm text-blue-700">Total Reflections</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {stats.longestStreak}
          </div>
          <div className="text-sm text-red-700">Longest Streak</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats.currentStreak}
          </div>
          <div className="text-sm text-green-700">Current Streak</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {achievedCount}/{achievements.length}
          </div>
          <div className="text-sm text-purple-700">Achievements</div>
        </div>
      </div>

      {/* Next Milestone */}
      {nextMilestone && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Next Milestone</h3>
          <div className="flex items-center gap-3">
            <nextMilestone.icon className={`w-6 h-6 ${nextMilestone.color}`} />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{nextMilestone.title}</div>
              <div className="text-sm text-gray-600">{nextMilestone.description}</div>
              {nextMilestone.progress !== undefined && nextMilestone.target && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{nextMilestone.progress}/{nextMilestone.target}</span>
                    <span>{Math.round((nextMilestone.progress / nextMilestone.target) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((nextMilestone.progress / nextMilestone.target) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Achievements List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">All Achievements</h3>
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <div
              key={achievement.id}
              className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
                achievement.achieved 
                  ? 'bg-green-50 border-2 border-green-200' 
                  : 'bg-gray-50 border-2 border-gray-200'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                achievement.achieved ? 'bg-green-100' : 'bg-gray-200'
              }`}>
                <Icon className={`w-6 h-6 ${
                  achievement.achieved ? achievement.color : 'text-gray-400'
                }`} />
              </div>
              
              <div className="flex-1">
                <div className={`font-medium ${
                  achievement.achieved ? 'text-gray-900' : 'text-gray-600'
                }`}>
                  {achievement.title}
                  {achievement.achieved && (
                    <span className="ml-2 text-green-600">✓</span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {achievement.description}
                </div>
                
                {!achievement.achieved && achievement.progress !== undefined && achievement.target && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{achievement.progress}/{achievement.target}</span>
                      <span>{Math.round((achievement.progress / achievement.target) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((achievement.progress / achievement.target) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}