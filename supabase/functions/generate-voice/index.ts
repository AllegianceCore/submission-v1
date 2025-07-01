import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VoiceRequest {
  text: string;
  voice_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 1️⃣ Require Authorization Header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header." }),
      { 
        status: 401, 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );
  }

  try {
    // Use Rachel's voice ID which is typically available in free tier
    const { text, voice_id = '21m00Tcm4TlvDq8ikWAM' }: VoiceRequest = await req.json()
    
    // Validate input
    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error('Text is required and cannot be empty')
    }

    // Limit text length to prevent abuse
    if (text.length > 5000) {
      throw new Error('Text too long. Maximum 5000 characters allowed.')
    }

    console.log('Generating voice with text length:', text.length)
    console.log('Using voice_id:', voice_id)
    
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured')
    }

    // 2️⃣ Create Supabase Client with Authorization from request
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // 3️⃣ Verify user authentication and get user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: "Authentication failed. Please sign in again." }),
        { 
          status: 401, 
          headers: { 
            ...corsHeaders,
            "Content-Type": "application/json" 
          } 
        }
      );
    }

    console.log('Authenticated user ID:', user.id)
    console.log('Calling ElevenLabs Text-to-Speech API...')
    
    // Call ElevenLabs Text-to-Speech API with improved error handling
    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2', // Fast and efficient model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        },
      }),
    })

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      console.error('ElevenLabs API error:', {
        status: elevenLabsResponse.status,
        statusText: elevenLabsResponse.statusText,
        error: errorText
      })
      
      // Provide more specific error messages
      if (elevenLabsResponse.status === 401) {
        throw new Error('ElevenLabs API authentication failed - please check API key')
      } else if (elevenLabsResponse.status === 429) {
        throw new Error('ElevenLabs API rate limit exceeded - please try again later')
      } else if (elevenLabsResponse.status === 422) {
        throw new Error('Invalid voice settings or text content')
      } else {
        throw new Error(`ElevenLabs API error (${elevenLabsResponse.status}): ${errorText}`)
      }
    }

    console.log('Voice generation successful, converting to buffer...')
    const audioBuffer = await elevenLabsResponse.arrayBuffer()
    
    if (audioBuffer.byteLength === 0) {
      throw new Error('Received empty audio buffer from ElevenLabs')
    }

    // 4️⃣ Generate unique filename with user ID prefix for proper RLS
    const timestamp = Date.now()
    const fileName = `reflection_${timestamp}.mp3`
    const filePath = `${user.id}/${fileName}` // Include user.id in path for RLS
    
    console.log('Uploading to Supabase Storage...')
    console.log('Bucket: voice-reflections')
    console.log('File path:', filePath)
    console.log('File size:', audioBuffer.byteLength, 'bytes')
    console.log('User ID for storage:', user.id)
    
    // 5️⃣ Upload to Supabase Storage with retry logic and proper user context
    let uploadData, uploadError;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const uploadResult = await supabase.storage
        .from('voice-reflections')
        .upload(filePath, audioBuffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false
        });

      uploadData = uploadResult.data;
      uploadError = uploadResult.error;

      if (!uploadError) {
        break; // Success, exit retry loop
      }

      retryCount++;
      console.log(`Upload attempt ${retryCount} failed:`, uploadError);

      if (retryCount < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (uploadError) {
      console.error('Supabase storage upload error after retries:', uploadError)
      
      // Check if it's a bucket not found error
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket_not_found')) {
        throw new Error('Storage bucket "voice-reflections" does not exist. Please create this bucket in your Supabase dashboard.')
      }
      
      // Check for RLS policy violations
      if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('RLS')) {
        throw new Error('Storage permission denied. Please check your storage policies or contact support.')
      }
      
      // Check for other common storage errors
      if (uploadError.message?.includes('Duplicate')) {
        throw new Error('File already exists. Please try again.')
      }
      
      if (uploadError.message?.includes('size')) {
        throw new Error('Audio file too large. Please try with shorter text.')
      }
      
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    console.log('Upload successful:', uploadData)
    
    // 6️⃣ Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('voice-reflections')
      .getPublicUrl(filePath)
    
    console.log('Public URL generated:', publicUrl)
    
    // Validate that the URL is accessible
    if (!publicUrl || !publicUrl.includes('voice-reflections')) {
      throw new Error('Failed to generate valid public URL for audio file')
    }
    
    return new Response(
      JSON.stringify({ 
        voice_url: publicUrl,
        message: 'Voice generation and upload completed successfully',
        file_size: audioBuffer.byteLength,
        duration_estimate: Math.ceil(text.length / 15), // rough estimate: 15 chars per second
        user_id: user.id // Include for verification
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Voice generation error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Voice generation failed',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})