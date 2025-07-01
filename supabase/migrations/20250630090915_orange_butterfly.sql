/*
  # Create insight_reports table for AI Insights journaling

  1. New Tables
    - `insight_reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `created_at` (timestamp with time zone)
      - `report_type` (text: daily, weekly, monthly)
      - `summary` (text)
      - `motivation` (text)
      - `recommendations` (text array)

  2. Security
    - Enable RLS on `insight_reports` table
    - Add policy for authenticated users to manage their own reports
*/

CREATE TABLE IF NOT EXISTS insight_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  report_type text CHECK (report_type IN ('daily', 'weekly', 'monthly')) NOT NULL,
  summary text NOT NULL,
  motivation text NOT NULL,
  recommendations text[] DEFAULT '{}' NOT NULL
);

-- Enable RLS
ALTER TABLE insight_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own insight reports"
  ON insight_reports
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_insight_reports_user_id_created_at 
  ON insight_reports (user_id, created_at DESC);

CREATE INDEX idx_insight_reports_user_id_type 
  ON insight_reports (user_id, report_type);