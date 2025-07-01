/*
  # Create style_feedback table for AI Stylist feature

  1. New Tables
    - `style_feedback`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `positive_comments` (text array)
      - `suggestions` (text array)
      - `style_rating` (integer, 1-10)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `style_feedback` table
    - Add policy for authenticated users to manage their own style feedback
*/

CREATE TABLE IF NOT EXISTS style_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  positive_comments text[] DEFAULT '{}',
  suggestions text[] DEFAULT '{}',
  style_rating integer CHECK (style_rating >= 1 AND style_rating <= 10),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE style_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own style feedback"
  ON style_feedback
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_style_feedback_user_id_created_at 
  ON style_feedback (user_id, created_at DESC);