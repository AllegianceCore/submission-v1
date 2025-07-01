import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured')
    }

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      throw new Error('No audio file provided')
    }

    // Convert audio to the format expected by ElevenLabs
    const audioBuffer = await audioFile.arrayBuffer()
    
    if (audioBuffer.byteLength === 0) {
      throw new Error('Empty audio buffer')
    }
    
    // Create form data for ElevenLabs Speech-to-Text API
    const elevenLabsFormData = new FormData()
    // Use 'file' as the field name - this is what ElevenLabs expects
    elevenLabsFormData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'reflection.wav')
    // Use the correct model_id for ElevenLabs Speech-to-Text
    elevenLabsFormData.append('model_id', 'scribe_v1')

    // Call ElevenLabs Speech-to-Text API
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: elevenLabsFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    
    return new Response(
      JSON.stringify({ 
        text: result.text || '',
        confidence: result.confidence || 0.5 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Transcription error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Speech-to-text transcription failed'
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