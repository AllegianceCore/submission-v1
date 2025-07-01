/*
  # Create storage bucket for body analysis images

  1. Storage Setup
    - Create 'body-analysis' storage bucket
    - Enable public access for images (needed for AI analysis)
    
  2. Security Policies
    - Allow authenticated users to upload images to their own folder
    - Allow public read access to images
    - Allow users to delete their own images
    
  3. Bucket Configuration
    - Set file size limits
    - Configure allowed file types
*/

-- Create the storage bucket for body analysis images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'body-analysis',
  'body-analysis', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to their own user folder
CREATE POLICY "Users can upload own body analysis images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'body-analysis' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own images
CREATE POLICY "Users can view own body analysis images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'body-analysis' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access (needed for AI analysis)
CREATE POLICY "Public read access to body analysis images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'body-analysis');

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own body analysis images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'body-analysis' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own body analysis images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'body-analysis' AND 
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'body-analysis' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);