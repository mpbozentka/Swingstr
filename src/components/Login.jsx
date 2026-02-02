import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';

export default function Login({ onLogin, onRegister, error, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSignUp) {
      await onRegister(email, password);
    } else {
      await onLogin(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/swingstr-logo.jpg"
            alt="Swingstr"
            className="h-16 w-16 rounded-full border-2 border-purple-500 object-cover mb-4"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Swing<span className="text-purple-500">str</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to view your students and videos
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl space-y-4"
        >
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-200 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              placeholder="••••••••"
            />
            {isSignUp && (
              <p className="text-xs text-gray-500 mt-1">
                At least 6 characters
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <span className="animate-pulse">Please wait...</span>
            ) : isSignUp ? (
              <>
                <UserPlus size={18} /> Create account
              </>
            ) : (
              <>
                <LogIn size={18} /> Sign in
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp((v) => !v)}
            className="w-full text-gray-400 hover:text-white text-sm py-2"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
