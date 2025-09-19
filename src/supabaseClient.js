
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yuaxfumpezrhayjeyicp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YXhmdW1wZXpyaGF5amV5aWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NzQyNTgsImV4cCI6MjA3MTE1MDI1OH0.G_ee5GYQUbVOrjCdRP97Zpf74jAn7i5GHArpRe3D9Jo'

export const supabase = createClient(supabaseUrl, supabaseKey);


