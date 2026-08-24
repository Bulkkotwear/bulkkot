const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBndWJqbHVxZ3F2cnlidmVoemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTgwMjYsImV4cCI6MjEwMzEzNDAyNn0.W0en34qVo24Rsqi2S0P-JQ_6WF41WjIU8HKmGBzX1lA";

// Initialize Supabase Client
const supabaseInstance = (typeof window !== 'undefined' && window.supabase) 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

window.supabaseClient = supabaseInstance;

async function joinWaitlist(email) {
  if (!window.supabaseClient) return { success: false, error: 'Database not initialized' };
  
  const { data, error } = await window.supabaseClient
    .from('newsletter')
    .insert([{ email, source: 'homepage_waitlist' }]);
    
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getActiveProducts(category = null) {
  if (!window.supabaseClient) return [];
  
  let query = window.supabaseClient
    .from('products')
    .select('*')
    .eq('visibility', true)
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category.toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return data;
}
