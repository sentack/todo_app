import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyyfuzsuhkmlqqsjvnab.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eWZ1enN1aGttbHFxc2p2bmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MDg1MzUsImV4cCI6MjA3NDM4NDUzNX0.ZGsbmXFFlbwHwPmtYsxM0avqrnABUG0i2jAtlBPeMbE'

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/seed-friends.mjs <email> <password>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError || !authData?.user) {
  console.error('Auth failed:', authError?.message ?? 'no user returned')
  process.exit(1)
}
const userId = authData.user.id
console.log(`Signed in as ${authData.user.email} (${userId})`)

const [{ data: debts, error: e1 }, { data: lendings, error: e2 }] = await Promise.all([
  supabase.from('debts').select('person').eq('user_id', userId),
  supabase.from('lendings').select('person').eq('user_id', userId),
])
if (e1 || e2) {
  console.error('Fetch failed:', e1?.message ?? e2?.message)
  process.exit(1)
}

const allNames = new Set([
  ...(debts ?? []).map(d => d.person.trim()),
  ...(lendings ?? []).map(l => l.person.trim()),
].filter(Boolean))

console.log(`Found ${allNames.size} unique name(s) across debts and lendings:`, [...allNames].join(', ') || '(none)')

const { data: existing, error: e3 } = await supabase.from('friends').select('name').eq('user_id', userId)
if (e3) {
  console.error('Could not fetch existing friends:', e3.message)
  process.exit(1)
}
const existingSet = new Set((existing ?? []).map(f => f.name.trim()))
console.log(`${existingSet.size} friend(s) already exist`)

const toAdd = [...allNames].filter(n => !existingSet.has(n))

if (!toAdd.length) {
  console.log('All names are already in the friends list. Nothing to add.')
} else {
  console.log(`Adding ${toAdd.length} new friend(s): ${toAdd.join(', ')}`)
  const { error: insertErr } = await supabase
    .from('friends')
    .insert(toAdd.map(name => ({ user_id: userId, name })))
  if (insertErr) {
    console.error('Insert failed:', insertErr.message)
    process.exit(1)
  }
  console.log('Done! Friends added successfully.')
}

await supabase.auth.signOut()
