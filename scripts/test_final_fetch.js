const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nhwarucfecoqcahcosga.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2FydWNmZWNvcWNhaGNvc2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTk0MDUsImV4cCI6MjA5NTQ3NTQwNX0.7PTvXgI5ea5WSS89MfHpn-ZSMsv3ztOC64Ogin6Y3qU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Login...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'deyglisonfsouza@gmail.com',
    password: '110591Dey200@',
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log('Logged in as:', authData.user.id);
  console.log('Fetching transactions...');
  const { data: txs, error: txError } = await supabase.from('transactions').select('*');
  console.log('Transactions count:', txs?.length, 'Error:', txError);

  console.log('Fetching accounts...');
  const { data: accts, error: acctError } = await supabase.from('accounts').select('*');
  console.log('Accounts count:', accts?.length, 'Error:', acctError);

  console.log('Fetching cards...');
  const { data: cards, error: cardError } = await supabase.from('cards').select('*');
  console.log('Cards count:', cards?.length, 'Error:', cardError);
}

run();
