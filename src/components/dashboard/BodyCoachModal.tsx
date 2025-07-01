import React, { useState } from 'react';
import { Upload, Check, User, Heart, Dumbbell, ArrowRight, ArrowLeft, Loader, Camera, AlertCircle, Download, RefreshCw, CheckCircle, AlertTriangle, Sparkles, Clock, Target, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface BodyCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  frontImage: File | null;
  backImage: File | null;
  height: string;
  weight: string;
  heightUnit: 'cm' | 'ft';
  weightUnit: 'kg' | 'lbs';
  activities: string[];
  foods: string;
  allergies: string;
  passions: string;
  goals: string;
  trainingDays: number;
  enjoysCardio: boolean;
  // New personalization fields
  injuries: string;
  targetAreas: string;
}

interface AnalysisResult {
  strengths: string;
  weaknesses: string;
  workout_plan: string;
  nutrition_advice: string;
  motivational_message: string;
}

interface WorkoutDay {
  day: string;
  exercises: Array<{
    name: string;
    sets: string;
    reps?: string;
    rest?: string;
  }>;
  notes?: string;
}

interface MealPlan {
  name: string;
  foods: string[];
  portions?: string;
}

interface NutritionData {
  meals: MealPlan[];
  tips: string[];
  hydration?: string;
}

const ACTIVITY_OPTIONS = [
  'Weight Training',
  'Yoga',
  'Dancing',
  'Walking',
  'Running',
  'Swimming',
  'Cycling',
  'Hiking',
  'Pilates',
  'Martial Arts',
  'Team Sports',
  'Rock Climbing'
];

export function BodyCoachModal({ isOpen, onClose }: BodyCoachModalProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    frontImage: null,
    backImage: null,
    height: '',
    weight: '',
    heightUnit: 'cm',
    weightUnit: 'kg',
    activities: [],
    foods: '',
    allergies: '',
    passions: '',
    goals: '',
    trainingDays: 3,
    enjoysCardio: true,
    // New fields
    injuries: '',
    targetAreas: '',
  });

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      frontImage: null,
      backImage: null,
      height: '',
      weight: '',
      heightUnit: 'cm',
      weightUnit: 'kg',
      activities: [],
      foods: '',
      allergies: '',
      passions: '',
      goals: '',
      trainingDays: 3,
      enjoysCardio: true,
      injuries: '',
      targetAreas: '',
    });
    setAnalysisResult(null);
    setSavedAnalysisId(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleImageUpload = (file: File, type: 'front' | 'back') => {
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPEG or PNG image');
      return;
    }

    setError(null);
    setFormData(prev => ({
      ...prev,
      [type === 'front' ? 'frontImage' : 'backImage']: file
    }));
  };

  const handleActivityToggle = (activity: string) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.includes(activity)
        ? prev.activities.filter(a => a !== activity)
        : [...prev.activities, activity]
    }));
  };

  const canProceedToStep2 = formData.frontImage && formData.backImage;
  const canProceedToStep3 = formData.height && formData.weight;
  const canProceedToStep4 = formData.foods && formData.goals;
  const canSubmit = formData.targetAreas; // At least target areas must be filled

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const uploadImageToStorage = async (file: File, filename: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('body-analysis')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      if (error.message?.includes('Bucket not found')) {
        throw new Error('Storage bucket "body-analysis" does not exist. Please create this bucket in your Supabase dashboard.');
      }
      throw new Error(`Image upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('body-analysis')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const analyzeWithOpenAI = async (frontImageUrl: string, backImageUrl: string): Promise<AnalysisResult> => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-body`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        front_image_url: frontImageUrl,
        back_image_url: backImageUrl,
        preferences: {
          height: formData.height,
          weight: formData.weight,
          heightUnit: formData.heightUnit,
          weightUnit: formData.weightUnit,
          activities: formData.activities,
          foods: formData.foods,
          allergies: formData.allergies,
          passions: formData.passions,
          goals: formData.goals,
          trainingDays: formData.trainingDays,
          enjoysCardio: formData.enjoysCardio,
          // Include new personalization fields
          injuries: formData.injuries,
          targetAreas: formData.targetAreas,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Analysis failed');
    }

    return await response.json();
  };

  const handleSubmit = async () => {
    if (!user || !formData.frontImage || !formData.backImage) return;

    setLoading(true);
    setError(null);

    try {
      // Upload images
      const timestamp = Date.now();
      const frontFilename = `${user.id}/front_${timestamp}.jpg`;
      const backFilename = `${user.id}/back_${timestamp}.jpg`;

      const [frontImageUrl, backImageUrl] = await Promise.all([
        uploadImageToStorage(formData.frontImage, frontFilename),
        uploadImageToStorage(formData.backImage, backFilename)
      ]);

      // Analyze with OpenAI
      const analysis = await analyzeWithOpenAI(frontImageUrl, backImageUrl);

      // Save to database
      const { data: savedData, error: saveError } = await supabase
        .from('body_feedback')
        .insert([{
          user_id: user.id,
          front_image_url: frontImageUrl,
          back_image_url: backImageUrl,
          height: formData.height,
          weight: formData.weight,
          preferences: {
            heightUnit: formData.heightUnit,
            weightUnit: formData.weightUnit,
            activities: formData.activities,
            foods: formData.foods,
            allergies: formData.allergies,
            passions: formData.passions,
            goals: formData.goals,
            trainingDays: formData.trainingDays,
            enjoysCardio: formData.enjoysCardio,
            injuries: formData.injuries,
            targetAreas: formData.targetAreas,
          },
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          workout_plan: analysis.workout_plan,
          nutrition_advice: analysis.nutrition_advice,
          motivational_message: analysis.motivational_message,
        }])
        .select()
        .single();

      if (saveError) throw saveError;

      setAnalysisResult(analysis);
      setSavedAnalysisId(savedData.id);
      setCurrentStep(5); // Results step is now step 5

    } catch (err) {
      console.error('Error during analysis:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadAsPDF = () => {
    if (!analysisResult) return;

    // Create a comprehensive text version for download
    const content = `
AI BODY COACH - PERSONALIZED WELLNESS PLAN
==========================================

Generated on: ${new Date().toLocaleDateString()}

STRENGTHS
---------
${analysisResult.strengths}

AREAS FOR IMPROVEMENT
--------------------
${analysisResult.weaknesses}

🏋️ PERSONALIZED WORKOUT PLAN
-----------------------------
${analysisResult.workout_plan}

🍽️ NUTRITION PLAN
------------------
${analysisResult.nutrition_advice}

MOTIVATIONAL MESSAGE
-------------------
${analysisResult.motivational_message}

---
This plan was generated by ThriveCoach AI Body Coach
Remember: Consistency beats perfection!
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `body-coach-plan-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Enhanced workout plan parsing with better structure detection
  const parseWorkoutPlan = (workoutText: string): WorkoutDay[] => {
    if (typeof workoutText !== 'string') {
      return [];
    }

    const lines = workoutText.split('\n').filter(line => line.trim());
    const workouts: WorkoutDay[] = [];
    let currentWorkout: WorkoutDay | null = null;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Enhanced day detection patterns
      if (
        /^(Day\s*\d+|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(trimmed) ||
        trimmed.includes('**Day') ||
        (trimmed.includes(':') && /day|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(trimmed))
      ) {
        // Save previous workout if exists
        if (currentWorkout) {
          workouts.push(currentWorkout);
        }
        
        // Clean up day name
        const dayName = trimmed
          .replace(/^\*\*|\*\*$/g, '')
          .replace(/[:]/g, '')
          .trim();
        
        currentWorkout = {
          day: dayName,
          exercises: [],
          notes: ''
        };
      }
      // Enhanced exercise detection
      else if (currentWorkout && (
        trimmed.includes('sets') || 
        trimmed.includes('reps') ||
        trimmed.includes('minutes') ||
        /^\-/.test(trimmed) ||
        /^\d+\./.test(trimmed) ||
        trimmed.includes(':')
      )) {
        let exerciseName = '';
        let sets = '';
        let reps = '';
        let rest = '';
        
        // Parse different formats
        if (trimmed.includes(':')) {
          const [name, details] = trimmed.split(':').map(s => s.trim());
          exerciseName = name.replace(/^[\-\d\.]\s*/, '');
          
          // Extract sets, reps, and rest from details
          const setsMatch = details.match(/(\d+)\s*sets?/i);
          const repsMatch = details.match(/(\d+(?:-\d+)?)\s*reps?/i);
          const restMatch = details.match(/(\d+(?:-\d+)?)\s*(?:seconds?|mins?)/i);
          
          sets = setsMatch ? setsMatch[1] + ' sets' : '';
          reps = repsMatch ? repsMatch[1] + ' reps' : '';
          rest = restMatch ? restMatch[0] : '';
          
          // If no structured format found, use the whole details as sets
          if (!setsMatch && !repsMatch) {
            sets = details;
          }
        } else {
          // Handle bullet point or numbered format
          exerciseName = trimmed.replace(/^[\-\d\.]\s*/, '');
        }
        
        if (exerciseName) {
          currentWorkout.exercises.push({
            name: exerciseName,
            sets: sets || 'As described',
            reps,
            rest
          });
        }
      }
      // Rest/note lines
      else if (currentWorkout && (
        trimmed.toLowerCase().includes('rest') ||
        trimmed.toLowerCase().includes('note') ||
        trimmed.toLowerCase().includes('tip')
      )) {
        currentWorkout.notes = (currentWorkout.notes || '') + (currentWorkout.notes ? ' ' : '') + trimmed;
      }
    });
    
    // Don't forget the last workout
    if (currentWorkout) {
      workouts.push(currentWorkout);
    }
    
    return workouts;
  };

  // Enhanced nutrition plan parsing with better meal detection
  const parseNutritionPlan = (nutritionText: string): NutritionData => {
    if (typeof nutritionText !== 'string') {
      return { meals: [], tips: [] };
    }

    const lines = nutritionText.split('\n').filter(line => line.trim());
    const meals: MealPlan[] = [];
    const tips: string[] = [];
    let currentMeal: MealPlan | null = null;
    let hydration = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Enhanced meal detection
      if (
        /^(\*\*|##)?(breakfast|lunch|dinner|snack)/i.test(trimmed) ||
        trimmed.toLowerCase().includes('meal') ||
        (trimmed.includes(':') && /breakfast|lunch|dinner|snack|morning|afternoon|evening/i.test(trimmed))
      ) {
        // Save previous meal
        if (currentMeal) {
          meals.push(currentMeal);
        }
        
        // Clean meal name
        const mealName = trimmed
          .replace(/^\*\*|\*\*$|^##|##$/g, '')
          .replace(/[:]/g, '')
          .replace(/^\d+\.\s*/, '')
          .trim();
        
        currentMeal = {
          name: mealName,
          foods: [],
          portions: ''
        };
      }
      // Food items and portions
      else if (currentMeal && (
        trimmed.startsWith('-') ||
        trimmed.startsWith('•') ||
        /\d+\s*(oz|cup|tbsp|tsp|slice|piece)/i.test(trimmed) ||
        /^\d+\./.test(trimmed)
      )) {
        const foodItem = trimmed
          .replace(/^[\-•\d\.]\s*/, '')
          .trim();
        
        if (foodItem) {
          currentMeal.foods.push(foodItem);
        }
      }
      // Tips and hydration
      else if (
        trimmed.toLowerCase().includes('tip') ||
        trimmed.toLowerCase().includes('hydration') ||
        trimmed.toLowerCase().includes('water') ||
        trimmed.toLowerCase().includes('drink')
      ) {
        if (trimmed.toLowerCase().includes('hydration') || trimmed.toLowerCase().includes('water')) {
          hydration = trimmed;
        } else {
          tips.push(trimmed.replace(/^\*\*|\*\*$/g, ''));
        }
      }
      // General nutritional advice
      else if (
        trimmed.length > 10 && 
        !currentMeal &&
        (trimmed.toLowerCase().includes('calories') ||
         trimmed.toLowerCase().includes('protein') ||
         trimmed.toLowerCase().includes('balance') ||
         trimmed.toLowerCase().includes('avoid'))
      ) {
        tips.push(trimmed);
      }
    });
    
    // Don't forget the last meal
    if (currentMeal) {
      meals.push(currentMeal);
    }
    
    return { meals, tips, hydration };
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">📸</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Your Photos</h3>
        <p className="text-gray-600">Please upload front and back view photos in good lighting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Front Photo */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Front View Photo
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'front')}
              className="hidden"
              id="front-photo"
            />
            <label
              htmlFor="front-photo"
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                formData.frontImage ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {formData.frontImage ? (
                <div className="text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">Front photo uploaded!</p>
                  <p className="text-xs text-green-600">{formData.frontImage.name}</p>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload front view</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Back Photo */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Back View Photo
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'back')}
              className="hidden"
              id="back-photo"
            />
            <label
              htmlFor="back-photo"
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                formData.backImage ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {formData.backImage ? (
                <div className="text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">Back photo uploaded!</p>
                  <p className="text-xs text-green-600">{formData.backImage.name}</p>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload back view</p>
                </div>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>📋 Tips for best results:</strong> Stand straight, wear form-fitting clothes, good lighting, clear background
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <User className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Basic Information</h3>
        <p className="text-gray-600">Help us understand your physical stats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Height */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Height</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={formData.height}
              onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
              placeholder={formData.heightUnit === 'cm' ? '170' : '5.7'}
              step={formData.heightUnit === 'cm' ? '1' : '0.1'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={formData.heightUnit}
              onChange={(e) => setFormData(prev => ({ ...prev, heightUnit: e.target.value as 'cm' | 'ft' }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cm">cm</option>
              <option value="ft">ft</option>
            </select>
          </div>
        </div>

        {/* Weight */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Weight</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={formData.weight}
              onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
              placeholder={formData.weightUnit === 'kg' ? '70' : '154'}
              step="0.1"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={formData.weightUnit}
              onChange={(e) => setFormData(prev => ({ ...prev, weightUnit: e.target.value as 'kg' | 'lbs' }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Heart className="w-12 h-12 text-pink-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Preferences & Lifestyle</h3>
        <p className="text-gray-600">Tell us about your interests and goals</p>
      </div>

      <div className="space-y-6">
        {/* Activities */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            What activities do you enjoy? (Select all that apply)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ACTIVITY_OPTIONS.map((activity) => (
              <button
                key={activity}
                type="button"
                onClick={() => handleActivityToggle(activity)}
                className={`p-3 text-sm rounded-lg border transition-colors ${
                  formData.activities.includes(activity)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {activity}
              </button>
            ))}
          </div>
        </div>

        {/* Training Days */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            How many days per week would you like to train?
          </label>
          <select
            value={formData.trainingDays}
            onChange={(e) => setFormData(prev => ({ ...prev, trainingDays: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[1, 2, 3, 4, 5, 6, 7].map(days => (
              <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>
            ))}
          </select>
        </div>

        {/* Cardio */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Do you enjoy cardio?</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="cardio"
                checked={formData.enjoysCardio === true}
                onChange={() => setFormData(prev => ({ ...prev, enjoysCardio: true }))}
                className="mr-2"
              />
              Yes
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="cardio"
                checked={formData.enjoysCardio === false}
                onChange={() => setFormData(prev => ({ ...prev, enjoysCardio: false }))}
                className="mr-2"
              />
              No
            </label>
          </div>
        </div>

        {/* Foods */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            What foods do you like? *
          </label>
          <textarea
            value={formData.foods}
            onChange={(e) => setFormData(prev => ({ ...prev, foods: e.target.value }))}
            placeholder="Tell us about your favorite foods, cuisines, or dietary preferences..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none"
            required
          />
        </div>

        {/* Allergies */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Any allergies?</label>
          <textarea
            value={formData.allergies}
            onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
            placeholder="List any food allergies or dietary restrictions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-16 resize-none"
          />
        </div>

        {/* Passions */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Your passions?</label>
          <textarea
            value={formData.passions}
            onChange={(e) => setFormData(prev => ({ ...prev, passions: e.target.value }))}
            placeholder="What are you passionate about in life?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-16 resize-none"
          />
        </div>

        {/* Goals */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Your goals or plans? *
          </label>
          <textarea
            value={formData.goals}
            onChange={(e) => setFormData(prev => ({ ...prev, goals: e.target.value }))}
            placeholder="What are your fitness and wellness goals?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none"
            required
          />
        </div>
      </div>
    </div>
  );

  // NEW: Step 4 - Personalization Questions
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <UserCheck className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Personalization Questions</h3>
        <p className="text-gray-600">Help us create the most tailored plan for you</p>
      </div>

      <div className="space-y-6">
        {/* Injuries Question */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Do you have any injuries or physical limitations I should consider?
          </label>
          <textarea
            value={formData.injuries}
            onChange={(e) => setFormData(prev => ({ ...prev, injuries: e.target.value }))}
            placeholder="Please describe any injuries, physical limitations, or areas you need to be careful with (e.g., 'left shoulder injury from 2 years ago', 'lower back issues', 'knee problems'). If none, you can write 'None'."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-24 resize-none"
          />
          <p className="text-sm text-gray-500">
            This helps us avoid exercises that could aggravate existing conditions and suggest modifications when needed.
          </p>
        </div>

        {/* Target Areas Question */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            What areas of your physique or health would you most like to improve? *
          </label>
          <textarea
            value={formData.targetAreas}
            onChange={(e) => setFormData(prev => ({ ...prev, targetAreas: e.target.value }))}
            placeholder="Be specific about what you'd like to focus on (e.g., 'building muscle in the shoulders and arms', 'losing belly fat', 'improving cardiovascular endurance', 'strengthening my core', 'increasing overall flexibility', 'improving posture')..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-24 resize-none"
            required
          />
          <p className="text-sm text-gray-500">
            This helps us prioritize certain exercises and design your workout plan around your specific goals.
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-lg p-4">
        <p className="text-sm text-indigo-700">
          <strong>💡 Why we ask:</strong> These questions help our AI trainer create a plan that's specifically designed for your body and goals, 
          ensuring safety and maximum effectiveness.
        </p>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!analysisResult) return null;

    const workouts = parseWorkoutPlan(analysisResult.workout_plan);
    const nutritionData = parseNutritionPlan(analysisResult.nutrition_advice);

    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Personalized Plan is Ready!</h3>
          <p className="text-gray-600">Here's your custom fitness and wellness plan crafted just for you</p>
        </div>

        {/* Strengths */}
        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2 text-lg">
            <CheckCircle className="w-6 h-6" />
            Your Strengths
          </h4>
          <p className="text-green-800 leading-relaxed">{analysisResult.strengths}</p>
        </div>

        {/* Areas for Improvement */}
        <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
          <h4 className="font-bold text-yellow-900 mb-3 flex items-center gap-2 text-lg">
            <AlertTriangle className="w-6 h-6" />
            Areas to Improve
          </h4>
          <p className="text-yellow-800 leading-relaxed">{analysisResult.weaknesses}</p>
        </div>

        {/* Enhanced Workout Plan */}
        <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
          <h4 className="font-bold text-purple-900 mb-6 flex items-center gap-2 text-lg">
            <Dumbbell className="w-6 h-6" />
            🏋️ Personalized Workout Plan
          </h4>
          
          {workouts.length > 0 ? (
            <div className="space-y-6">
              {workouts.map((workout, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border border-purple-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <h5 className="text-lg font-bold text-purple-900">{workout.day}</h5>
                  </div>
                  
                  <div className="space-y-3">
                    {workout.exercises.map((exercise, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-purple-25 rounded-lg border border-purple-100">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                            <span className="font-semibold text-purple-900">{exercise.name}</span>
                          </div>
                          {exercise.reps && (
                            <div className="ml-5 mt-1 text-sm text-purple-700">
                              Reps: {exercise.reps}
                            </div>
                          )}
                          {exercise.rest && (
                            <div className="ml-5 mt-1 text-sm text-purple-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Rest: {exercise.rest}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                            {exercise.sets}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {workout.notes && (
                    <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                      <p className="text-sm text-purple-800 italic">
                        <strong>Note:</strong> {workout.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 border border-purple-200">
              <div className="text-purple-800 leading-relaxed space-y-3">
                {analysisResult.workout_plan.split('\n').filter(line => line.trim()).map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>{line.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Nutrition Plan */}
        <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
          <h4 className="font-bold text-orange-900 mb-6 flex items-center gap-2 text-lg">
            <Heart className="w-6 h-6" />
            🍽️ Nutrition Plan
          </h4>
          
          {nutritionData.meals.length > 0 ? (
            <div className="space-y-6">
              {/* Meal Plan */}
              <div className="grid gap-4">
                {nutritionData.meals.map((meal, index) => (
                  <div key={index} className="bg-white rounded-lg p-5 border border-orange-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <h5 className="text-lg font-bold text-orange-900">{meal.name}</h5>
                    </div>
                    <div className="space-y-2">
                      {meal.foods.map((food, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2 bg-orange-25 rounded">
                          <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-orange-800 text-sm leading-relaxed">{food}</span>
                        </div>
                      ))}
                    </div>
                    {meal.portions && (
                      <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-orange-700">
                        <strong>Portions:</strong> {meal.portions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Nutrition Tips */}
              {(nutritionData.tips.length > 0 || nutritionData.hydration) && (
                <div className="bg-white rounded-lg p-5 border border-orange-200 shadow-sm">
                  <h5 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Nutrition Tips
                  </h5>
                  <div className="space-y-3">
                    {nutritionData.hydration && (
                      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                        <p className="text-blue-800 text-sm font-medium">{nutritionData.hydration}</p>
                      </div>
                    )}
                    {nutritionData.tips.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-orange-25 rounded-lg">
                        <div className="w-2 h-2 bg-orange-600 rounded-full mt-2"></div>
                        <p className="text-orange-800 text-sm leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 border border-orange-200">
              <div className="text-orange-800 leading-relaxed space-y-3">
                {analysisResult.nutrition_advice.split('\n').filter(line => line.trim()).map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>{line.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Motivational Message */}
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border-2 border-pink-200">
          <h4 className="font-bold text-pink-900 mb-4 flex items-center gap-2 text-lg">
            <Sparkles className="w-6 h-6" />
            Your Personal Message
          </h4>
          <p className="text-pink-800 leading-relaxed italic text-lg">{analysisResult.motivational_message}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
          <button
            onClick={downloadAsPDF}
            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Plan
          </button>
          <button
            onClick={() => {
              setAnalysisResult(null);
              setSavedAnalysisId(null);
              setCurrentStep(1);
            }}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Generate New Plan
          </button>
          <button
            onClick={handleClose}
            className="bg-gray-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Dumbbell className="w-10 h-10 text-white animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Creating Your Personalized Plan
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Our AI fitness coach and nutritionist are analyzing your photos and preferences to create a comprehensive wellness plan tailored just for you...
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Loader className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm text-gray-700">Analyzing body composition and considering your limitations...</span>
            </div>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-700">Creating personalized workout routines for your target areas...</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-600" />
              <span className="text-sm text-gray-700">Designing nutrition plan aligned with your goals...</span>
            </div>
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 This may take 1-2 minutes as we create something truly personalized for your unique needs!
            </p>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4(); // NEW: Personalization questions
      case 5:
        return renderResults(); // Results step is now step 5
      default:
        return renderStep1();
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      {currentStep <= 4 && (
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex items-center ${step < 4 ? 'flex-1' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step < currentStep ? <Check className="w-4 h-4" /> : step}
              </div>
              {step < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-colors ${
                    step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-red-700 font-medium">Analysis Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation Buttons */}
      {currentStep <= 4 && !loading && (
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={currentStep === 4 ? handleSubmit : nextStep}
            disabled={
              (currentStep === 1 && !canProceedToStep2) ||
              (currentStep === 2 && !canProceedToStep3) ||
              (currentStep === 3 && !canProceedToStep4) ||
              (currentStep === 4 && !canSubmit)
            }
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {currentStep === 4 ? 'Create My Personalized Plan' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}