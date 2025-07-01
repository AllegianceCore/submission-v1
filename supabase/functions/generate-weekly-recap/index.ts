import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WeeklyRecapRequest {
  user_id: string;
  week_start: string;
  week_end: string;
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
    const { user_id, week_start, week_end }: WeeklyRecapRequest = await req.json()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // 2️⃣ Use Supabase Client with Authorization
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Fetch user's reflections for the week
    const { data: reflections } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', week_start)
      .lte('created_at', week_end)
      .order('created_at', { ascending: true })

    // Fetch user's habit completions for the week
    const { data: habitCompletions } = await supabase
      .from('habit_completions')
      .select('*, habits(*)')
      .eq('user_id', user_id)
      .gte('completed_at', week_start)
      .lte('completed_at', week_end)

    // Generate summary
    const summary = generateWeeklySummary(reflections || [], habitCompletions || [])
    
    // In a real implementation, you would:
    // 1. Use Tavus API to generate a personalized video
    // 2. Upload the video to storage
    // 3. Return the video URL
    
    const TAVUS_API_KEY = Deno.env.get('TAVUS_API_KEY')
    
    let videoUrl = null
    if (TAVUS_API_KEY) {
      // Placeholder for Tavus integration
      // videoUrl = await generateTavusVideo(summary, user_id)
    }

    // Save the weekly recap
    const { data: recap } = await supabase
      .from('weekly_recaps')
      .insert([{
        user_id,
        week_start,
        week_end,
        summary,
        video_url: videoUrl,
      }])
      .select()
      .single()

    return new Response(
      JSON.stringify(recap),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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

function generateWeeklySummary(reflections: any[], habitCompletions: any[]): string {
  const totalReflections = reflections.length
  const avgMood = reflections.reduce((sum, r) => sum + (r.mood_score || 0), 0) / totalReflections || 0
  
  const sentimentCounts = reflections.reduce((acc, r) => {
    if (r.sentiment) acc[r.sentiment]++
    return acc
  }, { positive: 0, neutral: 0, negative: 0 })

  const habitStats = habitCompletions.reduce((acc, hc) => {
    const habitName = hc.habits?.name || 'Unknown'
    acc[habitName] = (acc[habitName] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  let summary = `This week you recorded ${totalReflections} reflections with an average mood score of ${avgMood.toFixed(1)}/10. `
  
  if (sentimentCounts.positive > sentimentCounts.negative) {
    summary += "Your overall sentiment was positive this week! "
  } else if (sentimentCounts.negative > sentimentCounts.positive) {
    summary += "You had some challenging moments this week, but you're making progress. "
  } else {
    summary += "You maintained a balanced emotional state this week. "
  }

  if (Object.keys(habitStats).length > 0) {
    summary += `You completed ${Object.values(habitStats).reduce((a, b) => a + b, 0)} habit actions this week. `
    const topHabit = Object.entries(habitStats).sort(([,a], [,b]) => b - a)[0]
    summary += `Great job staying consistent with ${topHabit[0]}! `
  }

  summary += "Keep up the great work on your transformation journey!"

  return summary
}