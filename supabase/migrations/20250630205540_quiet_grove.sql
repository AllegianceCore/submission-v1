/*
  # Create storage bucket for voice reflections

  1. Storage Setup
    - Create 'voice-reflections' storage bucket
    - Enable public access for voice files
    
  2. Security Policies
    - Allow authenticated users to upload voice files to their own folder
    - Allow public read access to voice files (needed for audio playback)
    - Allow users to delete their own voice files
    
  3. Bucket Configuration
    - Set file size limits (50MB for audio files)
    - Configure allowed file types (audio formats)
*/

-- Create the storage bucket for voice reflections
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-reflections',
  'voice-reflections', 
  true,
  52428800, -- 50MB limit for audio files
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload voice files to their own user folder
CREATE POLICY "Users can upload own voice reflections"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own voice files
CREATE POLICY "Users can view own voice reflections"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access (needed for audio playback)
CREATE POLICY "Public read access to voice reflections"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'voice-reflections');

-- Allow authenticated users to delete their own voice files
CREATE POLICY "Users can delete own voice reflections"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-reflections' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own voice files
CREATE POLICY "Users can update own voice reflections"
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