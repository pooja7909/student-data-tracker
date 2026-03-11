import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://akzfkofiephdhqkqsboc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFremZrb2ZpZXBoZGhxYnFzYm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzcyODQsImV4cCI6MjA4ODgxMzI4NH0.NS1ymMoc_1alhtHypGj_qir9fnUfSjTJmjvug0lzbr4'


export const supabase = createClient(supabaseUrl, supabaseKey)

