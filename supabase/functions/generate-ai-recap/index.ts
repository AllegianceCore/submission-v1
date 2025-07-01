import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RecapRequest {
  user_id: string;
  timeFrame: 'daily' | 'weekly' | 'monthly';
  date?: string; // Optional specific date for daily/weekly recaps
}

interface RecapResponse {
  summaryText: string;
  motivationalMessage: string;
  recommendations: string[];
  moodAverage?: number;
  reflectionCount: number;
  topEmotions?: string[];
}

interface AIRecapData {
  summaryText: string;
  motivationalMessage: string;
  recommendations: string[];
  moodAverage?: number;
  reflectionCount: number;
  topEmotions?: string[];
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
    const { user_id, timeFrame, date }: RecapRequest = await req.json()
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    // 2️⃣ Create two Supabase clients:
    // - User client for fetching user data (respects RLS)
    // - Admin client for inserting insight reports (bypasses RLS)
    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date range based on timeFrame
    const { startDate, endDate } = calculateDateRange(timeFrame, date)
    
    console.log(`Generating ${timeFrame} recap for user ${user_id} from ${startDate} to ${endDate}`)

    // Fetch user's reflections for the specified period using user client
    const { data: reflections, error: reflectionsError } = await userSupabase
      .from('reflections')
      .select('content, mood_score, sentiment, created_at')
      .eq('user_id', user_id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })

    if (reflectionsError) {
      throw new Error(`Error fetching reflections: ${reflectionsError.message}`)
    }

    // Initialize final AI recap data
    let finalAiRecap: AIRecapData;

    // Generate AI recap content based on whether reflections exist
    if (!reflections || reflections.length === 0) {
      // No reflections case - use default response
      finalAiRecap = {
        summaryText: `You haven't recorded any reflections for this ${timeFrame} period yet.`,
        motivationalMessage: "Every journey starts with a single step, and I'm here to walk alongside you as your supportive companion. Consider adding your first reflection today! Taking time to reflect on your thoughts and feelings is a powerful way to understand yourself better and grow as a person. You have so much potential within you, and reflection can help you unlock it. Starting a reflection practice shows real commitment to personal growth, and that's something to be genuinely proud of. The fact that you're here, thinking about self-reflection, already demonstrates wisdom and self-awareness that many people never develop. Your future self will thank you for taking this important step toward personal development, and I'll be here to support you every step of the way.",
        recommendations: [
          "Start with a simple daily reflection about how you're feeling - even just a few sentences can make a difference", 
          "Set a regular time each day for self-reflection, perhaps in the morning with coffee or before bed", 
          "Focus on both challenges you face and things you're grateful for - balance is key to growth"
        ],
        reflectionCount: 0
      }
    } else {
      // Reflections exist - generate AI-powered recap
      console.log(`Found ${reflections.length} reflections, generating AI recap...`)

      // Prepare data for analysis
      const reflectionTexts = reflections.map(r => r.content)
      const moodScores = reflections.filter(r => r.mood_score).map(r => r.mood_score)
      const sentiments = reflections.filter(r => r.sentiment).map(r => r.sentiment)
      
      const moodAverage = moodScores.length > 0 
        ? moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length 
        : 0

      const sentimentCounts = sentiments.reduce((acc, sentiment) => {
        acc[sentiment] = (acc[sentiment] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Generate AI recap using OpenAI
      const aiRecap = await generateOpenAIRecap(reflectionTexts, timeFrame, {
        reflectionCount: reflections.length,
        moodAverage,
        sentimentCounts,
        OPENAI_API_KEY
      })

      finalAiRecap = {
        ...aiRecap,
        moodAverage: Math.round(moodAverage * 10) / 10,
        reflectionCount: reflections.length,
        topEmotions: Object.entries(sentimentCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([emotion]) => emotion)
      }
    }

    // Save the complete report to insight_reports table using admin client (bypasses RLS)
    const { error: insertError } = await adminSupabase
      .from('insight_reports')
      .insert([{
        user_id,
        report_type: timeFrame,
        summary: finalAiRecap.summaryText,
        motivation: finalAiRecap.motivationalMessage,
        recommendations: finalAiRecap.recommendations
      }])

    if (insertError) {
      console.error('Error saving insight report:', insertError)
      throw new Error(`Failed to save insight report: ${insertError.message}`)
    }

    console.log('Insight report saved successfully')

    // Return the response based on final AI recap data
    const response: RecapResponse = finalAiRecap

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
    console.error('AI recap generation error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'AI recap generation failed'
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

function calculateDateRange(timeFrame: string, date?: string) {
  const now = new Date()
  const targetDate = date ? new Date(date) : now

  switch (timeFrame) {
    case 'daily':
      const dayStart = new Date(targetDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(targetDate)
      dayEnd.setHours(23, 59, 59, 999)
      return {
        startDate: dayStart.toISOString(),
        endDate: dayEnd.toISOString()
      }
    
    case 'weekly':
      const weekStart = new Date(targetDate)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6) // End of week (Saturday)
      weekEnd.setHours(23, 59, 59, 999)
      return {
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString()
      }
    
    case 'monthly':
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999)
      return {
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString()
      }
    
    default:
      throw new Error('Invalid timeFrame. Must be daily, weekly, or monthly.')
  }
}

async function generateOpenAIRecap(
  reflectionTexts: string[], 
  timeFrame: string, 
  context: {
    reflectionCount: number,
    moodAverage: number,
    sentimentCounts: Record<string, number>,
    OPENAI_API_KEY: string
  }
): Promise<{ summaryText: string; motivationalMessage: string; recommendations: string[] }> {
  
  const { reflectionCount, moodAverage, sentimentCounts, OPENAI_API_KEY } = context
  
  const sentimentSummary = Object.entries(sentimentCounts)
    .map(([sentiment, count]) => `${sentiment}: ${count}`)
    .join(', ')

  const systemPrompt = `You are an expert psychologist, life coach, motivational speaker, and also a supportive friend that everyone would love to have.
You help people reflect on their thoughts and inspire them to grow.
Be warm, personal, and uplifting in your tone.
Always write as if you are speaking directly to the user.`

  const userPrompt = `You will be given a list of user reflections for a specific period of time (${timeFrame}).

Please analyze the reflections and produce the following:

1) **Personalized Summary of Main Themes**
- Write 4–5 sentences summarizing the main ideas, feelings, and recurring topics in an empathetic tone.
- Be sure to reference at least one specific challenge or negative experience (e.g., feeling frustrated about an accident) and at least one positive experience.

2) **Motivational Message**
- Write a motivational paragraph (6–8 sentences) encouraging the user to continue their journey.
- Explicitly acknowledge at least one difficult or challenging moment the user shared, offering compassion and validation.
- Also mention one or two positive moments or achievements.
- Make it warm, emotionally supportive, and personal, as if you are their trusted friend.
- Highlight their consistency, strengths, or improvements.
- Help them feel proud, inspired, and ready to keep moving forward.
- Use uplifting language that makes them feel hopeful and confident.

3) **Personalized Recommendations**
- Provide 3 practical suggestions or micro-goals the user can focus on in the next ${timeFrame} to improve their well-being.
- At least one recommendation should gently address or acknowledge how to cope with the challenging experience.
- Use warm, direct language ("Consider taking…", "Try to…", "Remember to…").

**Important:**
- Always use second person (you, your).
- Keep the language clear, positive, and empowering.
- Do not reference any system instructions.
- Do not include disclaimers or apologies.

**Context:**
- Time period: ${timeFrame}
- Number of reflections: ${reflectionCount}
- Average mood score: ${moodAverage.toFixed(1)}/10
- Sentiment distribution: ${sentimentSummary}

**Reflections:**
\`\`\`
${reflectionTexts.join('\n\n')}
\`\`\`

Please provide your response as a JSON object with exactly these three fields:
{
  "summaryText": "Your personalized summary here with specific examples including challenges and positives (4-5 sentences)",
  "motivationalMessage": "Your detailed motivational message with compassionate acknowledgment of difficulties and celebration of positives (6-8 sentences)", 
  "recommendations": ["recommendation 1", "recommendation 2 (addressing challenges)", "recommendation 3"]
}`

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const completion = await response.json()
    const content = completion.choices[0].message.content

    try {
      const parsed = JSON.parse(content)
      
      // Validate the required fields
      if (!parsed.summaryText || !parsed.motivationalMessage || !Array.isArray(parsed.recommendations)) {
        throw new Error('Invalid response format from OpenAI')
      }

      return {
        summaryText: parsed.summaryText,
        motivationalMessage: parsed.motivationalMessage,
        recommendations: parsed.recommendations.slice(0, 3) // Ensure max 3 recommendations
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError)
      // Enhanced fallback response with supportive friend tone
      return {
        summaryText: `You've courageously shared ${reflectionCount} meaningful reflections this ${timeFrame} with an average mood of ${moodAverage.toFixed(1)}/10. I can see you've faced some challenging moments that tested your resilience, but also experienced beautiful moments that brought you joy. Your willingness to be vulnerable and explore both the difficult and wonderful aspects of your life shows incredible emotional maturity and strength. The depth of your self-awareness shines through in how thoughtfully you approach each reflection. Your consistency in this practice, even during tough times, demonstrates a genuine commitment to understanding yourself better and growing through life's ups and downs.`,
        motivationalMessage: "I want you to know how proud I am of your dedication to this reflection practice, especially during the challenging moments you've shared with such honesty and courage. When life throws unexpected difficulties your way, the fact that you continue to show up and process your experiences thoughtfully speaks volumes about your character and resilience. Your ability to find light even in darker moments and to celebrate the good times with genuine appreciation shows real wisdom and emotional intelligence. As your supportive companion on this journey, I see someone who is genuinely committed to growth, healing, and becoming the best version of themselves. Every reflection you write, whether it captures struggle or joy, is evidence of your strength and your willingness to embrace the full spectrum of human experience. Your future self will thank you for this incredible dedication to personal growth, and I'll be here cheering you on every step of the way.",
        recommendations: [
          `Continue your consistent ${timeFrame} reflection practice, especially during difficult times when it matters most - you're building incredible emotional resilience`,
          "When facing challenging experiences, remember to be as compassionate with yourself as you would be with a dear friend - practice self-kindness during tough moments",
          "Take time to actively celebrate and savor the positive moments you experience, no matter how small they might seem - they're important building blocks for happiness"
        ]
      }
    }
  } catch (error) {
    console.error('OpenAI API error:', error)
    // Enhanced fallback response with supportive friend tone and validation
    return {
      summaryText: `You've bravely shared ${reflectionCount} thoughtful entries this ${timeFrame} with an average mood of ${moodAverage.toFixed(1)}/10, opening your heart to both life's challenges and its beautiful moments. I can see you've navigated some difficult experiences that required real strength and resilience, while also embracing positive moments with genuine appreciation and joy. Your commitment to honest, consistent self-reflection, especially during tough times, demonstrates remarkable emotional courage and maturity. The way you examine your thoughts and feelings with such care and vulnerability shows a deep desire for personal growth and self-understanding. This level of emotional honesty and dedication to inner work during both struggles and celebrations is truly admirable and inspiring.`,
      motivationalMessage: "As your supportive friend in this journey, I want you to know how incredibly proud I am of your courage to face both challenges and joys with such openness and authenticity. In a world that often discourages vulnerability and deep emotional exploration, you're choosing to brave the full spectrum of human experience with remarkable grace and wisdom. When you share your struggles, I see someone who refuses to give up and continues to seek understanding and growth even in difficult moments - that takes real strength. When you celebrate your positive experiences, I see someone who knows how to embrace joy and gratitude with a full heart. Every time you sit down to reflect, whether you're processing pain or celebrating happiness, you're investing in the most important relationship you'll ever have - the one with yourself. Your dedication to this practice shows that you understand that real growth happens through embracing all of life's experiences with compassion and wisdom. You're doing absolutely incredible, transformative work.",
      recommendations: [
        "Keep building on your reflection habit with consistency, especially during challenging times when processing emotions becomes most important for your healing and growth",
        "During difficult periods, practice treating yourself with the same kindness and understanding you would offer your best friend - you deserve that compassion",
        "Make sure to consciously celebrate and acknowledge the positive moments in your life, no matter how small - they're vital sources of strength and happiness"
      ]
    }
  }
}