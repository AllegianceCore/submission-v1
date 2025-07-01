import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronUp, Search, Filter, RotateCcw, X, Trash2, Dumbbell, Plus, Loader, AlertCircle, Clock, Target, Heart, CheckCircle, AlertTriangle, Sparkles, Download, Eye, EyeOff } from 'lucide-react';
import { supabase, BodyFeedback } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { BodyCoachModal } from './BodyCoachModal';

interface BodyCoachRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FilterState {
  searchText: string;
  startDate: string;
  endDate: string;
  goalFocus: 'all' | 'muscle-gain' | 'fat-loss' | 'endurance' | 'strength';
  sortOrder: 'newest' | 'oldest';
}

interface ExpandedSections {
  [planId: string]: {
    workout: boolean;
    nutrition: boolean;
  };
}

interface WorkoutDay {
  day: string;
  exercises: Array<{
    name: string;
    sets: string;
    reps?: string;
    rest?: string;
  }>;
  notes?: string;
}

interface MealPlan {
  name: string;
  foods: string[];
  portions?: string;
}

interface NutritionData {
  meals: MealPlan[];
  tips: string[];
  hydration?: string;
}

const initialFilters: FilterState = {
  searchText: '',
  startDate: '',
  endDate: '',
  goalFocus: 'all',
  sortOrder: 'newest',
};

export function BodyCoachRecapModal({ isOpen, onClose }: BodyCoachRecapModalProps) {
  const { user } = useAuth();
  const [coachingPlans, setCoachingPlans] = useState<BodyFeedback[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<BodyFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({});
  
  // Separate state for immediate search input (debounced)
  const [rawSearchText, setRawSearchText] = useState('');
  
  const bodyCoachModal = useModal();

  // Debounced effect for search text
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        searchText: rawSearchText
      }));
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [rawSearchText]);

  useEffect(() => {
    if (isOpen && user) {
      fetchCoachingPlans();
    }
  }, [isOpen, user]);

  // Apply filters whenever filters change or plans change
  useEffect(() => {
    applyFilters();
  }, [coachingPlans, filters]);

  const fetchCoachingPlans = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('body_feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setCoachingPlans(data || []);
    } catch (err) {
      console.error('Error fetching coaching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...coachingPlans];

    // Apply search filter - search in goals, strengths, weaknesses, workout_plan, nutrition_advice
    if (filters.searchText.trim()) {
      const searchTerm = filters.searchText.toLowerCase().trim();
      filtered = filtered.filter(plan => {
        const goalsText = (plan.preferences?.goals || '').toLowerCase();
        const strengthsText = plan.strengths.toLowerCase();
        const weaknessesText = plan.weaknesses.toLowerCase();
        const workoutText = plan.workout_plan.toLowerCase();
        const nutritionText = plan.nutrition_advice.toLowerCase();
        
        return goalsText.includes(searchTerm) || 
               strengthsText.includes(searchTerm) || 
               weaknessesText.includes(searchTerm) ||
               workoutText.includes(searchTerm) ||
               nutritionText.includes(searchTerm);
      });
    }

    // Apply date range filters
    if (filters.startDate) {
      filtered = filtered.filter(plan =>
        new Date(plan.created_at) >= new Date(`${filters.startDate}T00:00:00`)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(plan =>
        new Date(plan.created_at) <= new Date(`${filters.endDate}T23:59:59`)
      );
    }

    // Apply goal focus filter
    if (filters.goalFocus !== 'all') {
      filtered = filtered.filter(plan => {
        const goals = (plan.preferences?.goals || '').toLowerCase();
        switch (filters.goalFocus) {
          case 'muscle-gain':
            return goals.includes('muscle') || goals.includes('build') || goals.includes('gain');
          case 'fat-loss':
            return goals.includes('lose') || goals.includes('fat') || goals.includes('weight');
          case 'endurance':
            return goals.includes('endurance') || goals.includes('cardio') || goals.includes('stamina');
          case 'strength':
            return goals.includes('strength') || goals.includes('strong') || goals.includes('power');
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortOrder) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    setFilteredPlans(filtered);
  };

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setRawSearchText('');
  };

  const clearSearch = () => {
    setRawSearchText('');
  };

  const hasActiveFilters = () => {
    return filters.searchText !== '' ||
           filters.startDate !== '' ||
           filters.endDate !== '' ||
           filters.goalFocus !== 'all' ||
           filters.sortOrder !== 'newest';
  };

  const handleNewPlanComplete = () => {
    // Refresh the coaching plans when a new plan is completed
    fetchCoachingPlans();
    bodyCoachModal.close();
  };

  const handleDeletePlan = async (planId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this coaching plan? This action cannot be undone.')) {
      return;
    }

    setDeleting(planId);
    try {
      const { error } = await supabase
        .from('body_feedback')
        .delete()
        .eq('id', planId)
        .eq('user_id', user.id); // Extra security check

      if (error) throw error;
      
      // Remove from local state
      setCoachingPlans(prev => prev.filter(p => p.id !== planId));
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const toggleSection = (planId: string, section: 'workout' | 'nutrition') => {
    setExpandedSections(prev => {
      const current = prev[planId] || { workout: false, nutrition: false };
      
      // Option 1: Allow only one section expanded at a time per card
      if (section === 'workout') {
        return {
          ...prev,
          [planId]: {
            workout: !current.workout,
            nutrition: false // Close nutrition when opening workout
          }
        };
      } else {
        return {
          ...prev,
          [planId]: {
            workout: false, // Close workout when opening nutrition
            nutrition: !current.nutrition
          }
        };
      }
    });
  };

  // Enhanced workout plan parsing
  const parseWorkoutPlan = (workoutText: string): WorkoutDay[] => {
    if (typeof workoutText !== 'string') {
      return [];
    }

    const lines = workoutText.split('\n').filter(line => line.trim());
    const workouts: WorkoutDay[] = [];
    let currentWorkout: WorkoutDay | null = null;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Enhanced day detection patterns
      if (
        /^(Day\s*\d+|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(trimmed) ||
        trimmed.includes('**Day') ||
        (trimmed.includes(':') && /day|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(trimmed))
      ) {
        // Save previous workout if exists
        if (currentWorkout) {
          workouts.push(currentWorkout);
        }
        
        // Clean up day name
        const dayName = trimmed
          .replace(/^\*\*|\*\*$/g, '')
          .replace(/[:]/g, '')
          .trim();
        
        currentWorkout = {
          day: dayName,
          exercises: [],
          notes: ''
        };
      }
      // Enhanced exercise detection
      else if (currentWorkout && (
        trimmed.includes('sets') || 
        trimmed.includes('reps') ||
        trimmed.includes('minutes') ||
        /^\-/.test(trimmed) ||
        /^\d+\./.test(trimmed) ||
        /^•/.test(trimmed) ||
        trimmed.includes(':')
      )) {
        let exerciseName = '';
        let sets = '';
        let reps = '';
        let rest = '';
        
        // Parse different formats
        if (trimmed.includes(':')) {
          const [name, details] = trimmed.split(':').map(s => s.trim());
          exerciseName = name.replace(/^[\-\d\.•]\s*/, '');
          
          // Extract sets, reps, and rest from details
          const setsMatch = details.match(/(\d+)\s*sets?/i);
          const repsMatch = details.match(/(\d+(?:-\d+)?)\s*reps?/i);
          const restMatch = details.match(/(\d+(?:-\d+)?)\s*(?:seconds?|mins?)/i);
          
          sets = setsMatch ? setsMatch[1] + ' sets' : '';
          reps = repsMatch ? repsMatch[1] + ' reps' : '';
          rest = restMatch ? restMatch[0] : '';
          
          // If no structured format found, use the whole details as sets
          if (!setsMatch && !repsMatch) {
            sets = details;
          }
        } else {
          // Handle bullet point or numbered format
          exerciseName = trimmed.replace(/^[\-\d\.•]\s*/, '');
        }
        
        if (exerciseName) {
          currentWorkout.exercises.push({
            name: exerciseName,
            sets: sets || 'As described',
            reps,
            rest
          });
        }
      }
      // Rest/note lines
      else if (currentWorkout && (
        trimmed.toLowerCase().includes('rest') ||
        trimmed.toLowerCase().includes('note') ||
        trimmed.toLowerCase().includes('tip')
      )) {
        currentWorkout.notes = (currentWorkout.notes || '') + (currentWorkout.notes ? ' ' : '') + trimmed;
      }
    });
    
    // Don't forget the last workout
    if (currentWorkout) {
      workouts.push(currentWorkout);
    }
    
    return workouts;
  };

  // Enhanced nutrition plan parsing
  const parseNutritionPlan = (nutritionText: string): NutritionData => {
    if (typeof nutritionText !== 'string') {
      return { meals: [], tips: [] };
    }

    const lines = nutritionText.split('\n').filter(line => line.trim());
    const meals: MealPlan[] = [];
    const tips: string[] = [];
    let currentMeal: MealPlan | null = null;
    let hydration = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Enhanced meal detection
      if (
        /^(\*\*|##)?(breakfast|lunch|dinner|snack)/i.test(trimmed) ||
        trimmed.toLowerCase().includes('meal') ||
        (trimmed.includes(':') && /breakfast|lunch|dinner|snack|morning|afternoon|evening/i.test(trimmed))
      ) {
        // Save previous meal
        if (currentMeal) {
          meals.push(currentMeal);
        }
        
        // Clean meal name
        const mealName = trimmed
          .replace(/^\*\*|\*\*$|^##|##$/g, '')
          .replace(/[:]/g, '')
          .replace(/^\d+\.\s*/, '')
          .trim();
        
        currentMeal = {
          name: mealName,
          foods: [],
          portions: ''
        };
      }
      // Food items and portions
      else if (currentMeal && (
        trimmed.startsWith('-') ||
        trimmed.startsWith('•') ||
        /\d+\s*(oz|cup|tbsp|tsp|slice|piece)/i.test(trimmed) ||
        /^\d+\./.test(trimmed)
      )) {
        const foodItem = trimmed
          .replace(/^[\-•\d\.]\s*/, '')
          .trim();
        
        if (foodItem) {
          currentMeal.foods.push(foodItem);
        }
      }
      // Tips and hydration
      else if (
        trimmed.toLowerCase().includes('tip') ||
        trimmed.toLowerCase().includes('hydration') ||
        trimmed.toLowerCase().includes('water') ||
        trimmed.toLowerCase().includes('drink')
      ) {
        if (trimmed.toLowerCase().includes('hydration') || trimmed.toLowerCase().includes('water')) {
          hydration = trimmed;
        } else {
          tips.push(trimmed.replace(/^\*\*|\*\*$/g, ''));
        }
      }
      // General nutritional advice
      else if (
        trimmed.length > 10 && 
        !currentMeal &&
        (trimmed.toLowerCase().includes('calories') ||
         trimmed.toLowerCase().includes('protein') ||
         trimmed.toLowerCase().includes('balance') ||
         trimmed.toLowerCase().includes('avoid'))
      ) {
        tips.push(trimmed);
      }
    });
    
    // Don't forget the last meal
    if (currentMeal) {
      meals.push(currentMeal);
    }
    
    return { meals, tips, hydration };
  };

  const getRatingFromGoals = (goals: string): number => {
    // Simple heuristic to assign a rating based on goal complexity and specificity
    if (!goals) return 5;
    
    const goalWords = goals.toLowerCase().split(' ').length;
    const specificWords = ['muscle', 'strength', 'endurance', 'fat', 'lose', 'build', 'improve'].filter(word => 
      goals.toLowerCase().includes(word)
    ).length;
    
    // Base rating of 6, +1 for specificity, +1 for detail
    let rating = 6;
    if (specificWords >= 2) rating += 1;
    if (goalWords >= 10) rating += 1;
    
    return Math.min(rating, 10);
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (rating >= 6) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (rating >= 4) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getRatingLabel = (rating: number): string => {
    if (rating >= 8) return 'Excellent';
    if (rating >= 6) return 'Good';
    if (rating >= 4) return 'Fair';
    return 'Needs Work';
  };

  const downloadPlan = (plan: BodyFeedback) => {
    const content = `
AI BODY COACH - PERSONALIZED WELLNESS PLAN
==========================================

Generated on: ${format(new Date(plan.created_at), 'PPP')}

STRENGTHS
---------
${plan.strengths}

AREAS FOR IMPROVEMENT
--------------------
${plan.weaknesses}

🏋️ PERSONALIZED WORKOUT PLAN
-----------------------------
${plan.workout_plan}

🍽️ NUTRITION PLAN
------------------
${plan.nutrition_advice}

MOTIVATIONAL MESSAGE
-------------------
${plan.motivational_message}

---
This plan was generated by ThriveCoach AI Body Coach
Remember: Consistency beats perfection!
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `body-coach-plan-${format(new Date(plan.created_at), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your coaching plans...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-6xl mb-4">💪</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Body Coach</h2>
          <p className="text-gray-600">Get personalized coaching plans and track your progress over time.</p>
        </div>

        {/* Generate New Plan Button */}
        <div className="text-center">
          <button
            onClick={bodyCoachModal.open}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 inline-flex items-center gap-3"
          >
            <Plus className="w-6 h-6" />
            Generate New Plan
          </button>
        </div>

        {/* Filter Controls - Only show if there are plans */}
        {coachingPlans.length > 0 && (
          <div className="space-y-4">
            {/* Filter Toggle and Reset */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters() && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>
              
              {hasActiveFilters() && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Filters
                </button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                {/* Search Bar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Plans
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={rawSearchText}
                      onChange={(e) => setRawSearchText(e.target.value)}
                      placeholder="Search goals, strengths, workouts, nutrition..."
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {rawSearchText && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {rawSearchText !== filters.searchText && (
                    <div className="mt-1 text-xs text-gray-500">
                      Searching... (pause typing to search)
                    </div>
                  )}
                </div>

                {/* Date Range and Goal Focus */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Goal Focus
                    </label>
                    <select
                      value={filters.goalFocus}
                      onChange={(e) => handleFilterChange('goalFocus', e.target.value)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Goals</option>
                      <option value="muscle-gain">Muscle Gain</option>
                      <option value="fat-loss">Fat Loss</option>
                      <option value="endurance">Endurance</option>
                      <option value="strength">Strength</option>
                    </select>
                  </div>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort Order
                  </label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        {coachingPlans.length > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {filteredPlans.length === 0 
                ? 'No plans found'
                : `${filteredPlans.length} plan${filteredPlans.length !== 1 ? 's' : ''} found`
              }
              {hasActiveFilters() && ' (filtered)'}
            </span>
            <span>
              Total: {coachingPlans.length} plan{coachingPlans.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Plans List or Empty State */}
        {coachingPlans.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              You haven't generated any coaching plans yet
            </h3>
            <p className="text-gray-500 mb-4">
              Create your first one to kickstart your fitness journey!
            </p>
            <button
              onClick={bodyCoachModal.open}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Generate New Plan
            </button>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            {hasActiveFilters() ? (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No plans match your criteria
                </h3>
                <p className="text-gray-500 mb-4">
                  Try adjusting your search criteria or removing some filters to see more results.
                </p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No coaching plans yet
                </h3>
                <p className="text-gray-500">
                  Start your fitness journey by generating your first plan!
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPlans.map((plan) => {
              const rating = getRatingFromGoals(plan.preferences?.goals || '');
              const expanded = expandedSections[plan.id] || { workout: false, nutrition: false };
              const workouts = parseWorkoutPlan(plan.workout_plan);
              const nutritionData = parseNutritionPlan(plan.nutrition_advice);
              
              return (
                <div
                  key={plan.id}
                  className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {format(new Date(plan.created_at), 'PPPP')}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {format(new Date(plan.created_at), 'p')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-sm rounded-full border flex items-center gap-2 ${getRatingColor(rating)}`}>
                        <Target className="w-4 h-4" />
                        {rating}/10 {getRatingLabel(rating)}
                      </span>
                      
                      <button
                        onClick={() => downloadPlan(plan)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Download plan"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        disabled={deleting === plan.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete plan"
                      >
                        {deleting === plan.id ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Areas for Improvement */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      Areas for Improvement
                    </h4>
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-yellow-800 text-sm leading-relaxed">{plan.weaknesses}</p>
                    </div>
                  </div>

                  {/* Workout Plan */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Dumbbell className="w-5 h-5 text-purple-600" />
                      🏋️ Workout Plan
                    </h4>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <div className="space-y-3">
                        {plan.workout_plan.split('\n').filter(line => line.trim()).slice(0, 6).map((line, index) => {
                          const trimmed = line.trim();
                          if (trimmed.includes('**') || trimmed.includes('Day') || trimmed.includes(':')) {
                            return (
                              <div key={index} className="font-semibold text-purple-900 text-sm">
                                {trimmed.replace(/\*\*/g, '')}
                              </div>
                            );
                          } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                            return (
                              <div key={index} className="flex items-start gap-2 text-sm text-purple-800 ml-4">
                                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                                <span>{trimmed.replace(/^[•\-]\s*/, '')}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={index} className="text-sm text-purple-700">
                              {trimmed}
                            </div>
                          );
                        })}
                        {plan.workout_plan.split('\n').filter(line => line.trim()).length > 6 && (
                          <div className="text-sm text-purple-600 italic">
                            ... and more detailed exercises
                          </div>
                        )}
                      </div>
                      
                      {/* View Full Workout Plan Link */}
                      {workouts.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-purple-200">
                          <button
                            onClick={() => toggleSection(plan.id, 'workout')}
                            className="text-purple-600 hover:text-purple-800 text-sm font-medium hover:underline transition-colors inline-flex items-center gap-2"
                          >
                            {expanded.workout ? (
                              <>
                                <EyeOff className="w-4 h-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                View Full Workout Plan
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded Workout Details */}
                    {expanded.workout && workouts.length > 0 && (
                      <div className="mt-4 overflow-hidden transition-all duration-300 ease-in-out animate-in slide-in-from-top-2 fade-in">
                        <div className="bg-purple-25 rounded-lg p-5 border border-purple-200 shadow-sm">
                          <h5 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                            <Dumbbell className="w-5 h-5" />
                            Complete Workout Schedule
                          </h5>
                          <div className="space-y-6">
                            {workouts.map((workout, index) => (
                              <div key={index} className="bg-white rounded-lg p-5 border border-purple-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {index + 1}
                                  </div>
                                  <h6 className="text-lg font-bold text-purple-900">{workout.day}</h6>
                                </div>
                                
                                <div className="space-y-3">
                                  {workout.exercises.map((exercise, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                          <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                                          <span className="font-semibold text-purple-900 text-sm">{exercise.name}</span>
                                        </div>
                                        {exercise.reps && (
                                          <div className="ml-5 mt-1 text-xs text-purple-700">
                                            Reps: {exercise.reps}
                                          </div>
                                        )}
                                        {exercise.rest && (
                                          <div className="ml-5 mt-1 text-xs text-purple-600 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Rest: {exercise.rest}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                                          {exercise.sets}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                {workout.notes && (
                                  <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                                    <p className="text-xs text-purple-800 italic">
                                      <strong>Note:</strong> {workout.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nutrition Advice */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-orange-600" />
                      🥗 Nutrition Advice
                    </h4>
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <div className="space-y-3">
                        {plan.nutrition_advice.split('\n').filter(line => line.trim()).slice(0, 5).map((line, index) => {
                          const trimmed = line.trim();
                          if (trimmed.includes('**') || trimmed.includes(':')) {
                            return (
                              <div key={index} className="font-semibold text-orange-900 text-sm">
                                {trimmed.replace(/\*\*/g, '')}
                              </div>
                            );
                          } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                            return (
                              <div key={index} className="flex items-start gap-2 text-sm text-orange-800 ml-4">
                                <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                                <span>{trimmed.replace(/^[•\-]\s*/, '')}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={index} className="text-sm text-orange-700">
                              {trimmed}
                            </div>
                          );
                        })}
                        {plan.nutrition_advice.split('\n').filter(line => line.trim()).length > 5 && (
                          <div className="text-sm text-orange-600 italic">
                            ... plus detailed meal plans and nutrition tips
                          </div>
                        )}
                      </div>
                      
                      {/* View Full Nutrition Advice Link */}
                      {nutritionData.meals.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-orange-200">
                          <button
                            onClick={() => toggleSection(plan.id, 'nutrition')}
                            className="text-orange-600 hover:text-orange-800 text-sm font-medium hover:underline transition-colors inline-flex items-center gap-2"
                          >
                            {expanded.nutrition ? (
                              <>
                                <EyeOff className="w-4 h-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                View Full Nutrition Advice
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded Nutrition Details */}
                    {expanded.nutrition && nutritionData.meals.length > 0 && (
                      <div className="mt-4 overflow-hidden transition-all duration-300 ease-in-out animate-in slide-in-from-top-2 fade-in">
                        <div className="bg-orange-25 rounded-lg p-5 border border-orange-200 shadow-sm">
                          <h5 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
                            <Heart className="w-5 h-5" />
                            Complete Nutrition Plan
                          </h5>
                          <div className="space-y-5">
                            {/* Meal Plan */}
                            <div className="grid gap-4">
                              {nutritionData.meals.map((meal, index) => (
                                <div key={index} className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                      {index + 1}
                                    </div>
                                    <h6 className="text-base font-bold text-orange-900">{meal.name}</h6>
                                  </div>
                                  <div className="space-y-2">
                                    {meal.foods.map((food, idx) => (
                                      <div key={idx} className="flex items-start gap-3 p-2 bg-orange-50 rounded">
                                        <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                                        <span className="text-orange-800 text-sm leading-relaxed">{food}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {meal.portions && (
                                    <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-orange-700">
                                      <strong>Portions:</strong> {meal.portions}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {/* Nutrition Tips */}
                            {(nutritionData.tips.length > 0 || nutritionData.hydration) && (
                              <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
                                <h6 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                                  <Target className="w-4 h-4" />
                                  Nutrition Tips
                                </h6>
                                <div className="space-y-3">
                                  {nutritionData.hydration && (
                                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                                      <p className="text-blue-800 text-sm font-medium">{nutritionData.hydration}</p>
                                    </div>
                                  )}
                                  {nutritionData.tips.map((tip, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                                      <div className="w-2 h-2 bg-orange-600 rounded-full mt-2"></div>
                                      <p className="text-orange-800 text-sm leading-relaxed">{tip}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Strengths */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Your Strengths
                    </h4>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-800 text-sm leading-relaxed">{plan.strengths}</p>
                    </div>
                  </div>

                  {/* Motivational Message */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-pink-600" />
                      Your Personal Message
                    </h4>
                    <div className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg border border-pink-200">
                      <p className="text-pink-800 text-sm leading-relaxed italic">{plan.motivational_message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Statistics (when plans exist) */}
        {coachingPlans.length > 0 && (
          <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {coachingPlans.length}
              </p>
              <p className="text-sm text-gray-500">Total Plans</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {coachingPlans.length > 0 ? (coachingPlans.reduce((sum, p) => sum + getRatingFromGoals(p.preferences?.goals || ''), 0) / coachingPlans.length).toFixed(1) : '0'}
              </p>
              <p className="text-sm text-gray-500">Avg Rating</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {coachingPlans.filter(p => getRatingFromGoals(p.preferences?.goals || '') >= 8).length}
              </p>
              <p className="text-sm text-gray-500">High Adherence (8-10)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {filteredPlans.length}
              </p>
              <p className="text-sm text-gray-500">Total Plans Shown</p>
            </div>
          </div>
        )}
      </div>

      {/* Body Coach Modal for New Plan */}
      <Modal
        isOpen={bodyCoachModal.isOpen}
        onClose={bodyCoachModal.close}
        title=""
        size="lg"
      >
        <BodyCoachModal
          isOpen={bodyCoachModal.isOpen}
          onClose={handleNewPlanComplete}
        />
      </Modal>
    </>
  );
}