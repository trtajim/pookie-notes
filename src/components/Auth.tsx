import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Heart, Sparkles } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage('');
    
    // This will redirect to Google's sign in page
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: {
        redirectTo: window.location.origin // Comes back to localhost or your domain
      }
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="floating-decor decor-1">🎀</div>
      <div className="floating-decor decor-2">🍓</div>

      <div className="glass-panel" style={{ padding: '3rem', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--primary)', fontFamily: "'Fredoka', cursive", fontSize: '2.5rem' }}>
          <Heart color="var(--primary)" fill="var(--primary)" />
          Hello!
          <Sparkles color="var(--primary)" size={24} />
        </h2>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
          Welcome to Pookie Notes! Please sign in to join your shared room.
        </p>

        {message && (
          <div style={{ padding: '10px', background: 'rgba(255, 133, 162, 0.15)', borderRadius: '12px', marginBottom: '1.2rem', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {message}
          </div>
        )}

        <button 
          className="btn-primary" 
          onClick={handleGoogleLogin} 
          disabled={loading} 
          style={{ width: '100%', fontSize: '1.2rem', padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
        >
          {loading ? 'Redirecting...' : (
            <>
              {/* Simple Google SVG Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.79 15.71 17.57V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
                <path d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.71 17.57C14.73 18.23 13.48 18.63 12 18.63C9.14 18.63 6.71 16.7 5.84 14.09H2.18V16.94C4.01 20.58 7.71 23 12 23Z" fill="#34A853"/>
                <path d="M5.84 14.09C5.62 13.43 5.49 12.73 5.49 12C5.49 11.27 5.62 10.57 5.84 9.91V7.06H2.18C1.43 8.55 1 10.22 1 12C1 13.78 1.43 15.45 2.18 16.94L5.84 14.09Z" fill="#FBBC05"/>
                <path d="M12 5.38C13.62 5.38 15.06 5.94 16.21 7.03L19.36 3.88C17.45 2.1 14.97 1 12 1C7.71 1 4.01 3.42 2.18 7.06L5.84 9.91C6.71 7.3 9.14 5.38 12 5.38Z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}
