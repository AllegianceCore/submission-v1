import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface UpdateVideoRequest {
  user_id: string;
  video_url: string;
  week_start: string;
  week_end: string;
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
    const body = await req.json();
    const { user_id, video_url, week_start, week_end }: UpdateVideoRequest = body;
    
    // Validate inputs
    if (!user_id || !video_url || !week_start || !week_end) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, video_url, week_start, week_end" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Initialize Supabase client with service key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`Updating video URL for user ${user_id}, week ${week_start} to ${week_end}`)

    // Update the weekly_recaps record with the final video URL
    const { data: updatedRecap, error } = await supabase
      .from('weekly_recaps')
      .update({ video_url })
      .eq('user_id', user_id)
      .eq('week_start', week_start)
      .eq('week_end', week_end)
      .select()
      .single()

    if (error) {
      throw new Error(`Error updating video URL: ${error.message}`)
    }

    console.log('Video URL updated successfully:', updatedRecap)

    return new Response(
      JSON.stringify({ 
        success: true, 
        recap: updatedRecap 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Video URL update error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Video URL update failed'
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