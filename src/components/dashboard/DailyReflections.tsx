import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { DailyReflectionForm } from './DailyReflectionForm';
import { TodaysReflectionsList } from './TodaysReflectionsList';
import { supabase, Reflection } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface DailyReflectionsProps {
  onReflectionSaved?: () => void;
}

export function DailyReflections({ onReflectionSaved }: DailyReflectionsProps) {
  const { user } = useAuth();
  const [todaysReflections, setTodaysReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTodaysReflections();
    }
  }, [user]);

  const fetchTodaysReflections = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('reflections')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setTodaysReflections(data || []);
    } catch (error) {
      console.error('Error fetching today\'s reflections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReflectionAdded = async () => {
    await fetchTodaysReflections();
    onReflectionSaved?.();
  };

  const handleReflectionDeleted = async () => {
    await fetchTodaysReflections();
    onReflectionSaved?.();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
          <Heart className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Reflections</h2>
          <p className="text-sm text-gray-500">
            {todaysReflections.length === 0 
              ? "Share your thoughts and feelings" 
              : `${todaysReflections.length} reflection${todaysReflections.length !== 1 ? 's' : ''} today`
            }
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Add New Reflection Form */}
        <DailyReflectionForm onReflectionAdded={handleReflectionAdded} />

        {/* Today's Reflections List */}
        <TodaysReflectionsList 
          reflections={todaysReflections}
          loading={loading}
          onReflectionDeleted={handleReflectionDeleted}
        />
      </div>
    </div>
  );
}