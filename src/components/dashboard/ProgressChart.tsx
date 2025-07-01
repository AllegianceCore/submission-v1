import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Clock, Heart, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  ScatterChart, 
  Scatter, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  ReferenceLine 
} from 'recharts';
import { supabase, Reflection } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format, subDays, subWeeks, subMonths, subHours, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

interface ChartData {
  date: string;
  mood: number | null;
  sentiment: number;
  reflectionCount: number;
  reflections: Reflection[];
  dayOfWeek?: string;
  isWeekend?: boolean;
}

interface HourlyScatterData {
  timestamp: number; // Full timestamp for proper chronological ordering
  mood: number;
  sentiment: string;
  time: string;
  content: string;
  created_at: string;
  fullDateTime: string; // For tooltip display
}

interface ProgressChartProps {
  refreshTrigger?: number;
}

type TimeFrame = 'hourly' | 'daily' | 'weekly' | 'monthly';

// Sentiment-based color system for hourly view
const getSentimentColor = (sentiment: string): string => {
  switch (sentiment) {
    case 'positive':
      return '#10b981'; // Green
    case 'negative':
      return '#ef4444'; // Red
    default:
      return '#3b82f6'; // Blue (neutral)
  }
};

// Mood-based color system for other views
const getMoodColor = (mood: number): string => {
  if (mood >= 8) return '#10b981'; // Green for high mood
  if (mood >= 6) return '#3b82f6'; // Blue for good mood
  if (mood >= 4) return '#f59e0b'; // Amber for neutral mood
  return '#ef4444'; // Red for low mood
};

const getMoodEmoji = (score: number | null) => {
  if (!score) return '😐';
  const emojis = ['😢', '😕', '😐', '🙂', '😊', '😄', '😍', '🤩', '🥳', '🌟'];
  return emojis[score - 1] || '😐';
};

// Enhanced Scatter Tooltip Component for Hourly View
interface ScatterTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: HourlyScatterData;
  }>;
}

function ScatterTooltip({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
      <div className="space-y-1">
        <div className="font-semibold text-gray-900">
          Mood: {data.mood}/10
        </div>
        <div className="text-sm text-gray-600">
          {data.fullDateTime}
        </div>
      </div>
    </div>
  );
}

// Bar Chart Tooltip for Daily View
interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartData;
    value: number;
  }>;
  label?: string;
}

function BarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload || !payload.length || payload[0].value === null) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <div className="space-y-1">
        <div className="font-semibold text-gray-900">
          {label}
        </div>
        <div className="text-sm text-gray-600">
          Average Mood: {payload[0].value}/10
        </div>
      </div>
    </div>
  );
}

// Line Chart Tooltip for Weekly/Monthly Views
interface LineTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartData;
    value: number;
  }>;
  label?: string;
}

function LineTooltip({ active, payload, label }: LineTooltipProps) {
  if (!active || !payload || !payload.length || payload[0].value === null) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <div className="space-y-1">
        <div className="font-semibold text-gray-900">
          {label}
        </div>
        <div className="text-sm text-gray-600">
          Average Mood: {payload[0].value}/10
        </div>
      </div>
    </div>
  );
}

export function ProgressChart({ refreshTrigger }: ProgressChartProps) {
  const { user } = useAuth();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [hourlyScatterData, setHourlyScatterData] = useState<HourlyScatterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchChartData(timeFrame);
    }
  }, [user, refreshTrigger, timeFrame]);

  const fetchChartData = async (selectedTimeFrame: TimeFrame) => {
    if (!user) return;

    setLoading(true);
    try {
      const { startDate, periods } = getTimeRangeConfig(selectedTimeFrame);
      
      const { data: reflections } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (reflections) {
        if (selectedTimeFrame === 'hourly') {
          const scatterData = createHourlyScatterData(reflections);
          setHourlyScatterData(scatterData);
          setChartData([]);
        } else {
          const aggregatedData = aggregateDataByTimeFrame(reflections, selectedTimeFrame, periods);
          setChartData(aggregatedData);
          setHourlyScatterData([]);
        }
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createHourlyScatterData = (reflections: Reflection[]): HourlyScatterData[] => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const last24Hours = reflections.filter(reflection => {
      const reflectionDate = new Date(reflection.created_at);
      return reflectionDate >= twentyFourHoursAgo;
    });

    return last24Hours
      .filter(reflection => reflection.mood_score)
      .map(reflection => {
        const date = new Date(reflection.created_at);
        const timestamp = date.getTime(); // Full timestamp for chronological ordering
        const mood = reflection.mood_score!;
        
        return {
          timestamp,
          mood,
          sentiment: reflection.sentiment || 'neutral',
          time: format(date, 'HH:mm'),
          content: reflection.content,
          created_at: reflection.created_at,
          fullDateTime: format(date, 'MMMM dd, HH:mm'), // e.g., "June 29, 20:00"
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp); // Ensure chronological order
  };

  const getTimeRangeConfig = (timeFrame: TimeFrame) => {
    const now = new Date();
    
    switch (timeFrame) {
      case 'hourly':
        return { startDate: subHours(now, 24), periods: 24 };
      case 'daily':
        return { startDate: subDays(now, 30), periods: 30 };
      case 'weekly':
        return { startDate: subWeeks(now, 12), periods: 12 };
      case 'monthly':
        return { startDate: subMonths(now, 12), periods: 12 };
      default:
        return { startDate: subDays(now, 30), periods: 30 };
    }
  };

  const aggregateDataByTimeFrame = (reflections: Reflection[], timeFrame: TimeFrame, periods: number): ChartData[] => {
    const now = new Date();
    const data: ChartData[] = [];

    for (let i = periods - 1; i >= 0; i--) {
      let periodStart: Date;
      let periodEnd: Date;
      let label: string;
      let dayOfWeek: string | undefined;
      let isWeekend: boolean = false;

      switch (timeFrame) {
        case 'daily':
          periodStart = startOfDay(subDays(now, i));
          periodEnd = endOfDay(subDays(now, i));
          label = format(periodStart, 'MMM dd');
          dayOfWeek = format(periodStart, 'EEEE');
          isWeekend = periodStart.getDay() === 0 || periodStart.getDay() === 6;
          break;
        case 'weekly':
          const weekDate = subWeeks(now, i);
          periodStart = startOfWeek(weekDate);
          periodEnd = endOfWeek(weekDate);
          label = format(periodStart, 'MMM dd');
          break;
        case 'monthly':
          const monthDate = subMonths(now, i);
          periodStart = startOfMonth(monthDate);
          periodEnd = endOfMonth(monthDate);
          label = format(periodStart, 'MMM yyyy');
          break;
        default:
          continue;
      }

      const periodReflections = reflections.filter(reflection => {
        const reflectionDate = new Date(reflection.created_at);
        return reflectionDate >= periodStart && reflectionDate <= periodEnd;
      });

      const moodScores = periodReflections
        .filter(r => r.mood_score)
        .map(r => r.mood_score!);
      
      // Set mood to null if no reflections (this will prevent bar/line from rendering)
      const avgMood = moodScores.length > 0 
        ? Math.round((moodScores.reduce((sum, mood) => sum + mood, 0) / moodScores.length) * 10) / 10
        : null;

      const sentimentScore = periodReflections.length > 0
        ? periodReflections.reduce((sum, reflection) => {
            return sum + (reflection.sentiment === 'positive' ? 1 : reflection.sentiment === 'negative' ? -1 : 0);
          }, 0) / periodReflections.length
        : 0;

      data.push({
        date: label,
        mood: avgMood,
        sentiment: sentimentScore,
        reflectionCount: periodReflections.length,
        reflections: periodReflections,
        dayOfWeek,
        isWeekend,
      });
    }

    return data;
  };

  const getTimeFrameLabel = (timeFrame: TimeFrame) => {
    switch (timeFrame) {
      case 'hourly':
        return 'Last 24 Hours';
      case 'daily':
        return 'Last 30 Days';
      case 'weekly':
        return 'Last 12 Weeks';
      case 'monthly':
        return 'Last 12 Months';
      default:
        return '';
    }
  };

  const getTrendIndicator = () => {
    if (timeFrame === 'hourly') {
      if (hourlyScatterData.length < 2) return null;
      
      const recent = hourlyScatterData.slice(-3);
      const earlier = hourlyScatterData.slice(0, 3);
      
      if (recent.length === 0 || earlier.length === 0) return null;
      
      const recentAvg = recent.reduce((sum, d) => sum + d.mood, 0) / recent.length;
      const earlierAvg = earlier.reduce((sum, d) => sum + d.mood, 0) / earlier.length;
      
      const diff = recentAvg - earlierAvg;
      
      if (Math.abs(diff) < 0.5) {
        return { icon: Minus, color: 'text-gray-500', text: 'Stable' };
      } else if (diff > 0) {
        return { icon: ArrowUp, color: 'text-green-500', text: 'Improving' };
      } else {
        return { icon: ArrowDown, color: 'text-red-500', text: 'Declining' };
      }
    } else {
      const dataWithMood = chartData.filter(d => d.mood !== null);
      if (dataWithMood.length < 2) return null;
      
      const recent = dataWithMood.slice(-3);
      const earlier = dataWithMood.slice(0, 3);
      
      if (recent.length === 0 || earlier.length === 0) return null;
      
      const recentAvg = recent.reduce((sum, d) => sum + (d.mood || 0), 0) / recent.length;
      const earlierAvg = earlier.reduce((sum, d) => sum + (d.mood || 0), 0) / earlier.length;
      
      const diff = recentAvg - earlierAvg;
      
      if (Math.abs(diff) < 0.3) {
        return { icon: Minus, color: 'text-gray-500', text: 'Stable' };
      } else if (diff > 0) {
        return { icon: ArrowUp, color: 'text-green-500', text: 'Improving' };
      } else {
        return { icon: ArrowDown, color: 'text-red-500', text: 'Declining' };
      }
    }
  };

  const getAverageStats = () => {
    if (timeFrame === 'hourly') {
      if (hourlyScatterData.length === 0) return { avgMood: 0, positivePeriods: 0, totalReflections: 0, highMoodCount: 0 };
      
      const avgMood = hourlyScatterData.reduce((sum, d) => sum + d.mood, 0) / hourlyScatterData.length;
      const positivePeriods = hourlyScatterData.filter(d => d.sentiment === 'positive').length;
      const highMoodCount = hourlyScatterData.filter(d => d.mood >= 7).length;
      const totalReflections = hourlyScatterData.length;

      return {
        avgMood: Math.round(avgMood * 10) / 10,
        positivePeriods,
        totalReflections,
        highMoodCount
      };
    } else {
      if (chartData.length === 0) return { avgMood: 0, positivePeriods: 0, totalReflections: 0, highMoodCount: 0 };

      const periodsWithData = chartData.filter(d => d.mood !== null && d.reflectionCount > 0);
      const avgMood = periodsWithData.length > 0
        ? periodsWithData.reduce((sum, d) => sum + (d.mood || 0), 0) / periodsWithData.length
        : 0;

      const positivePeriods = chartData.filter(d => d.sentiment > 0).length;
      const highMoodCount = chartData.filter(d => d.mood && d.mood >= 7).length;
      const totalReflections = chartData.reduce((sum, d) => sum + d.reflectionCount, 0);

      return {
        avgMood: Math.round(avgMood * 10) / 10,
        positivePeriods,
        totalReflections,
        highMoodCount
      };
    }
  };

  // Calculate 24-hour time range for hourly chart
  const getHourlyTimeRange = () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfToday = startOfDay(now);
    
    return {
      min: twentyFourHoursAgo.getTime(),
      max: now.getTime(),
      todayStart: startOfToday.getTime()
    };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Progress Trends</h2>
            <p className="text-sm text-gray-500">Loading your mood data...</p>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const stats = getAverageStats();
  const hasData = timeFrame === 'hourly' 
    ? hourlyScatterData.length > 0 
    : chartData.some(d => d.mood !== null && d.reflectionCount > 0);
  const trendIndicator = getTrendIndicator();
  const timeRange = timeFrame === 'hourly' ? getHourlyTimeRange() : null;

  return (
    <div 
      className="bg-white rounded-2xl shadow-lg p-6"
      role="region"
      aria-label="Progress Trends Chart"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">Progress Trends</h2>
            {trendIndicator && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full bg-gray-50 ${trendIndicator.color}`}>
                <trendIndicator.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{trendIndicator.text}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {timeFrame === 'hourly' 
              ? 'Individual reflection moments in chronological order over the last 24 hours'
              : timeFrame === 'daily'
              ? 'Daily average mood levels - bars show days with reflections'
              : 'Smooth trend lines showing your mood journey over time'
            }
          </p>
        </div>
      </div>

      {/* Time Frame Selection */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6" role="tablist" aria-label="Time frame selection">
        {(['hourly', 'daily', 'weekly', 'monthly'] as TimeFrame[]).map((frame) => (
          <button
            key={frame}
            onClick={() => setTimeFrame(frame)}
            role="tab"
            aria-selected={timeFrame === frame}
            aria-controls={`chart-${frame}`}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all capitalize ${
              timeFrame === frame
                ? 'bg-white text-green-700 shadow-sm transform scale-105'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {frame}
          </button>
        ))}
      </div>

      {/* Current Time Frame Info */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{getTimeFrameLabel(timeFrame)}</h3>
        <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            <span>
              {timeFrame === 'hourly' 
                ? 'Chronological order: Green (positive), Blue (neutral), Red (negative)'
                : timeFrame === 'daily'
                ? 'Bars show average mood per day'
                : 'Smooth curves show mood trends'
              }
            </span>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-16" role="status" aria-live="polite">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No reflections yet for this period
          </h3>
          <p className="text-gray-500 mb-4">
            Start reflecting to see your progress!
          </p>
          <div className="bg-blue-50 rounded-lg p-4 inline-block">
            <p className="text-sm text-blue-700">
              💡 <strong>Tip:</strong> Regular reflection helps track your emotional patterns and growth.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div 
            className="h-80 mb-6 bg-gray-50 rounded-xl p-2 sm:p-4"
            id={`chart-${timeFrame}`}
            role="img"
            aria-label={`${timeFrame} mood trend chart`}
          >
            <ResponsiveContainer width="100%" height="100%">
              {timeFrame === 'hourly' ? (
                <ScatterChart 
                  data={hourlyScatterData} 
                  margin={{ top: 20, right: 40, bottom: 20, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis 
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={[timeRange!.min, timeRange!.max]}
                    stroke="#6b7280"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                    tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis 
                    domain={[0.5, 10.5]}
                    stroke="#6b7280"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) => value === 0.5 ? '' : value}
                  />
                  <ReferenceLine y={5.5} stroke="#d1d5db" strokeDasharray="2 2" opacity={0.5} />
                  {/* Vertical line to indicate start of today */}
                  <ReferenceLine 
                    x={timeRange!.todayStart} 
                    stroke="#6366f1" 
                    strokeDasharray="4 4" 
                    opacity={0.6}
                    label={{ 
                      value: "Today", 
                      position: "topLeft",
                      style: { 
                        fill: '#6366f1', 
                        fontSize: '12px', 
                        fontWeight: 'bold' 
                      }
                    }}
                  />
                  <Tooltip content={<ScatterTooltip />} />
                  <Scatter dataKey="mood" r={8}>
                    {hourlyScatterData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getSentimentColor(entry.sentiment)} 
                        stroke="#ffffff" 
                        strokeWidth={2} 
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              ) : timeFrame === 'daily' ? (
                <BarChart 
                  data={chartData} 
                  margin={{ top: 20, right: 40, bottom: 20, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={12}
                    domain={[0.5, 10.5]}
                    tick={{ fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) => value === 0.5 ? '' : value}
                  />
                  <ReferenceLine y={5.5} stroke="#d1d5db" strokeDasharray="2 2" opacity={0.5} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar 
                    dataKey="mood" 
                    radius={[4, 4, 0, 0]}
                    fill="url(#barGradient)"
                  >
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.mood ? getMoodColor(entry.mood) : 'transparent'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart 
                  data={chartData} 
                  margin={{ top: 20, right: 40, bottom: 20, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={12}
                    domain={[0.5, 10.5]}
                    tick={{ fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) => value === 0.5 ? '' : value}
                  />
                  <ReferenceLine y={5.5} stroke="#d1d5db" strokeDasharray="2 2" opacity={0.5} />
                  <Tooltip content={<LineTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!payload.mood) return null;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={getMoodColor(payload.mood)}
                          stroke="#ffffff"
                          strokeWidth={3}
                        />
                      );
                    }}
                    activeDot={{ 
                      r: 8, 
                      stroke: '#2563eb', 
                      strokeWidth: 3,
                      fill: '#ffffff'
                    }}
                    connectNulls={false}
                    curve="catmullRom"
                    tension={0.5}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Enhanced Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
                {stats.avgMood || 'N/A'}
                {stats.avgMood && <span className="text-lg">{getMoodEmoji(stats.avgMood)}</span>}
              </p>
              <p className="text-sm text-blue-700 font-medium">Average Mood</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">
                {stats.positivePeriods}
              </p>
              <p className="text-sm text-green-700 font-medium">
                Positive {timeFrame === 'hourly' ? 'Moments' : 
                         timeFrame === 'daily' ? 'Days' : 
                         timeFrame === 'weekly' ? 'Weeks' : 'Months'}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalReflections}
              </p>
              <p className="text-sm text-purple-700 font-medium">Total Reflections</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-600">
                {stats.highMoodCount}
              </p>
              <p className="text-sm text-emerald-700 font-medium">High Mood (7+)</p>
            </div>
          </div>

          {/* Enhanced Insights */}
          {stats.avgMood > 0 && (
            <div className="p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🎯</div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Your Progress Insights</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    {timeFrame === 'hourly' ? (
                      <p>
                        <strong>24-Hour Journey:</strong> {hourlyScatterData.length} reflections with an average mood of {stats.avgMood}/10. 
                        {stats.positivePeriods > 0 && ` ${stats.positivePeriods} positive moments! 🌟`}
                        {' '}Your reflections flow chronologically from yesterday to now, showing your real emotional journey.
                      </p>
                    ) : (
                      <>
                        <p>
                          {stats.avgMood >= 7 ? (
                            <><strong>Excellent progress!</strong> Your average mood of {stats.avgMood}/10 shows you're thriving! 🚀</>
                          ) : stats.avgMood >= 5 ? (
                            <><strong>Steady progress:</strong> Average mood of {stats.avgMood}/10 - you're on a positive path! ✨</>
                          ) : (
                            <><strong>Building resilience:</strong> Every step forward counts with your average mood of {stats.avgMood}/10! 💪</>
                          )}
                        </p>
                        {trendIndicator && (
                          <p>
                            <strong>Recent trend:</strong> Your mood appears to be {trendIndicator.text.toLowerCase()}.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}