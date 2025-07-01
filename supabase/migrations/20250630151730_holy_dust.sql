/*
  # Create body_coach_reports table for AI Body Coach history

  1. New Tables
    - `body_coach_reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `created_at` (timestamp with time zone)
      - `input_data` (jsonb) - stores all user-provided inputs
      - `analysis` (jsonb) - stores the AI-generated content
      - `note` (text) - optional user note

  2. Security
    - Enable RLS on `body_coach_reports` table
    - Add policy for authenticated users to manage their own reports
*/

CREATE TABLE IF NOT EXISTS body_coach_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  input_data jsonb NOT NULL,
  analysis jsonb NOT NULL,
  note text
);

-- Enable RLS
ALTER TABLE body_coach_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own body coach reports"
  ON body_coach_reports
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_body_coach_reports_user_id_created_at 
  ON body_coach_reports (user_id, created_at DESC);