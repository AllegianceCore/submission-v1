import React, { useRef, useState, useEffect } from 'react';
import { Clock, Trash2, Volume2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, Reflection } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

interface TodaysReflectionsListProps {
  reflections: Reflection[];
  loading: boolean;
  onReflectionDeleted: () => void;
}

export function TodaysReflectionsList({ 
  reflections, 
  loading, 
  onReflectionDeleted 
}: TodaysReflectionsListProps) {
  const { user } = useAuth();
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const reflectionsContainerRef = useRef<HTMLDivElement>(null);
  
  // State for controlling display - removed showAll, only using displayLimit
  const [displayLimit, setDisplayLimit] = useState(3);

  const handleDeleteReflection = async (reflectionId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this reflection?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('reflections')
        .delete()
        .eq('id', reflectionId)
        .eq('user_id', user.id); // Extra security check

      if (error) throw error;
      
      onReflectionDeleted();
    } catch (error) {
      console.error('Error deleting reflection:', error);
      alert('Failed to delete reflection. Please try again.');
    }
  };

  const playVoice = (reflection: Reflection) => {
    if (!reflection.voice_url) return;

    const audio = audioRefs.current[reflection.id] || new Audio(reflection.voice_url);
    audioRefs.current[reflection.id] = audio;
    
    audio.play().catch(console.error);
  };

  const getMoodEmoji = (score: number | null) => {
    if (!score) return '😐';
    const emojis = ['😢', '😕', '😐', '🙂', '😊', '😄', '😍', '🤩', '🥳', '🌟'];
    return emojis[score - 1] || '😐';
  };

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'negative':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleShowMore = () => {
    const newLimit = Math.min(displayLimit + 5, reflections.length);
    setDisplayLimit(newLimit);
    // Removed automatic scrolling - user can scroll manually
  };

  const handleHide = () => {
    setDisplayLimit(3);
    // Scroll back to top when hiding
    setTimeout(() => {
      if (reflectionsContainerRef.current) {
        reflectionsContainerRef.current.scrollTop = 0;
      }
    }, 100);
  };

  // Determine which reflections to display
  const displayedReflections = reflections.slice(0, displayLimit);

  // Button visibility logic
  const hasMoreToShow = reflections.length > displayLimit;
  const canHide = displayLimit > 3 && reflections.length > 3;

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Today's Reflections</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
                <div className="w-8 h-4 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (reflections.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-2">No reflections yet today</h3>
        <p className="text-gray-500 text-sm">
          Start your day by adding your first reflection above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count and display info */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Today's Reflections ({reflections.length})
        </h3>
        
        {reflections.length > 3 && (
          <div className="text-sm text-gray-500">
            Showing {displayedReflections.length} of {reflections.length}
          </div>
        )}
      </div>
      
      {/* Reflections List - Now scrollable when expanded */}
      <div 
        ref={reflectionsContainerRef}
        className={`space-y-3 transition-all duration-300 ${
          displayLimit > 3 ? 'max-h-96 overflow-y-auto' : ''
        }`}
        style={{
          scrollBehavior: 'smooth'
        }}
      >
        {displayedReflections.map((reflection) => (
          <div
            key={reflection.id}
            className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {/* Header with time, mood, and actions */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {format(new Date(reflection.created_at), 'HH:mm')}
                  </span>
                </div>
                
                {reflection.mood_score && (
                  <div className="flex items-center gap-1">
                    <span className="text-lg">
                      {getMoodEmoji(reflection.mood_score)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {reflection.mood_score}/10
                    </span>
                  </div>
                )}
                
                {reflection.sentiment && (
                  <span className={`px-2 py-1 text-xs rounded-full border ${getSentimentColor(reflection.sentiment)}`}>
                    {reflection.sentiment}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {reflection.voice_url && (
                  <button
                    onClick={() => playVoice(reflection)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Play voice recording"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={() => handleDeleteReflection(reflection.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete reflection"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <p className="text-gray-700 leading-relaxed text-sm">
              {reflection.content}
            </p>
          </div>
        ))}
      </div>

      {/* Show More / Hide Buttons - Simplified logic */}
      {(hasMoreToShow || canHide) && (
        <div className="flex justify-center pt-4 border-t border-gray-100">
          {hasMoreToShow ? (
            <button
              onClick={handleShowMore}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Show More ({Math.min(5, reflections.length - displayLimit)} more)
            </button>
          ) : canHide ? (
            <button
              onClick={handleHide}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
              Show Less (Back to 3 most recent)
            </button>
          ) : null}
        </div>
      )}

      {/* When showing more than 3, display a scrollable indicator */}
      {displayLimit > 3 && displayLimit < reflections.length && (
        <div className="text-center pt-2">
          <p className="text-sm text-gray-500">
            Scroll within the list above to see all {displayedReflections.length} reflections
          </p>
        </div>
      )}
      
      {/* When showing all, display a note */}
      {displayLimit >= reflections.length && reflections.length > 3 && (
        <div className="text-center pt-2">
          <p className="text-sm text-gray-500">
            Showing all {reflections.length} reflections from today
          </p>
        </div>
      )}
    </div>
  );
}