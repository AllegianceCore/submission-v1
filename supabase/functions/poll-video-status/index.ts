import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PollVideoRequest {
  video_id: string;
}

// Reflects the actual response structure from Tavus API
interface TavusVideoResponse {
  status: string;
  video_id: string;
  hosted_url?: string; // This is the hosted page URL from Tavus
  download_url?: string; // Direct video file URL for download
  stream_url?: string; // Direct video file URL for streaming
  // Add other fields if needed for debugging or future use
  [key: string]: any;
}

// Defines the structure the frontend expects
interface FrontendVideoStatusResponse {
  status: string;
  video_url?: string; // This is what the frontend expects for the video src
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Require Authorization Header
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
    // Validate and sanitize inputs
    const body = await req.json();
    const { video_id }: PollVideoRequest = body;
    
    if (!video_id || typeof video_id !== 'string') {
      return new Response(
        JSON.stringify({ error: "Missing or invalid video_id" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const TAVUS_API_KEY = Deno.env.get('TAVUS_API_KEY')
    
    if (!TAVUS_API_KEY) {
      throw new Error('Tavus API key not configured')
    }

    console.log(`Polling video status for video_id: ${video_id}`)

    // Poll Tavus v2 API for video status
    const response = await fetch(`https://tavusapi.com/v2/videos/${video_id}`, {
      method: 'GET',
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`Tavus polling failed with status: ${response.status}`, errorData)
      throw new Error(`Video status check failed: ${errorData.message || response.statusText}`)
    }

    const tavusVideoData: TavusVideoResponse = await response.json()
    console.log('Video status response from Tavus:', JSON.stringify(tavusVideoData, null, 2))

    // Prioritize direct video URLs over hosted page URLs
    let videoUrl: string | undefined;
    
    // Priority order: download_url -> stream_url -> hosted_url
    if (tavusVideoData.download_url) {
      videoUrl = tavusVideoData.download_url;
      console.log('Using download_url as video source:', videoUrl);
    } else if (tavusVideoData.stream_url) {
      videoUrl = tavusVideoData.stream_url;
      console.log('Using stream_url as video source:', videoUrl);
    } else if (tavusVideoData.hosted_url) {
      videoUrl = tavusVideoData.hosted_url;
      console.log('Falling back to hosted_url as video source:', videoUrl);
    }

    // Map Tavus response to frontend expected format
    const frontendResponse: FrontendVideoStatusResponse = {
      status: tavusVideoData.status,
      video_url: videoUrl
    }

    console.log('Mapped response for frontend:', JSON.stringify(frontendResponse, null, 2))

    return new Response(
      JSON.stringify(frontendResponse), // Return the mapped response
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Video status polling error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Video status polling failed'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})