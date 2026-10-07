import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let scriptLoadingPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

/**
 * Renders Google's official sign-in button. On success, calls onCredential(idToken).
 * mode/extra are just passed straight back to the caller so it knows how to call the API.
 */
export default function GoogleAuthButton({ onCredential, text = 'continue_with' }) {
  const btnRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        });
        if (btnRef.current) {
          window.google.accounts.id.renderButton(btnRef.current, {
            theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
            size: 'large',
            width: Math.min(400, btnRef.current.parentElement?.offsetWidth || 360),
            text,
            shape: 'rectangular',
            logo_alignment: 'center',
          });
        }
        setReady(true);
      })
      .catch(() => toast.error('Could not load Google Sign-In'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return null; // Google Sign-In not configured — hide silently rather than show a broken button
  }

  return (
    <div className="flex w-full justify-center">
      <div ref={btnRef} style={{ display: ready ? 'block' : 'none' }} />
      {!ready && <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />}
    </div>
  );
}
