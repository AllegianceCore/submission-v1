import React, { useState } from 'react';
import { Eye, EyeOff, Sparkles, Heart, Target } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { BoltBadge } from '../ui/BoltBadge';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AiCareOfYou</h1>
            <p className="text-gray-600">Your AI-powered transformation companion</p>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center p-3 bg-white rounded-xl shadow-sm">
              <Heart className="w-6 h-6 text-pink-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600">Daily Reflections</p>
            </div>
            <div className="text-center p-3 bg-white rounded-xl shadow-sm">
              <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600">Habit Tracking</p>
            </div>
            <div className="text-center p-3 bg-white rounded-xl shadow-sm">
              <Sparkles className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600">AI Insights</p>
            </div>
          </div>

          {/* Auth Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex mb-6">
              <button
                type="button"
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                  !isSignUp
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setIsSignUp(false)}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                  isSignUp
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setIsSignUp(true)}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Start your transformation journey today
          </p>
        </div>
      </div>
      
      {/* Bolt Badge positioned absolutely in top right */}
      <BoltBadge />
    </>
  );
}