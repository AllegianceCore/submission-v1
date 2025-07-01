import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader, AlertCircle, Volume2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface DailyReflectionFormProps {
  onReflectionAdded: () => void;
}

export function DailyReflectionForm({ onReflectionAdded }: DailyReflectionFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [moodScore, setMoodScore] = useState(5);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [voiceGenerationError, setVoiceGenerationError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Check authentication before any operation
  const checkAuthentication = () => {
    if (!user) {
      throw new Error('You must be signed in to perform this action');
    }
    return user;
  };

  const startRecording = async () => {
    try {
      // Check authentication first
      checkAuthentication();
      
      setTranscriptionError(null);
      
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
        
        if (blob.size > 0) {
          await transcribeAudio(blob);
        } else {
          setTranscriptionError('No audio recorded. Please try again.');
        }
        
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

      mediaRecorderRef.current.start(1000);
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
      // Check authentication
      const currentUser = checkAuthentication();
      
      // Get current session for authorization
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session found. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'reflection.webm');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const { text } = await response.json();
      
      if (text && text.trim()) {
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
      setTranscriptionError(error instanceof Error ? error.message : 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const analyzeSentiment = async (text: string) => {
    try {
      // Check authentication
      checkAuthentication();
      
      // Get current session for authorization
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session found. Please sign in again.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-sentiment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
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

  const generateVoice = async (text: string) => {
    if (!text || !text.trim()) {
      return null;
    }

    setIsGeneratingVoice(true);
    setVoiceGenerationError(null);

    try {
      // Check authentication
      const currentUser = checkAuthentication();
      
      // Get current session for authorization
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session found. Please sign in again.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
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
      setVoiceGenerationError(error instanceof Error ? error.message : 'Voice generation failed');
      return null; // Don't throw, just return null so reflection can still be saved
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setSubmitError('Please enter your reflection.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setVoiceGenerationError(null);

    try {
      // Check authentication first
      const currentUser = checkAuthentication();
      
      // Get current session to ensure we have a valid token
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session found. Please sign in again.');
      }

      console.log('Starting reflection submission for user:', currentUser.id);
      
      // Step 1: Analyze sentiment
      const sentiment = await analyzeSentiment(content);
      
      // Step 2: Generate voice (optional - don't fail if it doesn't work)
      let voice_url = null;
      if (content.trim().length > 0) {
        voice_url = await generateVoice(content.trim());
      }

      // Step 3: Save reflection to database with explicit user_id
      console.log('Saving reflection with user_id:', currentUser.id);
      
      const reflectionData = {
        user_id: currentUser.id, // Explicitly include user_id
        content: content.trim(),
        mood_score: moodScore,
        sentiment,
        voice_url,
      };

      console.log('Reflection data to insert:', reflectionData);

      const { error } = await supabase
        .from('reflections')
        .insert([reflectionData]);

      if (error) {
        console.error('Database insertion error:', error);
        throw new Error(`Failed to save reflection: ${error.message}`);
      }

      console.log('Reflection saved successfully');

      // Clear form and notify parent
      setContent('');
      setMoodScore(5);
      setSubmitError(null);
      setVoiceGenerationError(null);
      onReflectionAdded();
      
    } catch (error) {
      console.error('Error saving reflection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save reflection';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearVoiceError = () => {
    setVoiceGenerationError(null);
  };

  const moodEmojis = ['😢', '😕', '😐', '🙂', '😊', '😄', '😍', '🤩', '🥳', '🌟'];
  const moodLabels = ['Very Low', 'Low', 'Below Average', 'Neutral', 'Good', 'Happy', 'Great', 'Excellent', 'Amazing', 'Fantastic'];

  // Show authentication error if user is not signed in
  if (!user) {
    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <span className="text-sm text-yellow-700">
            Please sign in to add reflections.
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-xl">
      <h3 className="font-semibold text-gray-900">Add New Reflection</h3>
      
      {/* Mood Slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts, feelings, and experiences... Or click the microphone to record your voice!"
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            required
          />
          
          {/* Voice Recording Button */}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isTranscribing}
            className={`absolute bottom-2 right-2 p-1.5 rounded-lg transition-all transform hover:scale-105 ${
              isRecording
                ? 'bg-red-100 text-red-600 animate-pulse'
                : isTranscribing
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice recording'}
          >
            {isTranscribing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {/* Recording Status */}
        {isRecording && (
          <div className="flex items-center gap-2 mt-1 text-red-600">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">Recording...</span>
          </div>
        )}
        
        {isTranscribing && (
          <div className="flex items-center gap-2 mt-1 text-blue-600">
            <Loader className="w-3 h-3 animate-spin" />
            <span className="text-xs">Transcribing...</span>
          </div>
        )}

        {/* Voice Generation Status */}
        {isGeneratingVoice && (
          <div className="flex items-center gap-2 mt-1 text-purple-600">
            <Loader className="w-3 h-3 animate-spin" />
            <span className="text-xs">Generating voice...</span>
          </div>
        )}

        {/* Transcription Error */}
        {transcriptionError && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700">{transcriptionError}</span>
          </div>
        )}

        {/* Voice Generation Error */}
        {voiceGenerationError && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-xs text-yellow-700">
                Voice generation failed: {voiceGenerationError}
              </span>
              <p className="text-xs text-yellow-600 mt-1">
                Your reflection will be saved without voice.
              </p>
            </div>
            <button
              type="button"
              onClick={clearVoiceError}
              className="text-yellow-400 hover:text-yellow-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700">{submitError}</span>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !content.trim() || isRecording}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 text-sm"
      >
        {isSubmitting ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            Add Reflection
            <Send className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}