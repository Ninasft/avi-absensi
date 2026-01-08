import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Kita pakai auth manual
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper functions untuk database operations

// User Configs
export const getUserConfig = async (username) => {
  const { data, error } = await supabase
    .from('user_configs')
    .select('*')
    .eq('username', username)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
};

export const setUserConfig = async (username, password) => {
  const { data, error } = await supabase
    .from('user_configs')
    .upsert({ 
      username, 
      password,
      last_updated: Date.now()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Absensi Logs
export const getAbsensiLogs = async () => {
  const { data, error } = await supabase
    .from('absensi_logs')
    .select('*')
    .order('timestamp', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const addAbsensiLog = async (logData) => {
  const { data, error } = await supabase
    .from('absensi_logs')
    .insert([logData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Settings (Announcement)
export const getAnnouncement = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'announcement')
    .single();
  
  if (error) throw error;
  return data?.value || { text: '', updatedBy: '', timestamp: 0 };
};

export const setAnnouncement = async (text, updatedBy) => {
  const { data, error } = await supabase
    .from('settings')
    .update({ 
      value: { text, updatedBy, timestamp: Date.now() },
      updated_at: new Date().toISOString()
    })
    .eq('key', 'announcement')
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Admin Logs
export const getAdminLogs = async () => {
  const { data, error } = await supabase
    .from('admin_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  return data;
};

export const addAdminLog = async (admin, aksi) => {
  const { data, error } = await supabase
    .from('admin_logs')
    .insert([{
      admin,
      aksi,
      waktu: new Date().toLocaleString('id-ID'),
      timestamp: Date.now()
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Realtime subscriptions
export const subscribeToAbsensiLogs = (callback) => {
  return supabase
    .channel('absensi_logs_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'absensi_logs' }, 
      callback
    )
    .subscribe();
};

export const subscribeToSettings = (callback) => {
  return supabase
    .channel('settings_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'settings' }, 
      callback
    )
    .subscribe();
};

export const subscribeToAdminLogs = (callback) => {
  return supabase
    .channel('admin_logs_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'admin_logs' }, 
      callback
    )
    .subscribe();
};