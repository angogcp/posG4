import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { Store, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const ok = await login(username, password);
    
    if (!ok) {
      setError('Invalid credentials. Please try again.');
      setLoading(false);
      return;
    }
    
    nav('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-success-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Main login card */}
        <div className="card p-6 sm:p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-3 sm:mb-4 shadow-xl">
              <Store className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent mb-2">
              Welcome Back
            </h1>
            <p className="text-neutral-600 font-medium text-sm sm:text-base">Sign in to your POS system</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 sm:p-4 mb-5 sm:mb-6 bg-danger-50 border border-danger-200 rounded-xl text-danger-800 animate-slide-down">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-danger-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input text-sm sm:text-base"
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10 sm:pr-12 text-sm sm:text-base"
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="btn btn-primary w-full btn-lg group py-2.5 sm:py-3"
            >
              {loading ? (
                <>
                  <div className="spinner w-4 h-4 sm:w-5 sm:h-5"></div>
                  <span className="text-sm sm:text-base">Signing in...</span>
                </>
              ) : (
                <>
                  <span className="text-sm sm:text-base">Sign In</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <p className="text-xs font-semibold text-neutral-600 mb-2">Demo Credentials:</p>
            <div className="space-y-1 text-xs text-neutral-500">
              <div className="flex justify-between">
                <span>Admin:</span>
                <span className="font-mono text-xs">admin / admin123</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-mono text-xs">cash / [ask admin]</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-neutral-500">
            © 2024 POS G4 Restaurant System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}