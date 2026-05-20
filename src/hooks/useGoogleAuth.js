import { useState, useEffect, useRef } from 'react';

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly openid email';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function useGoogleAuth() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) {
      console.warn('[auth] VITE_GOOGLE_CLIENT_ID is not set');
      return;
    }

    const init = () => {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            console.warn('[auth] token error', response.error);
            return;
          }
          setAccessToken(response.access_token);
          setIsSignedIn(true);
          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          })
            .then((r) => r.json())
            .then((info) => setUserEmail(info.email))
            .catch(() => {});
        },
      });
    };

    if (window.google?.accounts?.oauth2) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          init();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const signIn = () => {
    tokenClientRef.current?.requestAccessToken();
  };

  const signOut = () => {
    if (accessToken) {
      window.google?.accounts.oauth2.revoke(accessToken, () => {});
    }
    setAccessToken(null);
    setIsSignedIn(false);
    setUserEmail(null);
  };

  return { isSignedIn, userEmail, accessToken, signIn, signOut };
}
