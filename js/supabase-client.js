const SUPABASE_URL = "https://pgubjluqqqvrybvehzeh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBndWJqbHVxZ3F2cnlidmVoemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTgwMjYsImV4cCI6MjEwMzEzNDAyNn0.W0en34qVo24Rsqi2S0P-JQ_6WF41WjIU8HKmGBzX1lA";

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function joinWaitlist(email) {
  if (!supabase) return { success: false, error: 'Database not initialized' };
  
  const { data, error } = await supabase
    .from('newsletter')
    .insert([{ email, source: 'homepage_waitlist' }]);
    
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getActiveProducts(category = null) {
  if (!supabase) return [];
  
  let query = supabase
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
