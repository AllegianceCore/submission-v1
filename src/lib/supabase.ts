import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to ensure user is authenticated for operations
export const requireAuth = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    throw new Error(`Authentication error: ${error.message}`);
  }
  
  if (!user) {
    throw new Error('You must be signed in to perform this action');
  }
  
  return user;
};

// Helper function to get current session with error handling
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error(`Session error: ${error.message}`);
  }
  
  if (!session) {
    throw new Error('No active session found. Please sign in again.');
  }
  
  return session;
};

// Database Types
export interface UserProfile {
  id: string;
  full_name: string | null;
  goals: string[] | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface Reflection {
  id: string;
  user_id: string;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  mood_score: number | null;
  voice_url: string | null;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_frequency: 'daily' | 'weekly';
  color: string;
  created_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
  created_at: string;
}

export interface WeeklyRecap {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  video_url: string | null;
  summary: string | null;
  created_at: string;
}

export interface StyleFeedback {
  id: string;
  user_id: string;
  positive_comments: string[];
  suggestions: string[];
  style_rating: number;
  created_at: string;
}

export interface InsightReport {
  id: string;
  user_id: string;
  created_at: string;
  report_type: 'daily' | 'weekly' | 'monthly';
  summary: string;
  motivation: string;
  recommendations: string[];
}

export interface BodyFeedback {
  id: string;
  user_id: string;
  front_image_url: string;
  back_image_url: string;
  height: string | null;
  weight: string | null;
  preferences: any;
  strengths: string;
  weaknesses: string;
  workout_plan: string;
  nutrition_advice: string;
  motivational_message: string;
  created_at: string;
}