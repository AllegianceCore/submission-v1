import React, { useState, useEffect, useRef } from 'react';
import { Video, Calendar, Clock, Play, Loader, RefreshCw, Download, Sparkles, AlertCircle, ExternalLink, Info, CheckCircle, Search, Filter, RotateCcw, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, WeeklyRecap, getCurrentSession } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface WeeklyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VideoRecapData {
  video_id: string;
  hosted_url: string;
  video_script: string;
  week_start: string;
  week_end: string;
  reflection_count: number;
  mood_average: number;
  video_url?: string; // Final video URL when completed
}

interface VideoStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'error';
  video_url?: string;
}

interface FilterState {
  searchText: string;
  startDate: string;
  endDate: string;
  sortOrder: 'newest' | 'oldest';
}

const initialFilters: FilterState = {
  searchText: '',
  startDate: '',
  endDate: '',
  sortOrder: 'newest',
};

type DisplayState = 'initial' | 'generating' | 'polling' | 'completed' | 'failed' | 'notEnoughReflections';

export function WeeklyRecapModal({ isOpen, onClose }: WeeklyRecapModalProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [recaps, setRecaps] = useState<WeeklyRecap[]>([]);
  const [filteredRecaps, setFilteredRecaps] = useState<WeeklyRecap[]>([]);
  const [currentRecap, setCurrentRecap] = useState<VideoRecapData | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [displayState, setDisplayState] = useState<DisplayState>('initial');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflectionCount, setReflectionCount] = useState(0);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Separate state for immediate search input (debounced)
  const [rawSearchText, setRawSearchText] = useState('');

  // Use refs to track the latest state in async callbacks
  const pollingRef = useRef(false);
  const currentRecapRef = useRef<VideoRecapData | null>(null);
  const pollAttemptsRef = useRef(0);
  
  const maxPollAttempts = 40; // 10 minutes max (15 seconds * 40)

  // Debounced effect for search text
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        searchText: rawSearchText
      }));
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [rawSearchText]);

  // Update refs when state changes
  useEffect(() => {
    pollingRef.current = displayState === 'polling';
  }, [displayState]);

  useEffect(() => {
    currentRecapRef.current = currentRecap;
  }, [currentRecap]);

  useEffect(() => {
    pollAttemptsRef.current = pollAttempts;
  }, [pollAttempts]);

  useEffect(() => {
    if (isOpen && user) {
      fetchRecaps();
      fetchReflectionCount();
    }
  }, [isOpen, user]);

  // Apply filters whenever filters change or recaps change
  useEffect(() => {
    applyFilters();
  }, [recaps, filters]);

  // Cleanup polling when component unmounts or modal closes
  useEffect(() => {
    return () => {
      setDisplayState('initial');
      pollingRef.current = false;
      setPollAttempts(0);
      pollAttemptsRef.current = 0;
    };
  }, [isOpen]);

  const fetchRecaps = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from('weekly_recaps')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false });

      setRecaps(data || []);
    } catch (error) {
      console.error('Error fetching recaps:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...recaps];

    // Apply search filter - search in summary content
    if (filters.searchText.trim()) {
      const searchTerm = filters.searchText.toLowerCase().trim();
      filtered = filtered.filter(recap => {
        const summaryText = (recap.summary || '').toLowerCase();
        return summaryText.includes(searchTerm);
      });
    }

    // Apply date range filters
    if (filters.startDate) {
      filtered = filtered.filter(recap =>
        new Date(recap.created_at) >= new Date(`${filters.startDate}T00:00:00`)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(recap =>
        new Date(recap.created_at) <= new Date(`${filters.endDate}T23:59:59`)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      
      switch (filters.sortOrder) {
        case 'newest':
          return dateB - dateA;
        case 'oldest':
          return dateA - dateB;
        default:
          return 0;
      }
    });

    setFilteredRecaps(filtered);
  };

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setRawSearchText('');
  };

  const clearSearch = () => {
    setRawSearchText('');
  };

  const hasActiveFilters = () => {
    return filters.searchText !== '' ||
           filters.startDate !== '' ||
           filters.endDate !== '' ||
           filters.sortOrder !== 'newest';
  };

  const handleDeleteRecap = async (recapId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this weekly recap? This action cannot be undone.')) {
      return;
    }

    setDeleting(recapId);
    try {
      const { error } = await supabase
        .from('weekly_recaps')
        .delete()
        .eq('id', recapId)
        .eq('user_id', user.id); // Extra security check

      if (error) throw error;
      
      // Remove from local state
      setRecaps(prev => prev.filter(r => r.id !== recapId));
    } catch (error) {
      console.error('Error deleting recap:', error);
      alert('Failed to delete recap. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const fetchReflectionCount = async () => {
    if (!user) return;

    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const { count } = await supabase
      .from('reflections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    const reflectionCount = count || 0;
    setReflectionCount(reflectionCount);
    
    // Set initial display state based on reflection count
    if (reflectionCount < 3) {
      setDisplayState('notEnoughReflections');
    } else {
      setDisplayState('initial');
    }
  };

  // Helper function to get authenticated headers
  const getAuthenticatedHeaders = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const session = await getCurrentSession();
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  const generateWeeklyVideoRecap = async () => {
    if (!user) return;

    setDisplayState('generating');
    setError(null);
    setCurrentRecap(null);
    setVideoStatus(null);
    setPollAttempts(0);
    pollAttemptsRef.current = 0;

    try {
      console.log('Starting weekly video recap generation...');
      
      // Get authenticated headers
      const headers = await getAuthenticatedHeaders();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video-recap`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const recapData: VideoRecapData = await response.json();
      setCurrentRecap(recapData);
      currentRecapRef.current = recapData;
      
      console.log('Video generation initiated, starting polling for video_id:', recapData.video_id);
      
      // Transition to polling state
      setDisplayState('polling');
      pollingRef.current = true;
      setPollAttempts(0);
      pollAttemptsRef.current = 0;
      
      // Start polling immediately
      pollVideoStatus(recapData.video_id, recapData.week_start, recapData.week_end);
      
    } catch (err) {
      console.error('Error generating video recap:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate video recap');
      setDisplayState('failed');
    }
  };

  const pollVideoStatus = async (videoId: string, weekStart: string, weekEnd: string) => {
    // Check if we should continue polling using refs
    if (!pollingRef.current || !user) {
      console.log('Polling stopped - either polling disabled or no user');
      return;
    }

    try {
      const currentAttempt = pollAttemptsRef.current + 1;
      console.log(`Polling video status (attempt ${currentAttempt}/${maxPollAttempts})`);
      
      // Get authenticated headers for each poll request
      const headers = await getAuthenticatedHeaders();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poll-video-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          video_id: videoId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check video status');
      }

      const statusData: VideoStatus = await response.json();
      setVideoStatus(statusData);
      
      console.log('Video status:', statusData.status);

      if (statusData.status === 'completed' && statusData.video_url) {
        console.log('Video completed successfully with URL:', statusData.video_url);
        
        // Stop polling and transition to completed state
        setDisplayState('completed');
        pollingRef.current = false;
        
        // Update currentRecap with final video URL
        setCurrentRecap(prev => {
          const updated = prev ? {
            ...prev,
            video_url: statusData.video_url
          } : null;
          currentRecapRef.current = updated;
          return updated;
        });
        
        // Update the database with final video URL
        await updateVideoUrl(user.id, statusData.video_url, weekStart, weekEnd);
        await fetchRecaps(); // Refresh the list
        
        console.log('Video recap completed and saved!');
        
      } else if (statusData.status === 'failed' || statusData.status === 'error') {
        console.log('Video generation failed with status:', statusData.status);
        setDisplayState('failed');
        pollingRef.current = false;
        setError(`Video generation failed with status: ${statusData.status}`);
        
      } else {
        // Continue polling if still processing
        setPollAttempts(currentAttempt);
        pollAttemptsRef.current = currentAttempt;
        
        if (currentAttempt >= maxPollAttempts) {
          console.log('Polling timeout reached');
          setDisplayState('failed');
          pollingRef.current = false;
          setError('Video generation timed out. The video may still be processing.');
        } else {
          // Schedule next poll in 15 seconds
          console.log(`Video still ${statusData.status}, scheduling next poll in 15 seconds...`);
          setTimeout(() => {
            // Use ref to check if we should continue polling
            if (pollingRef.current && currentRecapRef.current) {
              pollVideoStatus(videoId, weekStart, weekEnd);
            } else {
              console.log('Polling cancelled due to state change');
            }
          }, 15000);
        }
      }
      
    } catch (error) {
      console.error(`Polling attempt ${pollAttemptsRef.current + 1} failed:`, error);
      
      const newAttempts = pollAttemptsRef.current + 1;
      setPollAttempts(newAttempts);
      pollAttemptsRef.current = newAttempts;
      
      if (newAttempts >= maxPollAttempts) {
        setDisplayState('failed');
        pollingRef.current = false;
        setError('Failed to check video status after multiple attempts');
      } else {
        // Retry in 15 seconds
        console.log('Polling error, retrying in 15 seconds...');
        setTimeout(() => {
          if (pollingRef.current && currentRecapRef.current) {
            pollVideoStatus(videoId, weekStart, weekEnd);
          }
        }, 15000);
      }
    }
  };

  const updateVideoUrl = async (userId: string, videoUrl: string, weekStart: string, weekEnd: string) => {
    try {
      console.log('Updating video URL in database:', videoUrl);
      
      // Get authenticated headers
      const headers = await getAuthenticatedHeaders();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-video-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          video_url: videoUrl,
          week_start: weekStart,
          week_end: weekEnd
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to update video URL:', errorData);
        throw new Error(`Failed to update video URL: ${errorData.error || response.statusText}`);
      }

      console.log('Video URL updated successfully in database');
    } catch (error) {
      console.error('Error updating video URL:', error);
      // Don't throw here as the video is still playable even if DB update fails
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  if (loading && displayState === 'initial') {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Show generation screen
  if (displayState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6">
          <Video className="w-10 h-10 text-white animate-pulse" />
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-3">
          Creating Your Personal Video Recap
        </h3>
        
        <p className="text-gray-600 mb-6 text-center max-w-md">
          Our AI is analyzing your reflections and creating a personalized motivational video just for you, {firstName}!
        </p>
        
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Loader className="w-5 h-5 animate-spin text-purple-600" />
            <span className="text-sm text-gray-700">Generating personalized script with OpenAI...</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-700">Initiating AI video creation with Tavus...</span>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg max-w-md text-center">
          <p className="text-sm text-blue-700">
            This may take 1-2 minutes to set up, then we'll monitor the progress!
          </p>
        </div>
      </div>
    );
  }

  // Show error screen
  if (displayState === 'failed') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to Generate Video Recap
        </h3>
        <p className="text-red-600 mb-4 max-w-md mx-auto">{error}</p>
        
        <button
          onClick={generateWeeklyVideoRecap}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  // Show polling screen - Updated with clearer messaging
  if (displayState === 'polling' && currentRecap) {
    const weekStart = new Date(currentRecap.week_start);
    const weekEnd = new Date(currentRecap.week_end);
    
    // Calculate polling progress (not video generation progress)
    const pollingProgress = Math.min((pollAttempts / maxPollAttempts) * 100, 95);
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            🟢 Video Recap Generation in Progress
          </h3>
          <p className="text-gray-600">
            Week of {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">
              {currentRecap.reflection_count}
            </div>
            <div className="text-sm text-blue-700">Reflections</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="text-2xl font-bold text-green-600">
              {currentRecap.mood_average}
            </div>
            <div className="text-sm text-green-700">Avg Mood</div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Loader className="w-6 h-6 animate-spin text-green-600" />
            <h4 className="font-semibold text-gray-900">Monitoring Video Creation</h4>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="text-sm text-gray-600">
              <strong>Status:</strong> <span className="font-medium capitalize">{videoStatus?.status || 'Initializing'}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <strong>Estimated Time:</strong> 1–3 minutes
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                  Video generation usually takes 1–3 minutes, depending on server load
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500">
              <strong>Polling Progress:</strong> {Math.round(pollingProgress)}% (Check {pollAttempts + 1}/{maxPollAttempts})
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pollingProgress}%` }}
            />
          </div>
          
          {/* Important clarification */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">About the progress indicator:</p>
                <p>
                  The percentage above shows our polling progress, not Tavus's internal video generation progress. 
                  Video creation typically takes 1-3 minutes regardless of the polling percentage shown.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tavus Link Available Immediately */}
        {currentRecap.hosted_url && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-bold text-indigo-900 mb-2">Video Workspace Ready</h4>
              <p className="text-indigo-700 mb-4">
                While the video is still processing, you can monitor live progress on Tavus
              </p>
              <button
                onClick={() => window.open(currentRecap.hosted_url, '_blank')}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 font-semibold text-lg"
              >
                <ExternalLink className="w-5 h-5" />
                View Live Progress on Tavus
              </button>
              <p className="text-sm text-indigo-600 mt-3">
                This link will open your video in Tavus. The video will appear automatically when processing is complete.
              </p>
            </div>
          </div>
        )}

        {/* Script Preview */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Your Personalized Script
          </h4>
          <p className="text-gray-700 leading-relaxed italic">
            "{currentRecap.video_script}"
          </p>
        </div>

        {/* Cancel Option */}
        <div className="text-center">
          <button
            onClick={() => {
              setDisplayState('initial');
              pollingRef.current = false;
              setCurrentRecap(null);
              currentRecapRef.current = null;
              setVideoStatus(null);
              setPollAttempts(0);
              pollAttemptsRef.current = 0;
            }}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            Cancel and go back
          </button>
        </div>
      </div>
    );
  }

  // Show completed video
  if (displayState === 'completed' && currentRecap) {
    const weekStart = new Date(currentRecap.week_start);
    const weekEnd = new Date(currentRecap.week_end);
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <h3 className="text-2xl font-bold text-gray-900">
              🎉 Your Video is Ready!
            </h3>
          </div>
          <p className="text-gray-600">
            Week of {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">
              {currentRecap.reflection_count}
            </div>
            <div className="text-sm text-blue-700">Reflections</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="text-2xl font-bold text-green-600">
              {currentRecap.mood_average}
            </div>
            <div className="text-sm text-green-700">Avg Mood</div>
          </div>
        </div>

        {/* Primary Tavus Link - Prominent Display */}
        {currentRecap.hosted_url && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 border-2 border-green-200">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video className="w-10 h-10 text-white" />
              </div>
              <h4 className="text-2xl font-bold text-green-900 mb-3">Watch Your Completed Video</h4>
              <p className="text-lg text-green-700 mb-6">
                Your AI-generated motivational video is ready to view on Tavus
              </p>
              <button
                onClick={() => window.open(currentRecap.hosted_url, '_blank')}
                className="bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 inline-flex items-center gap-3 font-bold text-xl shadow-lg"
              >
                <ExternalLink className="w-6 h-6" />
                Watch Your Completed Video
              </button>
              <p className="text-sm text-green-600 mt-4">
                ✨ Click above to watch your personalized motivational video
              </p>
            </div>
          </div>
        )}

        {/* Script */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Your Personalized Message
          </h4>
          <p className="text-gray-700 leading-relaxed italic">
            "{currentRecap.video_script}"
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={generateWeeklyVideoRecap}
            className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-purple-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate Recap
          </button>
          
          <button
            onClick={() => window.open(currentRecap.hosted_url, '_blank')}
            className="bg-gray-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open Link
          </button>
        </div>
      </div>
    );
  }

  // Check if user has enough reflections
  if (displayState === 'notEnoughReflections') {
    return (
      <div className="text-center py-8">
        <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Almost Ready for Your First Video Recap!
        </h3>
        <p className="text-gray-500 mb-4">
          You need at least 3 reflections this week to generate a personalized video recap. 
          You currently have {reflectionCount} reflection{reflectionCount !== 1 ? 's' : ''}.
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((reflectionCount / 3) * 100, 100)}%` }}
          />
        </div>
        <p className="text-sm text-gray-500">
          {3 - reflectionCount} more reflection{3 - reflectionCount !== 1 ? 's' : ''} to go!
        </p>
      </div>
    );
  }

  // Show main recap interface
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-6xl mb-4">🎥</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Weekly Video Recaps</h2>
        <p className="text-gray-600">Create personalized AI videos and browse your past recaps.</p>
      </div>

      {/* Generate New Recap Button */}
      <div className="text-center">
        <button
          onClick={generateWeeklyVideoRecap}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 inline-flex items-center gap-3"
        >
          <Video className="w-6 h-6" />
          Generate Weekly Video Recap
        </button>
        <p className="text-gray-500 text-sm mt-2">
          Create a personalized AI video with insights from your weekly reflections
        </p>
      </div>

      {/* Filter Controls - Only show if there are recaps */}
      {recaps.length > 0 && (
        <div className="space-y-4">
          {/* Filter Toggle and Reset */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters() && (
                <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
            
            {hasActiveFilters() && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Filters
              </button>
            )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              {/* Search Bar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Scripts
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={rawSearchText}
                    onChange={(e) => setRawSearchText(e.target.value)}
                    placeholder="Search inside your video scripts..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {rawSearchText && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {rawSearchText !== filters.searchText && (
                  <div className="mt-1 text-xs text-gray-500">
                    Searching... (pause typing to search)
                  </div>
                )}
              </div>

              {/* Date Range and Sort Order */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort Order
                  </label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      {recaps.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {filteredRecaps.length === 0 
              ? 'No recaps found'
              : `${filteredRecaps.length} recap${filteredRecaps.length !== 1 ? 's' : ''} found`
            }
            {hasActiveFilters() && ' (filtered)'}
          </span>
          <span>
            Total: {recaps.length} recap{recaps.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Recaps List or Empty State */}
      {recaps.length === 0 ? (
        <div className="text-center py-12">
          <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No video recaps yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first one to relive your journey!
          </p>
          <button
            onClick={generateWeeklyVideoRecap}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Video className="w-4 h-4" />
            Generate Your First Recap
          </button>
        </div>
      ) : filteredRecaps.length === 0 ? (
        <div className="text-center py-12">
          <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          {hasActiveFilters() ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No recaps match your criteria
              </h3>
              <p className="text-gray-500 mb-4">
                Try adjusting your search criteria or removing some filters to see more results.
              </p>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All Filters
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No video recaps yet
              </h3>
              <p className="text-gray-500">
                Create your first one to relive your journey!
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header with count */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">
              Video Recaps ({filteredRecaps.length})
            </h4>
          </div>

          {/* Recaps with video links */}
          {filteredRecaps.map((recap) => (
            <div key={recap.id} className="border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <div>
                    <h5 className="font-semibold text-gray-900">
                      Week of {format(new Date(recap.week_start), 'MMM dd')} - {format(new Date(recap.week_end), 'MMM dd')}
                    </h5>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(recap.created_at), 'PPp')}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDeleteRecap(recap.id)}
                  disabled={deleting === recap.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete recap"
                >
                  {deleting === recap.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Video Link Button */}
              {recap.video_url && (
                <div className="mb-4">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h6 className="font-semibold text-indigo-900">Watch Your Video</h6>
                          <p className="text-sm text-indigo-600">Click to view your personalized recap</p>
                        </div>
                      </div>
                      <button
                        onClick={() => window.open(recap.video_url, '_blank')}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Watch Video
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Script */}
              {recap.summary && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h6 className="font-medium text-gray-900 mb-2">Video Script</h6>
                  <p className="text-gray-700 text-sm leading-relaxed italic">
                    "{recap.summary}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary Statistics (when recaps exist) */}
      {recaps.length > 0 && (
        <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {recaps.length}
            </p>
            <p className="text-sm text-gray-500">Total Recaps</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {recaps.filter(r => r.video_url).length}
            </p>
            <p className="text-sm text-gray-500">With Videos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {filteredRecaps.length}
            </p>
            <p className="text-sm text-gray-500">Shown</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">
              {recaps.filter(r => r.created_at && new Date(r.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
            </p>
            <p className="text-sm text-gray-500">Last 30 Days</p>
          </div>
        </div>
      )}
    </div>
  );
}