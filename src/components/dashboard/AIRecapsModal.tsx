import React, { useState } from 'react';
import { Brain, Calendar, TrendingUp, Target, Loader, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface AIRecapsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecapData {
  summaryText: string;
  motivationalMessage: string;
  recommendations: string[];
  moodAverage?: number;
  reflectionCount: number;
  topEmotions?: string[];
}

type TimeFrame = 'daily' | 'weekly' | 'monthly';

export function AIRecapsModal({ isOpen, onClose }: AIRecapsModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TimeFrame>('daily');
  const [recapData, setRecapData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Single function with console.log and no duplicate calls
  const generateInsights = async () => {
    console.log("Generating insights...");
    
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setRecapData(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-recap`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          timeFrame: activeTab,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setRecapData(data);
    } catch (err) {
      console.error('Error generating insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeText = (timeFrame: TimeFrame) => {
    const now = new Date();
    switch (timeFrame) {
      case 'daily':
        return format(now, 'EEEE, MMMM do');
      case 'weekly':
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);
        return `${format(weekStart, 'MMM do')} - ${format(weekEnd, 'MMM do')}`;
      case 'monthly':
        return format(now, 'MMMM yyyy');
      default:
        return '';
    }
  };

  const getSentimentColor = (emotion: string) => {
    switch (emotion.toLowerCase()) {
      case 'positive':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'negative':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'neutral':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getMoodColor = (mood: number) => {
    if (mood >= 8) return 'text-green-600';
    if (mood >= 6) return 'text-yellow-600';
    if (mood >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  // ✅ Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
          <Brain className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Generating AI Insights</h3>
        <p className="text-gray-600 mb-4">Analyzing your reflections with artificial intelligence...</p>
        <div className="flex items-center gap-2">
          <Loader className="w-5 h-5 animate-spin text-purple-600" />
          <span className="text-sm text-gray-500">This may take a moment</span>
        </div>
      </div>
    );
  }

  // ✅ Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to Generate Insights
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={generateInsights}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Frame Selection */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {(['daily', 'weekly', 'monthly'] as TimeFrame[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            {activeTab} Insights
          </h3>
        </div>
        <p className="text-gray-600">{getDateRangeText(activeTab)}</p>
      </div>

      {/* ✅ Clean Generate Button - Single Click Handler */}
      {!recapData && (
        <div className="text-center">
          <button
            onClick={generateInsights}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 inline-flex items-center gap-3"
          >
            <Brain className="w-6 h-6" />
            Generate AI Insights
          </button>
          <p className="text-gray-500 text-sm mt-2">
            Create personalized insights from your {activeTab} reflections
          </p>
        </div>
      )}

      {/* Results Display */}
      {recapData && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">
                {recapData.reflectionCount}
              </div>
              <div className="text-sm text-blue-700">Reflections</div>
            </div>
            
            {recapData.moodAverage && (
              <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl">
                <div className={`text-2xl font-bold ${getMoodColor(recapData.moodAverage)}`}>
                  {recapData.moodAverage}
                </div>
                <div className="text-sm text-gray-700">Avg Mood</div>
              </div>
            )}
            
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600">
                {recapData.topEmotions?.length || 0}
              </div>
              <div className="text-sm text-green-700">Emotions</div>
            </div>
          </div>

          {/* Top Emotions */}
          {recapData.topEmotions && recapData.topEmotions.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Top Emotions</h4>
              <div className="flex flex-wrap gap-2">
                {recapData.topEmotions.map((emotion, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 text-sm rounded-full border ${getSentimentColor(emotion)}`}
                  >
                    {emotion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">AI Summary</h4>
            </div>
            <p className="text-gray-700 leading-relaxed">{recapData.summaryText}</p>
          </div>

          {/* Motivational Message */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-gray-900">Motivation</h4>
            </div>
            <p className="text-gray-700 leading-relaxed">{recapData.motivationalMessage}</p>
          </div>

          {/* Recommendations */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">Recommendations</h4>
            </div>
            <div className="space-y-3">
              {recapData.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{recommendation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={generateInsights}
              disabled={loading}
              className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Regenerate Insights
            </button>
            <button
              onClick={() => {
                setRecapData(null);
                setError(null);
              }}
              className="bg-gray-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-700 transition-colors"
            >
              Clear Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}