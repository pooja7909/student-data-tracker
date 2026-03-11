import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://akzfkofiephdhqkqsboc.supabase.co'
const supabaseKey = 'sb_publishable_nczB0oTnr8ZbB5-eTy3oHg_-QjvoMDk'

export const supabase = createClient(supabaseUrl, supabaseKey)