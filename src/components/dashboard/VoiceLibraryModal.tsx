import React, { useState, useEffect } from 'react';
import { Volume2, Play, Pause, Trash2, Calendar, Search, Filter, RotateCcw, X, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, Reflection } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

interface VoiceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FilterState {
  searchText: string;
  startDate: string;
  endDate: string;
  moodFilter: 'all' | 'very-low' | 'neutral' | 'positive';
  sentimentFilter: 'all' | 'positive' | 'neutral' | 'negative';
  durationFilter: 'all' | 'short' | 'medium' | 'long';
  sortOrder: 'newest' | 'oldest' | 'longest' | 'shortest';
}

interface VoiceReflectionWithDuration extends Reflection {
  estimatedDuration: number; // in seconds
}

const initialFilters: FilterState = {
  searchText: '',
  startDate: '',
  endDate: '',
  moodFilter: 'all',
  sentimentFilter: 'all',
  durationFilter: 'all',
  sortOrder: 'newest',
};

export function VoiceLibraryModal({ isOpen, onClose }: VoiceLibraryModalProps) {
  const { user } = useAuth();
  const [reflections, setReflections] = useState<VoiceReflectionWithDuration[]>([]);
  const [filteredReflections, setFilteredReflections] = useState<VoiceReflectionWithDuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  
  // Separate state for immediate search input (debounced)
  const [rawSearchText, setRawSearchText] = useState('');

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

  useEffect(() => {
    if (isOpen && user) {
      fetchVoiceReflections();
    }
  }, [isOpen, user]);

  // Apply filters whenever filters change or reflections change
  useEffect(() => {
    applyFilters();
  }, [reflections, filters]);

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingId(null);
      }
    };
  }, [currentAudio]);

  const fetchVoiceReflections = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', user.id)
        .not('voice_url', 'is', null)
        .order('created_at', { ascending: false });

      // Add estimated duration based on content length
      const reflectionsWithDuration: VoiceReflectionWithDuration[] = (data || []).map(reflection => ({
        ...reflection,
        estimatedDuration: estimateAudioDuration(reflection.content)
      }));

      setReflections(reflectionsWithDuration);
    } catch (error) {
      console.error('Error fetching voice reflections:', error);
    } finally {
      setLoading(false);
    }
  };

  // Estimate audio duration based on content length (words per minute)
  const estimateAudioDuration = (content: string): number => {
    const words = content.trim().split(/\s+/).length;
    const wordsPerMinute = 150; // Average speaking rate
    const minutes = words / wordsPerMinute;
    return Math.max(10, Math.round(minutes * 60)); // Minimum 10 seconds
  };

  const applyFilters = () => {
    let filtered = [...reflections];

    // Apply search filter
    if (filters.searchText.trim()) {
      const searchTerm = filters.searchText.toLowerCase().trim();
      filtered = filtered.filter(reflection =>
        reflection.content.toLowerCase().includes(searchTerm)
      );
    }

    // Apply date range filters
    if (filters.startDate) {
      filtered = filtered.filter(reflection =>
        new Date(reflection.created_at) >= new Date(`${filters.startDate}T00:00:00`)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(reflection =>
        new Date(reflection.created_at) <= new Date(`${filters.endDate}T23:59:59`)
      );
    }

    // Apply mood filter
    if (filters.moodFilter !== 'all' && filtered.length > 0) {
      filtered = filtered.filter(reflection => {
        if (!reflection.mood_score) return false;
        
        switch (filters.moodFilter) {
          case 'very-low':
            return reflection.mood_score >= 1 && reflection.mood_score <= 3;
          case 'neutral':
            return reflection.mood_score >= 4 && reflection.mood_score <= 6;
          case 'positive':
            return reflection.mood_score >= 7 && reflection.mood_score <= 10;
          default:
            return true;
        }
      });
    }

    // Apply sentiment filter
    if (filters.sentimentFilter !== 'all') {
      filtered = filtered.filter(reflection =>
        reflection.sentiment === filters.sentimentFilter
      );
    }

    // Apply duration filter
    if (filters.durationFilter !== 'all') {
      filtered = filtered.filter(reflection => {
        const duration = reflection.estimatedDuration;
        switch (filters.durationFilter) {
          case 'short':
            return duration < 30;
          case 'medium':
            return duration >= 30 && duration <= 120;
          case 'long':
            return duration > 120;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortOrder) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'longest':
          return b.estimatedDuration - a.estimatedDuration;
        case 'shortest':
          return a.estimatedDuration - b.estimatedDuration;
        default:
          return 0;
      }
    });

    setFilteredReflections(filtered);
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
           filters.moodFilter !== 'all' ||
           filters.sentimentFilter !== 'all' ||
           filters.durationFilter !== 'all' ||
           filters.sortOrder !== 'newest';
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const getDurationColor = (duration: number): string => {
    if (duration < 30) return 'text-green-600 bg-green-50';
    if (duration <= 120) return 'text-yellow-600 bg-yellow-50';
    return 'text-purple-600 bg-purple-50';
  };

  const playAudio = (reflection: VoiceReflectionWithDuration) => {
    if (!reflection.voice_url) return;

    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    if (playingId === reflection.id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(reflection.voice_url);
    audio.addEventListener('ended', () => {
      setPlayingId(null);
      setCurrentAudio(null);
    });

    audio.addEventListener('error', () => {
      console.error('Error playing audio');
      setPlayingId(null);
      setCurrentAudio(null);
    });

    audio.play().then(() => {
      setCurrentAudio(audio);
      setPlayingId(reflection.id);
    }).catch(console.error);
  };

  const deleteReflection = async (reflection: VoiceReflectionWithDuration) => {
    if (!confirm('Are you sure you want to delete this reflection?')) return;

    try {
      await supabase
        .from('reflections')
        .delete()
        .eq('id', reflection.id);

      setReflections(prev => prev.filter(r => r.id !== reflection.id));

      if (playingId === reflection.id && currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingId(null);
      }
    } catch (error) {
      console.error('Error deleting reflection:', error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl">
            <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (reflections.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Volume2 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
          No voice recordings yet
        </h3>
        <p className="text-sm sm:text-base text-gray-500">
          Your voice recordings will appear here after you save reflections with AI voice generation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      {/* Filter Controls */}
      <div className="space-y-3 sm:space-y-4 px-2">
        {/* Filter Toggle and Reset */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm sm:text-base"
          >
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters() && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </button>
          
          {hasActiveFilters() && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4 max-w-full">
            {/* Search Bar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Transcript Content
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={rawSearchText}
                  onChange={(e) => setRawSearchText(e.target.value)}
                  placeholder="Search inside your voice reflections..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Mood, Sentiment, and Duration Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mood Level
                </label>
                <select
                  value={filters.moodFilter}
                  onChange={(e) => handleFilterChange('moodFilter', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All Moods</option>
                  <option value="very-low">Very Low (1-3)</option>
                  <option value="neutral">Neutral (4-6)</option>
                  <option value="positive">Positive (7-10)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sentiment
                </label>
                <select
                  value={filters.sentimentFilter}
                  onChange={(e) => handleFilterChange('sentimentFilter', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All Sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration
                </label>
                <select
                  value={filters.durationFilter}
                  onChange={(e) => handleFilterChange('durationFilter', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All Durations</option>
                  <option value="short">Short (&lt;30 sec)</option>
                  <option value="medium">Medium (30-120 sec)</option>
                  <option value="long">Long (&gt;2 min)</option>
                </select>
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="longest">Longest Duration</option>
                <option value="shortest">Shortest Duration</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 px-2">
        <span className="min-w-0 break-words">
          {filteredReflections.length === 0 
            ? 'No recordings found'
            : `${filteredReflections.length} recording${filteredReflections.length !== 1 ? 's' : ''} found`
          }
          {hasActiveFilters() && ' (filtered)'}
        </span>
        <span className="whitespace-nowrap ml-2">
          Total: {reflections.length}
        </span>
      </div>

      {/* Recordings List or Empty State */}
      {filteredReflections.length === 0 ? (
        <div className="text-center py-12 px-4">
          <Volume2 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
          {hasActiveFilters() ? (
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                No recordings match your criteria
              </h3>
              <p className="text-sm sm:text-base text-gray-500 mb-4">
                Try adjusting your search criteria or removing some filters to see more results.
              </p>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All Filters
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                No voice recordings yet
              </h3>
              <p className="text-sm sm:text-base text-gray-500">
                Your voice recordings will appear here after you save reflections with AI voice generation.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4 px-2">
          {filteredReflections.map((reflection) => (
            <div
              key={reflection.id}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors max-w-full overflow-hidden"
            >
              {/* Play Button */}
              <button
                onClick={() => playAudio(reflection)}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  playingId === reflection.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {playingId === reflection.id ? (
                  <Pause className="w-4 h-4 sm:w-6 sm:h-6" />
                ) : (
                  <Play className="w-4 h-4 sm:w-6 sm:h-6" />
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0 w-full">
                {/* Date, Time and Badges */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <div className="flex items-center gap-1 sm:gap-2 text-gray-400">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      {format(new Date(reflection.created_at), 'PPP')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(reflection.created_at), 'p')}
                  </span>
                  
                  {/* Duration Badge */}
                  <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getDurationColor(reflection.estimatedDuration)} flex-shrink-0`}>
                    <Clock className="w-3 h-3" />
                    {formatDuration(reflection.estimatedDuration)}
                  </span>
                  
                  {/* Mood and Sentiment */}
                  {reflection.mood_score && (
                    <span className="text-xs sm:text-sm whitespace-nowrap">
                      {['😢', '😕', '😐', '🙂', '😊', '😄', '😍', '🤩', '🥳', '🌟'][reflection.mood_score - 1]} {reflection.mood_score}/10
                    </span>
                  )}
                  
                  {reflection.sentiment && (
                    <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                      reflection.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                      reflection.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {reflection.sentiment}
                    </span>
                  )}
                </div>
                
                {/* Reflection Content */}
                <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 break-words leading-relaxed">
                  {reflection.content}
                </p>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => deleteReflection(reflection)}
                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 self-start sm:self-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Summary Statistics (when recordings exist) */}
      {reflections.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-100 px-2">
          <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-xl">
            <p className="text-lg sm:text-2xl font-bold text-blue-600">
              {reflections.length}
            </p>
            <p className="text-xs sm:text-sm text-blue-700 font-medium">Total Recordings</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-green-50 rounded-xl">
            <p className="text-lg sm:text-2xl font-bold text-green-600">
              {formatDuration(reflections.reduce((sum, r) => sum + r.estimatedDuration, 0))}
            </p>
            <p className="text-xs sm:text-sm text-green-700 font-medium">Total Duration</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-xl">
            <p className="text-lg sm:text-2xl font-bold text-purple-600">
              {filteredReflections.length}
            </p>
            <p className="text-xs sm:text-sm text-purple-700 font-medium">Shown</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-yellow-50 rounded-xl">
            <p className="text-lg sm:text-2xl font-bold text-yellow-600">
              {formatDuration(Math.round(reflections.reduce((sum, r) => sum + r.estimatedDuration, 0) / reflections.length))}
            </p>
            <p className="text-xs sm:text-sm text-yellow-700 font-medium">Avg Duration</p>
          </div>
        </div>
      )}
    </div>
  );
}