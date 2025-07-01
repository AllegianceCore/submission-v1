/*
  # ThriveCoach Initial Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, references auth.users)
      - `full_name` (text)
      - `goals` (text array)
      - `onboarding_completed` (boolean)
      - `created_at` (timestamp)
      
    - `reflections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `content` (text)
      - `sentiment` (text: positive, neutral, negative)
      - `mood_score` (integer 1-10)
      - `voice_url` (text, optional)
      - `created_at` (timestamp)
      
    - `habits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `name` (text)
      - `description` (text)
      - `target_frequency` (text: daily, weekly)
      - `color` (text)
      - `created_at` (timestamp)
      
    - `habit_completions`
      - `id` (uuid, primary key)
      - `habit_id` (uuid, references habits)
      - `user_id` (uuid, references user_profiles)
      - `completed_at` (date)
      - `created_at` (timestamp)
      
    - `weekly_recaps`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)  
      - `week_start` (date)
      - `week_end` (date)
      - `video_url` (text, optional)
      - `summary` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  goals text[],
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Reflections Table
CREATE TABLE IF NOT EXISTS reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  mood_score integer CHECK (mood_score >= 1 AND mood_score <= 10),
  voice_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reflections"
  ON reflections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habits Table
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  target_frequency text DEFAULT 'daily' CHECK (target_frequency IN ('daily', 'weekly')),
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own habits"
  ON habits
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habit Completions Table
CREATE TABLE IF NOT EXISTS habit_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  completed_at date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(habit_id, completed_at)
);

ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own habit completions"
  ON habit_completions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Weekly Recaps Table
CREATE TABLE IF NOT EXISTS weekly_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  video_url text,
  summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own weekly recaps"
  ON weekly_recaps
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reflections_user_id_created_at ON reflections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_id_date ON habit_completions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_recaps_user_id ON weekly_recaps(user_id, week_start DESC);