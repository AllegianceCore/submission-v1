import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronUp, Search, Filter, RotateCcw, X, Trash2, BookOpen, Brain, Heart, Target, Loader, AlertCircle } from 'lucide-react';
import { supabase, InsightReport } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

interface GrowthReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FilterState {
  searchText: string;
  startDate: string;
  endDate: string;
  reportType: 'all' | 'daily' | 'weekly' | 'monthly';
  sortOrder: 'newest' | 'oldest';
}

const initialFilters: FilterState = {
  searchText: '',
  startDate: '',
  endDate: '',
  reportType: 'all',
  sortOrder: 'newest',
};

export function GrowthReportsModal({ isOpen, onClose }: GrowthReportsModalProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<InsightReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<InsightReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
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
      fetchReports();
    }
  }, [isOpen, user]);

  // Apply filters whenever filters change or reports change
  useEffect(() => {
    applyFilters();
  }, [reports, filters]);

  const fetchReports = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('insight_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching insight reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];

    // Apply search filter - search in summary, motivation, and recommendations
    if (filters.searchText.trim()) {
      const searchTerm = filters.searchText.toLowerCase().trim();
      filtered = filtered.filter(report => {
        const summaryText = report.summary.toLowerCase();
        const motivationText = report.motivation.toLowerCase();
        const recommendationsText = report.recommendations.join(' ').toLowerCase();
        return summaryText.includes(searchTerm) || 
               motivationText.includes(searchTerm) || 
               recommendationsText.includes(searchTerm);
      });
    }

    // Apply date range filters
    if (filters.startDate) {
      filtered = filtered.filter(report =>
        new Date(report.created_at) >= new Date(`${filters.startDate}T00:00:00`)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(report =>
        new Date(report.created_at) <= new Date(`${filters.endDate}T23:59:59`)
      );
    }

    // Apply report type filter
    if (filters.reportType !== 'all') {
      filtered = filtered.filter(report => report.report_type === filters.reportType);
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

    setFilteredReports(filtered);
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
           filters.reportType !== 'all' ||
           filters.sortOrder !== 'newest';
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this insight report? This action cannot be undone.')) {
      return;
    }

    setDeleting(reportId);
    try {
      const { error } = await supabase
        .from('insight_reports')
        .delete()
        .eq('id', reportId)
        .eq('user_id', user.id); // Extra security check

      if (error) throw error;
      
      // Remove from local state
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'daily':
        return Calendar;
      case 'weekly':
        return Target;
      case 'monthly':
        return Brain;
      default:
        return Heart;
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'daily':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'weekly':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'monthly':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getReportTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading your growth reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-6xl mb-4">📈</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Growth Reports</h2>
        <p className="text-gray-600">Review your saved insights over time</p>
      </div>

      {/* Filter Controls - Only show if there are reports */}
      {reports.length > 0 && (
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
                  Search Reports
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={rawSearchText}
                    onChange={(e) => setRawSearchText(e.target.value)}
                    placeholder="Search summaries, motivation, and recommendations..."
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

              {/* Date Range and Report Type */}
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
                    Report Type
                  </label>
                  <select
                    value={filters.reportType}
                    onChange={(e) => handleFilterChange('reportType', e.target.value)}
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">All</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
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
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      {reports.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {filteredReports.length === 0 
              ? 'No reports found'
              : `${filteredReports.length} report${filteredReports.length !== 1 ? 's' : ''} found`
            }
            {hasActiveFilters() && ' (filtered)'}
          </span>
          <span>
            Total: {reports.length} report{reports.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Reports List or Empty State */}
      {reports.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No growth reports yet
          </h3>
          <p className="text-gray-500">
            Your AI insight reports will appear here after you generate them from the AI Insights section.
          </p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          {hasActiveFilters() ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No reports match your criteria
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
                No growth reports yet
              </h3>
              <p className="text-gray-500">
                Your AI insight reports will appear here after you generate them.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredReports.map((report) => {
            const Icon = getReportTypeIcon(report.report_type);
            
            return (
              <div
                key={report.id}
                className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {format(new Date(report.created_at), 'PPPP')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {format(new Date(report.created_at), 'p')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-sm rounded-full border flex items-center gap-2 ${getReportTypeColor(report.report_type)}`}>
                      <Icon className="w-4 h-4" />
                      {getReportTypeLabel(report.report_type)}
                    </span>
                    
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      disabled={deleting === report.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete report"
                    >
                      {deleting === report.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Summary Section */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    Summary
                  </h4>
                  <p className="text-gray-700 leading-relaxed">{report.summary}</p>
                </div>

                {/* Motivation Section */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-green-600" />
                    Motivation
                  </h4>
                  <p className="text-gray-700 leading-relaxed">{report.motivation}</p>
                </div>

                {/* Recommendations Section */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {report.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-medium text-purple-600">{index + 1}</span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{recommendation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Statistics (when reports exist) */}
      {reports.length > 0 && (
        <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {reports.length}
            </p>
            <p className="text-sm text-gray-500">Total Reports</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {reports.filter(r => r.report_type === 'daily').length}
            </p>
            <p className="text-sm text-gray-500">Daily</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {reports.filter(r => r.report_type === 'weekly').length}
            </p>
            <p className="text-sm text-gray-500">Weekly</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">
              {reports.filter(r => r.report_type === 'monthly').length}
            </p>
            <p className="text-sm text-gray-500">Monthly</p>
          </div>
        </div>
      )}
    </div>
  );
}