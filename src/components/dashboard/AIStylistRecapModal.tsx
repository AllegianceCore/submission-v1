import React, { useState, useEffect } from 'react';
import { Calendar, Star, CheckCircle, Loader, AlertCircle, Plus, Search, Filter, RotateCcw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, StyleFeedback } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { AIStylistModal } from './AIStylistModal';

interface AIStylistRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FilterState {
  searchText: string;
  startDate: string;
  endDate: string;
  styleRatingFilter: 'all' | 'needs-improvement' | 'decent' | 'good' | 'excellent';
  sortOrder: 'newest' | 'oldest' | 'highest-rating' | 'lowest-rating';
}

const initialFilters: FilterState = {
  searchText: '',
  startDate: '',
  endDate: '',
  styleRatingFilter: 'all',
  sortOrder: 'newest',
};

export function AIStylistRecapModal({ isOpen, onClose }: AIStylistRecapModalProps) {
  const { user } = useAuth();
  const [feedbackHistory, setFeedbackHistory] = useState<StyleFeedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<StyleFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  
  // Separate state for immediate search input (debounced)
  const [rawSearchText, setRawSearchText] = useState('');
  
  const aiStylistModal = useModal();

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
      fetchStyleFeedback();
    }
  }, [isOpen, user]);

  // Apply filters whenever filters change or feedback changes
  useEffect(() => {
    applyFilters();
  }, [feedbackHistory, filters]);

  const fetchStyleFeedback = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('style_feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setFeedbackHistory(data || []);
    } catch (err) {
      console.error('Error fetching style feedback:', err);
      setError('Failed to load style history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...feedbackHistory];

    // Apply search filter - search in positive comments and suggestions
    if (filters.searchText.trim()) {
      const searchTerm = filters.searchText.toLowerCase().trim();
      filtered = filtered.filter(feedback => {
        const commentsText = feedback.positive_comments.join(' ').toLowerCase();
        const suggestionsText = feedback.suggestions.join(' ').toLowerCase();
        return commentsText.includes(searchTerm) || suggestionsText.includes(searchTerm);
      });
    }

    // Apply date range filters
    if (filters.startDate) {
      filtered = filtered.filter(feedback =>
        new Date(feedback.created_at) >= new Date(`${filters.startDate}T00:00:00`)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(feedback =>
        new Date(feedback.created_at) <= new Date(`${filters.endDate}T23:59:59`)
      );
    }

    // Apply style rating filter
    if (filters.styleRatingFilter !== 'all') {
      filtered = filtered.filter(feedback => {
        const rating = feedback.style_rating;
        switch (filters.styleRatingFilter) {
          case 'needs-improvement':
            return rating >= 1 && rating <= 3;
          case 'decent':
            return rating >= 4 && rating <= 6;
          case 'good':
            return rating >= 7 && rating <= 8;
          case 'excellent':
            return rating >= 9 && rating <= 10;
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
        case 'highest-rating':
          return b.style_rating - a.style_rating;
        case 'lowest-rating':
          return a.style_rating - b.style_rating;
        default:
          return 0;
      }
    });

    setFilteredFeedback(filtered);
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
           filters.styleRatingFilter !== 'all' ||
           filters.sortOrder !== 'newest';
  };

  const handleNewAnalysisComplete = () => {
    // Refresh the feedback history when a new analysis is completed
    fetchStyleFeedback();
    aiStylistModal.close();
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'text-green-600';
    if (rating >= 7) return 'text-blue-600';
    if (rating >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingBgColor = (rating: number) => {
    if (rating >= 9) return 'bg-green-50 border-green-200';
    if (rating >= 7) return 'bg-blue-50 border-blue-200';
    if (rating >= 4) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 9) return 'Excellent';
    if (rating >= 7) return 'Good';
    if (rating >= 4) return 'Decent';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading your style journal...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
        {/* Header */}
        <div className="text-center px-2">
          <div className="text-4xl sm:text-6xl mb-4">👗</div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Style Journal</h2>
          <p className="text-sm sm:text-base text-gray-600">Create a personalized analysis and browse your previous outfit feedback.</p>
        </div>

        {/* Analyze New Outfit Button */}
        <div className="text-center px-2">
          <button
            onClick={aiStylistModal.open}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 inline-flex items-center gap-2 sm:gap-3 text-sm sm:text-base"
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            Analyze New Outfit
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg mx-2">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm sm:text-base text-red-700 break-words">{error}</p>
              <button
                onClick={fetchStyleFeedback}
                className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls - Only show if there are analyses */}
        {feedbackHistory.length > 0 && (
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
                  <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
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
                    Search Comments & Suggestions
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={rawSearchText}
                      onChange={(e) => setRawSearchText(e.target.value)}
                      placeholder="Search inside your style feedback..."
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
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
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
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
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* Style Rating and Sort Order */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Style Rating Filter
                    </label>
                    <select
                      value={filters.styleRatingFilter}
                      onChange={(e) => handleFilterChange('styleRatingFilter', e.target.value)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    >
                      <option value="all">All Ratings</option>
                      <option value="needs-improvement">1–3 (Needs Improvement)</option>
                      <option value="decent">4–6 (Decent)</option>
                      <option value="good">7–8 (Good)</option>
                      <option value="excellent">9–10 (Excellent)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort Order
                    </label>
                    <select
                      value={filters.sortOrder}
                      onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                      className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="highest-rating">Highest Rating</option>
                      <option value="lowest-rating">Lowest Rating</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        {feedbackHistory.length > 0 && (
          <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 px-2">
            <span className="min-w-0 break-words">
              {filteredFeedback.length === 0 
                ? 'No analyses found'
                : `${filteredFeedback.length} analysis${filteredFeedback.length !== 1 ? 'es' : ''} found`
              }
              {hasActiveFilters() && ' (filtered)'}
            </span>
            <span className="whitespace-nowrap ml-2">
              Total: {feedbackHistory.length}
            </span>
          </div>
        )}

        {/* Style History or Empty State */}
        <div className="space-y-3 sm:space-y-4 px-2">
          {feedbackHistory.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                No style analyses yet
              </h3>
              <p className="text-sm sm:text-base text-gray-500 mb-4 px-4">
                Start building your style journal by analyzing your first outfit!
              </p>
              <button
                onClick={aiStylistModal.open}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Analyze Your First Outfit
              </button>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              {hasActiveFilters() ? (
                <div className="px-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                    No style analyses match your criteria
                  </h3>
                  <p className="text-sm sm:text-base text-gray-500 mb-4">
                    Try adjusting your search criteria or removing some filters to see more results.
                  </p>
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <div className="px-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                    No style analyses yet
                  </h3>
                  <p className="text-sm sm:text-base text-gray-500">
                    Start building your style journal by analyzing your first outfit!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Style Analyses ({filteredFeedback.length})
                </h3>
              </div>

              {/* Scrollable container for multiple entries */}
              <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto">
                {filteredFeedback.map((feedback) => {
                  const Icon = Star;
                  return (
                    <div
                      key={feedback.id}
                      className={`p-3 sm:p-6 rounded-xl transition-colors border-2 max-w-full overflow-hidden ${
                        feedback.style_rating >= 8 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {/* Header with Date and Rating - Mobile Optimized */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 text-gray-600 min-w-0">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-medium block truncate">
                              {format(new Date(feedback.created_at), 'PPP')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(feedback.created_at), 'p')}
                            </span>
                          </div>
                        </div>
                        
                        <div className={`px-2 sm:px-3 py-1 rounded-full border flex items-center gap-1 sm:gap-2 flex-shrink-0 w-fit ${getRatingBgColor(feedback.style_rating)}`}>
                          <Star className={`w-3 h-3 sm:w-4 sm:h-4 ${getRatingColor(feedback.style_rating)}`} fill="currentColor" />
                          <span className={`font-semibold text-xs sm:text-sm ${getRatingColor(feedback.style_rating)}`}>
                            {feedback.style_rating}/10
                          </span>
                          <span className={`text-xs ${getRatingColor(feedback.style_rating)} hidden sm:inline`}>
                            {getRatingLabel(feedback.style_rating)}
                          </span>
                        </div>
                      </div>

                      {/* Positive Comments */}
                      <div className="mb-3 sm:mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                          What's Working Great
                        </h4>
                        <div className="space-y-2">
                          {feedback.positive_comments.map((comment, index) => (
                            <div key={index} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-green-50 rounded-lg">
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <p className="text-green-800 text-xs sm:text-sm leading-relaxed break-words min-w-0">{comment}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Suggestions */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Style Suggestions</h4>
                        {feedback.suggestions.length > 0 ? (
                          <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                            <div className="space-y-2 sm:space-y-3">
                              {feedback.suggestions.map((suggestion, index) => (
                                <div key={index} className="flex items-start gap-2 sm:gap-3">
                                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                                  </div>
                                  <p className="text-blue-800 text-xs sm:text-sm leading-relaxed break-words min-w-0">{suggestion}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                            <p className="text-green-800 font-medium text-center text-xs sm:text-sm">
                              🎉 No improvements needed—great job!
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-100">
                <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-xl">
                  <p className="text-lg sm:text-2xl font-bold text-purple-600">
                    {feedbackHistory.length}
                  </p>
                  <p className="text-xs sm:text-sm text-purple-700 font-medium">Total Analyses</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-yellow-50 rounded-xl">
                  <p className="text-lg sm:text-2xl font-bold text-yellow-600">
                    {feedbackHistory.length > 0 ? (feedbackHistory.reduce((sum, f) => sum + f.style_rating, 0) / feedbackHistory.length).toFixed(1) : '0'}
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-700 font-medium">Avg Rating</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-green-50 rounded-xl">
                  <p className="text-lg sm:text-2xl font-bold text-green-600">
                    {feedbackHistory.filter(f => f.style_rating >= 9).length}
                  </p>
                  <p className="text-xs sm:text-sm text-green-700 font-medium">Excellent (9-10)</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-xl">
                  <p className="text-lg sm:text-2xl font-bold text-blue-600">
                    {filteredFeedback.length}
                  </p>
                  <p className="text-xs sm:text-sm text-blue-700 font-medium">Shown</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Stylist Modal for New Analysis */}
      <Modal
        isOpen={aiStylistModal.isOpen}
        onClose={aiStylistModal.close}
        title=""
        size="lg"
      >
        <AIStylistModal
          isOpen={aiStylistModal.isOpen}
          onClose={handleNewAnalysisComplete}
        />
      </Modal>
    </>
  );
}