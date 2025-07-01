import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Search, Filter, RotateCcw, X } from 'lucide-react';
import { supabase, Reflection } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

interface ReflectionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FilterState {
  searchText: string;
  startDate: string;
  endDate: string;
  moodFilter: 'all' | 'very-low' | 'neutral' | 'positive';
  sentimentFilter: 'all' | 'positive' | 'neutral' | 'negative';
  sortOrder: 'newest' | 'oldest' | 'highest-mood' | 'lowest-mood';
}

const initialFilters: FilterState = {
  searchText: '',
  startDate: '',
  endDate: '',
  moodFilter: 'all',
  sentimentFilter: 'all',
  sortOrder: 'newest',
};

export function ReflectionHistoryModal({ isOpen, onClose }: ReflectionHistoryModalProps) {
  const { user } = useAuth();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  
  // Separate state for immediate search input (not debounced)
  const [rawSearchText, setRawSearchText] = useState('');
  
  const itemsPerPage = 10;

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
      fetchReflections();
    }
  }, [isOpen, user, currentPage, filters]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filters.searchText, filters.startDate, filters.endDate, filters.moodFilter, filters.sentimentFilter, filters.sortOrder]);

  const fetchReflections = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('reflections')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      // Apply search filter
      if (filters.searchText.trim()) {
        query = query.ilike('content', `%${filters.searchText.trim()}%`);
      }

      // Apply date range filters
      if (filters.startDate) {
        query = query.gte('created_at', `${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        query = query.lte('created_at', `${filters.endDate}T23:59:59`);
      }

      // Apply mood filter
      if (filters.moodFilter !== 'all') {
        switch (filters.moodFilter) {
          case 'very-low':
            query = query.gte('mood_score', 1).lte('mood_score', 3);
            break;
          case 'neutral':
            query = query.gte('mood_score', 4).lte('mood_score', 6);
            break;
          case 'positive':
            query = query.gte('mood_score', 7).lte('mood_score', 10);
            break;
        }
      }

      // Apply sentiment filter
      if (filters.sentimentFilter !== 'all') {
        query = query.eq('sentiment', filters.sentimentFilter);
      }

      // Apply sorting
      switch (filters.sortOrder) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'highest-mood':
          query = query.order('mood_score', { ascending: false }).order('created_at', { ascending: false });
          break;
        case 'lowest-mood':
          query = query.order('mood_score', { ascending: true }).order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      const { data, count, error } = await query
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;

      setReflections(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching reflections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setRawSearchText(''); // Also reset the raw search text
    setCurrentPage(1);
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
           filters.sortOrder !== 'newest';
  };

  const getMoodEmoji = (score: number) => {
    const emojis = ['😢', '😕', '😐', '🙂', '😊', '😄', '😍', '🤩', '🥳', '🌟'];
    return emojis[score - 1] || '😐';
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'negative':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (loading && currentPage === 1) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-4 bg-gray-200 rounded"></div>
              <div className="w-20 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="space-y-4">
        {/* Filter Toggle and Reset */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters() && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
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
            {/* Search Bar - Now uses rawSearchText for immediate updates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Content
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={rawSearchText}
                  onChange={(e) => setRawSearchText(e.target.value)}
                  placeholder="Search your reflections..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              {/* Show search indicator when there's a delay */}
              {rawSearchText !== filters.searchText && (
                <div className="mt-1 text-xs text-gray-500">
                  Searching... (type complete to search)
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Mood and Sentiment Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mood Level
                </label>
                <select
                  value={filters.moodFilter}
                  onChange={(e) => handleFilterChange('moodFilter', e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
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
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest-mood">Highest Mood First</option>
                <option value="lowest-mood">Lowest Mood First</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {totalCount === 0 
            ? 'No reflections found'
            : `${totalCount} reflection${totalCount !== 1 ? 's' : ''} found`
          }
          {hasActiveFilters() && ' (filtered)'}
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Reflections List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reflections...</p>
        </div>
      ) : reflections.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          {hasActiveFilters() ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No reflections match your filters
              </h3>
              <p className="text-gray-500 mb-4">
                Try adjusting your search criteria or removing some filters to see more results.
              </p>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All Filters
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No reflections yet
              </h3>
              <p className="text-gray-500">
                Start your transformation journey by recording your first daily reflection.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reflections.map((reflection) => (
            <div
              key={reflection.id}
              className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {format(new Date(reflection.created_at), 'PPP')}
                </span>
                <span className="text-xs text-gray-500">
                  {format(new Date(reflection.created_at), 'p')}
                </span>
                
                {reflection.mood_score && (
                  <div className="flex items-center gap-2">
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
              
              <p className="text-gray-700 leading-relaxed">
                {reflection.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} reflections
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="px-3 py-1 text-sm font-medium text-gray-700">
              {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}