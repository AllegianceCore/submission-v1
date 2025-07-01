/*
  # Create body_feedback table for AI Body Coach feature

  1. New Tables
    - `body_feedback`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `front_image_url` (text)
      - `back_image_url` (text)
      - `height` (text)
      - `weight` (text)
      - `preferences` (jsonb)
      - `strengths` (text)
      - `weaknesses` (text)
      - `workout_plan` (text)
      - `nutrition_advice` (text)
      - `motivational_message` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `body_feedback` table
    - Add policy for authenticated users to manage their own body feedback
*/

CREATE TABLE IF NOT EXISTS body_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  front_image_url text NOT NULL,
  back_image_url text NOT NULL,
  height text,
  weight text,
  preferences jsonb DEFAULT '{}',
  strengths text NOT NULL,
  weaknesses text NOT NULL,
  workout_plan text NOT NULL,
  nutrition_advice text NOT NULL,
  motivational_message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE body_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own body feedback"
  ON body_feedback
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_body_feedback_user_id_created_at 
  ON body_feedback (user_id, created_at DESC);