import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aiseellvgzhnufnhccus.supabase.co'; // replace this
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpc2VlbGx2Z3pobnVmbmhjY3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MjI0MDYsImV4cCI6MjA2OTM5ODQwNn0.7_uXU1Hwlqjnzgwcw1ozFXgfvUYj8JYrE2ZM-mJrwA4'; // replace this

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
