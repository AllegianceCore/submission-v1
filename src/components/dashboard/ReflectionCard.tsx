import React, { useState, useEffect, useRef } from 'react';
import { Heart, Mic, Send, Volume2, MicOff, Loader, AlertCircle } from 'lucide-react';
import { supabase, Reflection } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface ReflectionCardProps {
  onReflectionSaved?: () => void;
}

export function ReflectionCard({ onReflectionSaved }: ReflectionCardProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [moodScore, setMoodScore] = useState(5);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [todaysReflection, setTodaysReflection] = useState<Reflection | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user) {
      fetchTodaysReflection();
    }
  }, [user]);

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const fetchTodaysReflection = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setTodaysReflection(data);
      setContent(data.content);
      setMoodScore(data.mood_score || 5);
    }
  };

  const startRecording = async () => {
    try {
      setTranscriptionError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        if (blob.size > 0) {
          await transcribeAudio(blob);
        } else {
          setTranscriptionError('No audio recorded. Please try again.');
        }
        
        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setTranscriptionError('Recording failed. Please try again.');
        setIsRecording(false);
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setTranscriptionError('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size === 0) {
      setTranscriptionError('No audio to transcribe.');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'reflection.webm');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const { text } = await response.json();
      
      if (text && text.trim()) {
        // Append to existing content or replace if empty
        setContent(prev => {
          const newText = text.trim();
          if (!prev.trim()) {
            return newText;
          }
          return prev + '\n\n' + newText;
        });
      } else {
        setTranscriptionError('No speech detected. Please try again.');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setTranscriptionError('Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const analyzeSentiment = async (text: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-sentiment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Sentiment analysis failed');
      }

      const { sentiment } = await response.json();
      return sentiment;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return 'neutral';
    }
  };

  const generateVoice = async (text: string, voiceId: string = 'Rachel') => {
    // Skip voice generation if text is empty
    if (!text || !text.trim()) {
      console.log('Skipping voice generation: empty text');
      return null;
    }

    setIsGeneratingVoice(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text.trim(),
          voice_id: '21m00Tcm4TlvDq8ikWAM' // Rachel's voice ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Voice generation failed');
      }

      const { voice_url } = await response.json();
      console.log('Voice generation completed successfully');
      return voice_url;
    } catch (error) {
      console.error('Error generating voice:', error);
      throw error; // Re-throw to be handled by handleSubmit
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      console.log('Starting reflection submission...');
      
      // Step 1: Analyze sentiment
      console.log('Analyzing sentiment...');
      const sentiment = await analyzeSentiment(content);
      
      // Step 2: Generate voice (only if text is not empty)
      let voice_url = null;
      if (content && content.trim().length > 0) {
        console.log('Generating voice with Rachel voice...');
        try {
          voice_url = await generateVoice(content.trim(), 'Rachel');
        } catch (voiceError) {
          console.error('Voice generation failed:', voiceError);
          // Don't fail the entire submission if voice generation fails
          // Just log the error and continue without voice
        }
      } else {
        console.log('Skipping voice generation: empty text');
      }

      // Step 3: Save reflection to database
      console.log('Saving reflection to database...');
      const reflectionData = {
        user_id: user.id,
        content: content.trim(),
        mood_score: moodScore,
        sentiment,
        voice_url,
      };

      if (todaysReflection) {
        // Update existing reflection
        const { error } = await supabase
          .from('reflections')
          .update(reflectionData)
          .eq('id', todaysReflection.id);
        
        if (error) throw error;
      } else {
        // Create new reflection
        const { error } = await supabase
          .from('reflections')
          .insert([reflectionData]);
        
        if (error) throw error;
      }

      console.log('Reflection saved successfully');
      await fetchTodaysReflection();
      onReflectionSaved?.();
      
    } catch (error) {
      console.error('Error updating reflection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save reflection';
      setSubmitError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const playVoice = () => {
    if (todaysReflection?.voice_url && audioPlayerRef.current) {
      audioPlayerRef.current.src = todaysReflection.voice_url;
      audioPlayerRef.current.play().catch(console.error);
    }
  };

  const moodEmojis = ['😢', '😕', '😐', '🙂', '😊', '😄', '😍', '🤩', '🥳', '🌟'];
  const moodLabels = ['Very Low', 'Low', 'Below Average', 'Neutral', 'Good', 'Happy', 'Great', 'Excellent', 'Amazing', 'Fantastic'];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
          <Heart className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Reflection</h2>
          <p className="text-sm text-gray-500">How are you feeling today?</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mood Slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Mood Level: {moodEmojis[moodScore - 1]} {moodLabels[moodScore - 1]}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={moodScore}
            onChange={(e) => setMoodScore(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #ef4444 0%, #f97316 25%, #eab308 50%, #22c55e 75%, #10b981 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Reflection Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Reflection
          </label>
          <div className="relative">
            <textarea
              id="reflectionTextarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, feelings, and experiences from today... Or click the microphone to record your voice!"
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
            
            {/* Voice Recording Button */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isTranscribing}
              className={`absolute bottom-3 right-3 p-2 rounded-lg transition-all transform hover:scale-105 ${
                isRecording
                  ? 'bg-red-100 text-red-600 animate-pulse shadow-lg'
                  : isTranscribing
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice recording'}
            >
              {isTranscribing ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {/* Recording Status */}
          {isRecording && (
            <div className="flex items-center gap-2 mt-2 text-red-600">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Recording... Click the microphone to stop</span>
            </div>
          )}
          
          {isTranscribing && (
            <div className="flex items-center gap-2 mt-2 text-blue-600">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Transcribing your voice...</span>
            </div>
          )}

          {/* Transcription Error */}
          {transcriptionError && (
            <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{transcriptionError}</span>
            </div>
          )}

          {/* Submit Error */}
          {submitError && (
            <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{submitError}</span>
            </div>
          )}
        </div>

        {/* Voice Playback */}
        {todaysReflection?.voice_url && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
            <Volume2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-700">AI voice recording available</span>
            <button
              type="button"
              onClick={playVoice}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
            >
              Play
            </button>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !content.trim() || isGeneratingVoice || isRecording}
          className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : isGeneratingVoice ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Generating voice...
            </>
          ) : (
            <>
              {todaysReflection ? 'Update Reflection' : 'Save Reflection'}
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Sentiment Display */}
      {todaysReflection?.sentiment && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600">
            Today's sentiment: 
            <span className={`ml-2 font-medium capitalize ${
              todaysReflection.sentiment === 'positive' ? 'text-green-600' :
              todaysReflection.sentiment === 'negative' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {todaysReflection.sentiment}
            </span>
          </p>
        </div>
      )}

      {/* Hidden Audio Player */}
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />
    </div>
  );
}