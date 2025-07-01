/*
  # Create voice-reflections storage bucket and policies

  1. Storage Setup
    - Create 'voice-reflections' storage bucket for voice recordings
    - Set appropriate file size limits and allowed mime types
    
  2. Security Policies
    - Allow authenticated users to upload voice files to their own folder
    - Allow users to read, update, and delete their own voice files
    
  3. Bucket Configuration
    - Set file size limits (10MB)
    - Configure allowed audio file types
*/

-- Create the storage bucket for voice reflections
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-reflections',
  'voice-reflections', 
  false,
  10485760, -- 10MB limit
  ARRAY['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload voice files to their own user folder
CREATE POLICY "Users can upload own voice recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own voice files
CREATE POLICY "Users can view own voice recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own voice files
CREATE POLICY "Users can delete own voice recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own voice files
CREATE POLICY "Users can update own voice recordings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);