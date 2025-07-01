import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SentimentRequest {
  text: string;
}

interface SentimentResponse {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
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
    const { text }: SentimentRequest = await req.json()

    // Simple sentiment analysis implementation
    // In production, you would use a proper AI service like OpenAI, Azure Cognitive Services, etc.
    const sentiment = analyzeSentiment(text);

    const response: SentimentResponse = {
      sentiment: sentiment.sentiment,
      confidence: sentiment.confidence,
    };

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

function analyzeSentiment(text: string): { sentiment: 'positive' | 'neutral' | 'negative'; confidence: number } {
  const positiveWords = [
    'happy', 'joy', 'love', 'amazing', 'wonderful', 'great', 'excellent', 'fantastic',
    'good', 'awesome', 'brilliant', 'perfect', 'beautiful', 'success', 'achievement',
    'grateful', 'thankful', 'blessed', 'excited', 'motivated', 'confident', 'proud',
    'peaceful', 'content', 'satisfied', 'delighted', 'thrilled', 'optimistic'
  ];

  const negativeWords = [
    'sad', 'angry', 'hate', 'terrible', 'awful', 'bad', 'horrible', 'disappointed',
    'frustrated', 'stressed', 'anxious', 'worried', 'depressed', 'lonely', 'tired',
    'exhausted', 'overwhelmed', 'difficult', 'challenging', 'struggle', 'pain',
    'hurt', 'upset', 'annoyed', 'irritated', 'confused', 'lost', 'hopeless'
  ];

  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;

  words.forEach(word => {
    // Remove punctuation
    const cleanWord = word.replace(/[^\w]/g, '');
    
    if (positiveWords.includes(cleanWord)) {
      positiveCount++;
    } else if (negativeWords.includes(cleanWord)) {
      negativeCount++;
    }
  });

  const totalSentimentWords = positiveCount + negativeCount;
  
  if (totalSentimentWords === 0) {
    return { sentiment: 'neutral', confidence: 0.5 };
  }

  const positiveRatio = positiveCount / totalSentimentWords;
  const confidence = Math.min(totalSentimentWords / words.length * 2, 1);

  if (positiveRatio > 0.6) {
    return { sentiment: 'positive', confidence };
  } else if (positiveRatio < 0.4) {
    return { sentiment: 'negative', confidence };
  } else {
    return { sentiment: 'neutral', confidence };
  }
}