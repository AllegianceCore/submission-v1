import React, { useState, useEffect } from 'react';
import { Plus, Target, CheckCircle, Circle, Flame, Trophy } from 'lucide-react';
import { supabase, requireAuth } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format, isToday } from 'date-fns';
import { Modal } from '../ui/Modal';

interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_frequency: 'daily' | 'weekly';
  color: string;
  created_at: string;
}

interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
  created_at: string;
}

interface HabitWithCompletion extends Habit {
  completions: HabitCompletion[];
  todayCompleted: boolean;
  streak: number;
}

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: number;
  habitName: string;
}

function CelebrationModal({ isOpen, onClose, streak, habitName }: CelebrationModalProps) {
  const getMilestoneMessage = (streak: number) => {
    if (streak === 7) return "Amazing! You've built a week-long habit!";
    if (streak === 14) return "Incredible! Two weeks of consistency!";
    if (streak === 30) return "Outstanding! A full month of dedication!";
    return `Fantastic! ${streak} days of consistency!`;
  };

  const getChallengeMessage = (streak: number) => {
    if (streak === 7) return "Keep going to reach your 14-day milestone!";
    if (streak === 14) return "You're halfway to the legendary 30-day streak!";
    if (streak === 30) return "You're a habit master! Set a new goal to keep growing!";
    return "Every day makes you stronger!";
  };

  return (
    <div className="text-center py-6">
      <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <Trophy className="w-10 h-10 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        🎉 Milestone Unlocked!
      </h3>
      
      <p className="text-lg text-gray-700 mb-2">
        {getMilestoneMessage(streak)}
      </p>
      
      <p className="text-gray-600 mb-6">
        You've completed <strong>{habitName}</strong> for <strong>{streak} days</strong> in a row!
      </p>
      
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-800">
          {getChallengeMessage(streak)}
        </p>
      </div>
      
      <button
        onClick={onClose}
        className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-green-700 transition-all"
      >
        Keep Going! 💪
      </button>
    </div>
  );
}

export function HabitTracker() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<HabitWithCompletion[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    show: boolean;
    streak: number;
    habitName: string;
  }>({ show: false, streak: 0, habitName: '' });

  useEffect(() => {
    if (user) {
      fetchHabits();
    }
  }, [user]);

  const fetchHabits = async () => {
    try {
      // Check authentication first
      const currentUser = await requireAuth();
      
      setLoading(true);
      setError(null);

      // Fetch habits for the authenticated user
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (habitsError) {
        throw new Error(`Failed to fetch habits: ${habitsError.message}`);
      }

      if (habitsData) {
        // Fetch completions for each habit
        const habitsWithCompletions = await Promise.all(
          habitsData.map(async (habit) => {
            const { data: completions, error: completionsError } = await supabase
              .from('habit_completions')
              .select('*')
              .eq('habit_id', habit.id)
              .eq('user_id', currentUser.id) // Extra security check
              .order('completed_at', { ascending: false });

            if (completionsError) {
              console.error('Error fetching completions for habit:', habit.id, completionsError);
              return {
                ...habit,
                completions: [],
                todayCompleted: false,
                streak: 0,
              };
            }

            const todayCompleted = completions?.some(c => 
              isToday(new Date(c.completed_at))
            ) || false;

            // Calculate streak
            const streak = calculateStreak(completions || []);

            return {
              ...habit,
              completions: completions || [],
              todayCompleted,
              streak,
            };
          })
        );

        setHabits(habitsWithCompletions);
      }
    } catch (error) {
      console.error('Error fetching habits:', error);
      setError(error instanceof Error ? error.message : 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  };

  const calculateStreak = (completions: HabitCompletion[]): number => {
    if (completions.length === 0) return 0;

    const sortedCompletions = completions
      .map(c => new Date(c.completed_at))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const completionDate of sortedCompletions) {
      const completion = new Date(completionDate);
      completion.setHours(0, 0, 0, 0);

      if (completion.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (completion.getTime() === currentDate.getTime() + 86400000) {
        // Yesterday
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    try {
      // Check authentication first
      const currentUser = await requireAuth();
      
      setError(null);

      const habitData = {
        user_id: currentUser.id, // Explicitly include user_id
        name: newHabitName.trim(),
        target_frequency: 'daily' as const,
      };

      console.log('Creating habit with data:', habitData);

      const { data, error } = await supabase
        .from('habits')
        .insert([habitData])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create habit: ${error.message}`);
      }

      if (data) {
        setHabits(prev => [
          {
            ...data,
            completions: [],
            todayCompleted: false,
            streak: 0,
          },
          ...prev,
        ]);
      }

      setNewHabitName('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding habit:', error);
      setError(error instanceof Error ? error.message : 'Failed to add habit');
    }
  };

  const toggleHabitCompletion = async (habit: HabitWithCompletion) => {
    try {
      // Check authentication first
      const currentUser = await requireAuth();
      
      setError(null);

      const today = format(new Date(), 'yyyy-MM-dd');
      const previousStreak = habit.streak;

      if (habit.todayCompleted) {
        // Remove completion
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habit.id)
          .eq('user_id', currentUser.id) // Extra security check
          .eq('completed_at', today);

        if (error) {
          throw new Error(`Failed to remove completion: ${error.message}`);
        }
      } else {
        // Add completion with explicit user_id
        const completionData = {
          habit_id: habit.id,
          user_id: currentUser.id, // Explicitly include user_id
          completed_at: today,
        };

        console.log('Creating habit completion with data:', completionData);

        const { error } = await supabase
          .from('habit_completions')
          .insert([completionData]);

        if (error) {
          throw new Error(`Failed to add completion: ${error.message}`);
        }

        // Check for milestone celebration
        const newStreak = previousStreak + 1;
        if ([7, 14, 30].includes(newStreak)) {
          setCelebration({
            show: true,
            streak: newStreak,
            habitName: habit.name,
          });
        }
      }

      await fetchHabits();
    } catch (error) {
      console.error('Error toggling habit completion:', error);
      setError(error instanceof Error ? error.message : 'Failed to update habit');
    }
  };

  const closeCelebration = () => {
    setCelebration({ show: false, streak: 0, habitName: '' });
  };

  // Show authentication error if user is not signed in
  if (!user) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Habits</h2>
            <p className="text-sm text-gray-500">Please sign in to track habits</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Habits</h2>
              <p className="text-sm text-gray-500">Track your daily progress</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddForm(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Add Habit Form */}
        {showAddForm && (
          <form onSubmit={addHabit} className="mb-6 p-4 bg-gray-50 rounded-xl">
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              placeholder="Enter habit name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Add Habit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewHabitName('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Habits List */}
        <div className="space-y-3">
          {habits.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No habits yet</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Add your first habit
              </button>
            </div>
          ) : (
            habits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleHabitCompletion(habit)}
                    className={`p-1 rounded-full transition-colors ${
                      habit.todayCompleted
                        ? 'text-green-600 hover:text-green-700'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {habit.todayCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  
                  <div>
                    <h3 className={`font-medium ${
                      habit.todayCompleted ? 'text-green-700 line-through' : 'text-gray-900'
                    }`}>
                      {habit.name}
                    </h3>
                    <p className="text-xs text-gray-500">Daily</p>
                  </div>
                </div>
                
                {habit.streak > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 rounded-full">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      {habit.streak}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Celebration Modal */}
      <Modal
        isOpen={celebration.show}
        onClose={closeCelebration}
        title=""
        size="md"
      >
        <CelebrationModal
          isOpen={celebration.show}
          onClose={closeCelebration}
          streak={celebration.streak}
          habitName={celebration.habitName}
        />
      </Modal>
    </>
  );
}