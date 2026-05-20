import React from 'react';
import { LogIn, LogOut } from 'lucide-react';

export default function GoogleAuthButton({ isSignedIn, userEmail, onSignIn, onSignOut }) {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 hidden sm:block">{userEmail}</span>
        <button
          onClick={onSignOut}
          title="Sign out of Google"
          aria-label="Sign out of Google"
          className="flex items-center gap-1 text-xs bg-gray-800 px-2 py-1.5 rounded-full hover:bg-gray-700 border border-gray-700 text-gray-300"
        >
          <LogOut size={12} />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onSignIn}
      title="Sign in with Google to access Drive videos"
      aria-label="Sign in with Google"
      className="flex items-center gap-1 text-xs bg-gray-800 px-2 py-1.5 rounded-full hover:bg-gray-700 border border-gray-700 text-gray-300"
    >
      <LogIn size={12} />
      <span>Google Drive</span>
    </button>
  );
}
