/*
  # Create AI Coach System Tables

  1. New Tables
    - `user_coaches`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `coach_name` (text)
      - `description` (text)
      - `system_prompt` (text)
      - `initial_message` (text)
      - `category` (text) - for duplicate prevention
      - `created_at` (timestamp)
      
    - `quick_actions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `type` (text) - "ai_coach", "feature", etc.
      - `label` (text)
      - `linked_resource` (uuid) - references coach id or other resources
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- User Coaches Table
CREATE TABLE IF NOT EXISTS user_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  coach_name text NOT NULL,
  description text NOT NULL,
  system_prompt text NOT NULL,
  initial_message text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_coaches ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own coaches"
  ON user_coaches
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_user_coaches_user_id_created_at 
  ON user_coaches (user_id, created_at DESC);

CREATE INDEX idx_user_coaches_user_id_category 
  ON user_coaches (user_id, category);

-- Quick Actions Table
CREATE TABLE IF NOT EXISTS quick_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('ai_coach', 'feature')),
  label text NOT NULL,
  linked_resource uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quick_actions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own quick actions"
  ON quick_actions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_quick_actions_user_id_type 
  ON quick_actions (user_id, type);