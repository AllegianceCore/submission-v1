import React, { useState } from 'react';
import { Upload, CheckCircle, Star, Loader, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface AIStylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AnalysisResult {
  positive_comments: string[];
  suggestions: string[];
  style_rating: number;
}

export function AIStylistModal({ isOpen, onClose }: AIStylistModalProps) {
  const { user } = useAuth();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPEG or PNG image file.');
      return false;
    }

    if (file.size > maxSize) {
      setError('Image file must be smaller than 10MB.');
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setImageFile(file);
      setError(null);
      setAnalysisResult(null);
    }
  };

  async function analyzeOutfit() {
    if (!imageFile) {
      alert("Please upload a photo first.");
      return;
    }

    if (!user) {
      setError('You must be signed in to analyze outfits.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current session for authorization
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session found. Please sign in again.');
      }

      // Create FormData to send the image file to the Edge Function
      const formData = new FormData();
      formData.append('image', imageFile);

      console.log('Sending image to Edge Function for analysis...');

      // Call the secure Edge Function instead of OpenAI directly
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-outfit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to analyze outfit');
      }

      const result = await response.json();
      
      // Validate the response structure
      if (!result.positive_comments || !Array.isArray(result.positive_comments) ||
          !result.suggestions || !Array.isArray(result.suggestions) ||
          typeof result.style_rating !== 'number') {
        throw new Error('Invalid response format from analysis service');
      }

      setAnalysisResult(result);
      console.log('Outfit analysis completed successfully');

    } catch (err) {
      console.error('Error analyzing outfit:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze outfit. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const saveToDatabase = async () => {
    if (!user || !analysisResult) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('style_feedback')
        .insert([{
          user_id: user.id,
          positive_comments: analysisResult.positive_comments,
          suggestions: analysisResult.suggestions,
          style_rating: analysisResult.style_rating
        }]);

      if (error) throw error;

      // Close modal and trigger refresh of parent component
      onClose();
    } catch (err) {
      console.error('Error saving to database:', err);
      setError('Failed to save analysis. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-yellow-600';
    if (rating >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <div className="text-6xl mb-4">👗</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Stylist</h2>
        <p className="text-gray-600">Upload a photo of your outfit and get instant fashion feedback</p>
      </div>

      {/* File Input */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Upload Your Outfit Photo
        </label>
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-4 text-gray-500" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> your outfit photo
              </p>
              <p className="text-xs text-gray-500">JPEG or PNG (MAX. 10MB)</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
        
        {/* Show selected file */}
        {imageFile && (
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            Selected: <span className="font-medium">{imageFile.name}</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Analyze Button */}
      {!analysisResult && (
        <button
          onClick={analyzeOutfit}
          disabled={isLoading || !imageFile}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze My Outfit'
          )}
        </button>
      )}

      {/* Loading Message */}
      {isLoading && (
        <div className="text-center py-8">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Our AI stylist is analyzing your outfit...</p>
        </div>
      )}

      {/* Results Section */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Style Rating */}
          <div className="text-center p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className={`w-8 h-8 ${getRatingColor(analysisResult.style_rating)}`} fill="currentColor" />
              <span className={`text-4xl font-bold ${getRatingColor(analysisResult.style_rating)}`}>
                {analysisResult.style_rating}
              </span>
              <span className="text-2xl text-gray-600">/10</span>
            </div>
            <p className="text-lg font-semibold text-gray-700">Style Rating</p>
          </div>

          {/* Positive Comments as Checklist */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              What's Working Great
            </h3>
            <div className="space-y-2">
              {analysisResult.positive_comments.map((comment, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-green-800">{comment}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions in Highlighted Box */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Style Suggestions</h3>
            {analysisResult.suggestions.length > 0 ? (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="space-y-3">
                  {analysisResult.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <p className="text-blue-800">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-green-800 font-medium text-center">
                  🎉 No improvements needed—great job!
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setImageFile(null);
                setAnalysisResult(null);
                setError(null);
              }}
              className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Try Another Photo
            </button>
            <button
              onClick={saveToDatabase}
              disabled={isSaving}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save to Style Journal'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}