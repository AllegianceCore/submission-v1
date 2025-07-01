import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VideoRecapRequest {
  user_id: string;
}

interface VideoRecapResponse {
  video_id: string;
  hosted_url: string;
  video_script: string;
  week_start: string;
  week_end: string;
  reflection_count: number;
  mood_average: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    // Validate and sanitize inputs
    const body = await req.json();
    const { user_id }: VideoRecapRequest = body;
    
    if (!user_id || typeof user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: "Missing or invalid user_id" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const TAVUS_API_KEY = Deno.env.get('TAVUS_API_KEY')
    const TAVUS_REPLICA_ID = Deno.env.get('TAVUS_REPLICA_ID') || 'r7c4f8e8a-b2d1-4c6e-9f0a-1b3c5d7e9f0a'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }
    
    if (!TAVUS_API_KEY) {
      throw new Error('Tavus API key not configured')
    }

    // Initialize Supabase client with service key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate week range (Sunday 00:00 to Saturday 23:59)
    const { startDate, endDate } = calculateWeekRange()
    
    console.log(`Generating weekly recap for user ${user_id} from ${startDate} to ${endDate}`)

    // Get user's first name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user_id)
      .single()

    const userName = extractFirstName(userProfile?.full_name)
    console.log(`User name: ${userName}`)

    // Fetch user's reflections for the past 7 days
    const { data: reflections, error: reflectionsError } = await supabase
      .from('reflections')
      .select('content, mood_score, created_at')
      .eq('user_id', user_id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })

    if (reflectionsError) {
      throw new Error(`Error fetching reflections: ${reflectionsError.message}`)
    }

    if (!reflections || reflections.length === 0) {
      throw new Error('No reflections found for the past week. Please add some reflections first.')
    }

    // Generate personalized motivational script using OpenAI GPT API
    const reflectionTexts = reflections.map(r => r.content)
    console.log(`Found ${reflections.length} reflections, generating script...`)
    
    const videoScript = await generateOpenAIScript(reflectionTexts, userName, OPENAI_API_KEY)
    console.log('Script generated successfully')

    // Validate script content
    if (!videoScript || typeof videoScript !== 'string' || videoScript.trim() === '') {
      throw new Error('Generated script is empty or invalid')
    }

    // Create video with Tavus v2 API (without waiting for completion)
    console.log('Creating video with Tavus v2 API...')
    const { video_id, hosted_url } = await createTavusVideo(videoScript, userName, TAVUS_API_KEY, TAVUS_REPLICA_ID)
    
    console.log('Video creation initiated successfully:', { video_id, hosted_url })

    // Calculate stats for response
    const moodScores = reflections.filter(r => r.mood_score).map(r => r.mood_score)
    const moodAverage = moodScores.length > 0 
      ? moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length 
      : 0

    // Save initial record to weekly_recaps table (without video_url for now)
    const { data: savedRecap } = await supabase
      .from('weekly_recaps')
      .insert([{
        user_id,
        week_start: startDate,
        week_end: endDate,
        summary: videoScript,
        video_url: null // Will be updated when video is complete
      }])
      .select()
      .single()

    console.log('Weekly recap saved to database (pending video completion)')

    // Return immediately with video_id and hosted_url for frontend polling
    const response: VideoRecapResponse = {
      video_id,
      hosted_url,
      video_script: videoScript,
      week_start: startDate,
      week_end: endDate,
      reflection_count: reflections.length,
      mood_average: Math.round(moodAverage * 10) / 10
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Video recap generation error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Video recap generation failed'
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

function calculateWeekRange() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  startOfWeek.setHours(0, 0, 0, 0)
  
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return {
    startDate: startOfWeek.toISOString(),
    endDate: endOfWeek.toISOString()
  }
}

function extractFirstName(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) {
    return 'friend'
  }
  
  const firstName = fullName.trim().split(' ')[0]
  return firstName || 'friend'
}

async function generateOpenAIScript(
  reflectionTexts: string[], 
  userName: string,
  OPENAI_API_KEY: string
): Promise<string> {
  
  const userPrompt = `You will be given a list of user reflections and the user's first name.

Please write a motivational script to be used in an AI video message.

Script Requirements:
- Start by greeting the user by name.
- Mention 2–3 specific examples from their reflections (including at least one challenge and one positive moment).
- Acknowledge any difficult moments with empathy and encouragement.
- Highlight their strengths and progress.
- End with an uplifting call to action for the upcoming week.
- Keep it to 5–6 sentences.
- Use warm, supportive language as if you are their personal coach and friend.

Reflections:
\`\`\`
${reflectionTexts.join('\n')}
\`\`\`

User Name:
${userName}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 500
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const completion = await response.json()
    const script = completion.choices[0].message.content.trim()

    return script
  } catch (error) {
    console.error('OpenAI script generation error:', error)
    throw new Error(`Script generation failed: ${error.message}`)
  }
}

// Create video with Tavus v2 API (Step 1 only - no polling)
async function createTavusVideo(
  script: string, 
  userName: string, 
  TAVUS_API_KEY: string,
  TAVUS_REPLICA_ID: string
): Promise<{ video_id: string, hosted_url: string }> {
  
  console.log('Creating video with Tavus v2 API...')
  
  // Validate required parameters
  if (!script || script.trim() === '') {
    throw new Error('Script is missing or empty')
  }
  
  if (!TAVUS_REPLICA_ID) {
    throw new Error('Replica ID is missing - please configure TAVUS_REPLICA_ID environment variable')
  }
  
  const requestPayload = {
    replica_id: TAVUS_REPLICA_ID,
    script: script,
    video_name: `Weekly Recap for ${userName}`,
    background_url: ""
  }
  
  console.log('Tavus v2 API request payload:', JSON.stringify(requestPayload, null, 2))
  
  try {
    // Step 1: Create video (no polling)
    const response = await fetch('https://tavusapi.com/v2/videos', {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    })

    const responseData = await response.json()
    
    console.log('Tavus v2 API response status:', response.status)
    console.log('Tavus v2 API response data:', JSON.stringify(responseData, null, 2))
    
    // Enhanced error handling
    if (!response.ok) {
      console.error('Tavus v2 API Error:', responseData)
      throw new Error(`Video creation failed: ${responseData.message || responseData.error || response.statusText}`)
    }
    
    // Extract video_id and hosted_url from response
    const video_id = responseData.video_id
    const hosted_url = responseData.hosted_url || ''
    
    if (!video_id) {
      throw new Error('No video_id received from Tavus v2 API')
    }
    
    console.log('Video creation initiated. Video ID:', video_id)
    
    return { video_id, hosted_url }
    
  } catch (error) {
    console.error('Tavus v2 video creation failed:', error)
    throw new Error(`Video creation failed: ${error.message}`)
  }
}