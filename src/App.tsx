import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import NotesDashboard from './components/NotesDashboard';
import type { User } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      {!session ? <Auth /> : <NotesDashboard user={session} />}
    </>
  );
}

export default App;
