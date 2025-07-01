import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BodyAnalysisRequest {
  front_image_url: string;
  back_image_url: string;
  preferences: {
    height: string;
    weight: string;
    heightUnit: string;
    weightUnit: string;
    activities: string[];
    foods: string;
    allergies: string;
    passions: string;
    goals: string;
    trainingDays: number;
    enjoysCardio: boolean;
    // New personalization fields
    injuries: string;
    targetAreas: string;
  };
}

interface BodyAnalysisResponse {
  strengths: string;
  weaknesses: string;
  workout_plan: string;
  nutrition_advice: string;
  motivational_message: string;
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

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

    const { front_image_url, back_image_url, preferences }: BodyAnalysisRequest = await req.json()
    
    console.log('Processing enhanced body analysis request with personalization...')

    // Analyze body with OpenAI GPT-4 Vision API using enhanced prompt
    const analysis = await analyzeBodyWithOpenAI(
      front_image_url, 
      back_image_url, 
      preferences, 
      OPENAI_API_KEY
    )

    return new Response(
      JSON.stringify(analysis),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Body analysis error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Body analysis failed'
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

async function analyzeBodyWithOpenAI(
  frontImageUrl: string,
  backImageUrl: string,
  preferences: any,
  OPENAI_API_KEY: string
): Promise<BodyAnalysisResponse> {

  const systemPrompt = `You are a professional fitness coach, certified personal trainer, and licensed nutritionist. 
You help people build healthier lives through clear, actionable plans.

Analyze the following:
- The user's body shape and posture based on the photos.
- The user's preferences, goals, and lifestyle.

Your output should include:

1️⃣ **Strengths**
- Write 2–3 sentences describing what is good about their current physique, habits, or mindset.

2️⃣ **Weak Points or Areas for Improvement**
- Write 2–3 sentences, constructive and gentle.

3️⃣ **Personalized Workout Plan**
- Recommend the ideal weekly schedule (e.g., how many sessions and when).
- When generating the plan, incorporate any injuries or goals the user shared.
- Explicitly mention adjustments if there are injuries (e.g., "Since you have a shoulder injury, we will avoid overhead presses.").
- Keep the **day-by-day schedule** format.
- For each workout day, provide:
   - Specific exercises (3–5 exercises per session)
   - Sets and reps
   - Rest recommendations
- For each exercise, clearly list:
  • Name
  • Sets x Reps  
  • Rest time
- Use clear spacing and bullet points for readability.
- If they dislike cardio, propose realistic alternatives (dance, hiking, or walking with friends).
- If they don't do any workouts, suggest low-pressure activities to build consistency.
- Add 1–2 motivational tips at the end.

4️⃣ **Nutrition Advice**
- Reference the user's goals (e.g., muscle gain, fat loss).
- Provide a sample **one-day meal plan** with:
   - Breakfast, Snack, Lunch, Snack, Dinner
   - Approximate portion sizes or quantities
- For each meal, include:
  • Food Name
  • Portion Size
- List example foods for each meal that respect the user's tastes and allergies.
- Keep paragraphs short, friendly, and easy to scan.
- Include tips to optimize nutrition for their goals.
- End with 2–3 actionable nutrition tips.

5️⃣ **Motivational Message**
- End with a warm, supportive paragraph reminding them that consistency matters more than perfection (e.g., "Rome wasn't built in a day").

**Style Guidelines:**
- Use headings like "🏋️ Personalized Workout Plan" and "🍽️ Nutrition Plan."
- Avoid dense blocks of text.
- Keep a warm, motivational tone.
- Do not output JSON or code blocks.
- Use friendly, encouraging language.
- Be specific and actionable.
- Ensure all responses are in plain text format, not structured objects.

Respond with a JSON object in this exact format:
{
  "strengths": "Your detailed strengths analysis here (2-3 sentences)",
  "weaknesses": "Your constructive improvement areas here (2-3 sentences)", 
  "workout_plan": "Your detailed workout plan with specific exercises, sets, reps, and schedule as a single text string using emojis and clear formatting",
  "nutrition_advice": "Your detailed nutrition advice with sample meal plan and portions as a single text string using emojis and clear formatting",
  "motivational_message": "Your warm motivational message about consistency over perfection"
}`

  const userPrompt = `Please analyze my fitness journey and create a comprehensive plan based on:

**Physical Stats:**
- Height: ${preferences.height} ${preferences.heightUnit}
- Weight: ${preferences.weight} ${preferences.weightUnit}

**Lifestyle & Preferences:**
- Enjoys these activities: ${preferences.activities.join(', ') || 'None specified'}
- Training days per week: ${preferences.trainingDays}
- Enjoys cardio: ${preferences.enjoysCardio ? 'Yes' : 'No'}
- Favorite foods: ${preferences.foods}
- Allergies: ${preferences.allergies || 'None specified'}
- Passions: ${preferences.passions || 'None specified'}
- Goals: ${preferences.goals}

**Personalization Questions:**
- Injuries or physical limitations: ${preferences.injuries || 'None specified'}
- Target areas to improve: ${preferences.targetAreas}

Please provide a comprehensive analysis with specific workout plans including exercises, sets, reps, and a detailed sample meal plan with portions. 

IMPORTANT: 
- If there are injuries mentioned, explicitly address them in the workout plan with modifications
- Focus the workout plan on the target areas they want to improve
- Return all fields as text strings with clear formatting and emojis, not structured objects
- Use the style guidelines provided (🏋️ headings, bullet points, clear spacing)`

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
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: frontImageUrl,
                  detail: 'high'
                }
              },
              {
                type: 'image_url',
                image_url: {
                  url: backImageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.65,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const completion = await response.json()
    const rawText = completion.choices[0].message.content

    try {
      const result = JSON.parse(rawText)
      
      // Validate the response structure
      if (!result.strengths || !result.weaknesses || !result.workout_plan || 
          !result.nutrition_advice || !result.motivational_message) {
        throw new Error('Invalid response format from OpenAI')
      }

      // Ensure all fields are strings, not objects
      const sanitizedResult: BodyAnalysisResponse = {
        strengths: typeof result.strengths === 'string' ? result.strengths : JSON.stringify(result.strengths),
        weaknesses: typeof result.weaknesses === 'string' ? result.weaknesses : JSON.stringify(result.weaknesses),
        workout_plan: typeof result.workout_plan === 'string' ? result.workout_plan : JSON.stringify(result.workout_plan),
        nutrition_advice: typeof result.nutrition_advice === 'string' ? result.nutrition_advice : JSON.stringify(result.nutrition_advice),
        motivational_message: typeof result.motivational_message === 'string' ? result.motivational_message : JSON.stringify(result.motivational_message)
      }

      return sanitizedResult
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError)
      
      // Enhanced fallback response with personalization
      const injuryAdjustment = preferences.injuries && preferences.injuries.toLowerCase() !== 'none' && preferences.injuries.trim() !== '' 
        ? `Since you mentioned ${preferences.injuries}, we'll modify exercises to avoid aggravating this condition. ` 
        : '';
      
      const targetAreasFocus = preferences.targetAreas 
        ? `This plan specifically targets ${preferences.targetAreas} as requested. ` 
        : '';

      return {
        strengths: "You demonstrate excellent commitment to your health journey by taking this important step and being so thorough with your information! Your willingness to invest in personal wellness and share specific details about your goals shows a positive mindset that will drive your success. There's tremendous potential for transformation and growth ahead.",
        
        weaknesses: "Like all fitness journeys, there are opportunities to build greater consistency in your routine and gradually increase physical challenges. " + 
                   (preferences.injuries && preferences.injuries.toLowerCase() !== 'none' ? `We'll need to work carefully around your ${preferences.injuries} to ensure safe progress. ` : '') +
                   "Focus on developing sustainable habits that align with your lifestyle and preferences for long-term success.",
        
        workout_plan: `🏋️ **Personalized Workout Plan**

${injuryAdjustment}${targetAreasFocus}

**Weekly Schedule (${preferences.trainingDays} days/week):**

**Day 1 - Upper Body Strength:**
• Push-ups: 3 sets of 8-12 reps
• Bodyweight rows: 3 sets of 6-10 reps  
• Shoulder press: 3 sets of 10-15 reps${preferences.injuries && preferences.injuries.toLowerCase().includes('shoulder') ? ' (modified - use light weights)' : ''}
• Plank hold: 3 sets of 30-60 seconds
• Rest: 60-90 seconds between sets

**Day 2 - Lower Body & Core:**
• Squats: 3 sets of 12-15 reps
• Lunges: 3 sets of 10 per leg${preferences.injuries && preferences.injuries.toLowerCase().includes('knee') ? ' (shorter range of motion)' : ''}
• Glute bridges: 3 sets of 15-20 reps
• Dead bug: 3 sets of 10 per side
• Rest: 60-90 seconds between sets

${preferences.trainingDays >= 3 ? `**Day 3 - Full Body Circuit:**
• Burpees: 3 sets of 5-8 reps${preferences.injuries && preferences.injuries.toLowerCase().includes('back') ? ' (step back version)' : ''}
• Mountain climbers: 3 sets of 20 total
• Wall sit: 3 sets of 30-45 seconds
• Russian twists: 3 sets of 20 total
• Rest: 45-60 seconds between exercises

` : ''}${!preferences.enjoysCardio ? '**Cardio Alternative:** Try 20-30 minutes of dancing, hiking, or recreational sports 2x per week.' : '**Cardio:** Add 20-30 minutes of walking, cycling, or swimming 2-3x per week.'}

**💪 Motivational Tips:**
• Start with lighter weights and focus on proper form
• Progress gradually - consistency beats intensity every time!`,

        nutrition_advice: `🍽️ **Nutrition Plan**

Designed to support ${preferences.goals.toLowerCase().includes('muscle') ? 'muscle building' : preferences.goals.toLowerCase().includes('fat') ? 'fat loss' : 'your fitness goals'}.

**Sample One-Day Meal Plan:**

**Breakfast:**
• 2 whole eggs + 1 slice whole grain toast
• 1 cup mixed berries
• 1 cup green tea or coffee

**Mid-Morning Snack:**
• 1 apple with 2 tbsp almond butter

**Lunch:**
• 4 oz grilled chicken or tofu
• 1 cup quinoa or brown rice
• 2 cups mixed vegetables (steamed or roasted)
• 1 tbsp olive oil

**Afternoon Snack:**
• Greek yogurt (1 cup) with handful of nuts

**Dinner:**
• 4 oz lean protein (fish, chicken, or beans)
• Large mixed salad with olive oil dressing
• 1 cup roasted vegetables

**💧 Hydration:** Aim for 8-10 glasses of water daily

**🥗 Nutrition Tips:**
• ${preferences.allergies ? `Avoid: ${preferences.allergies}. ` : ''}Include foods you enjoy like ${preferences.foods} in moderation
• Focus on whole, unprocessed options for 80% of your meals
• Meal prep on weekends to stay consistent during busy weekdays`,

        motivational_message: "Remember, Rome wasn't built in a day, and your fitness journey is a marathon, not a sprint! " + 
                             (preferences.injuries ? "Even with your physical limitations, every small step you take today builds the foundation for tomorrow's success. " : "Every small step you take today builds the foundation for tomorrow's success. ") +
                             "Consistency matters far more than perfection – it's better to do something small every day than to attempt perfection and burn out. " +
                             (preferences.targetAreas ? `Your focus on ${preferences.targetAreas} shows clear direction, and this targeted approach will help you see results faster. ` : "") +
                             "Trust the process, celebrate small wins, and be patient with yourself. Your commitment to improving your health is already a victory worth celebrating. You have everything within you to achieve your goals – stay consistent, stay positive, and embrace every part of this transformative journey!"
      }
    }
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error(`Body analysis failed: ${error.message}`)
  }
}