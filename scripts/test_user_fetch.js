const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nhwarucfecoqcahcosga.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2FydWNmZWNvcWNhaGNvc2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTk0MDUsImV4cCI6MjA5NTQ3NTQwNX0.7PTvXgI5ea5WSS89MfHpn-ZSMsv3ztOC64Ogin6Y3qU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Tentando login com deyglisonfsouza@gmail.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'deyglisonfsouza@gmail.com',
    password: '110591Dey200@',
  });

  if (authError) {
    console.error('Erro de autenticação:', authError.message);
    return;
  }

  const user = authData.user;
  console.log('Login bem sucedido! User ID:', user.id);

  const [txRes, acctRes, cardRes, goalRes, profRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', user.id),
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('cards').select('*').eq('user_id', user.id),
    supabase.from('goals').select('*').eq('user_id', user.id),
    supabase.from('profiles').select('*').eq('id', user.id),
  ]);

  console.log('Profiles:', profRes.data, 'Erro:', profRes.error?.message);
  console.log('Contas encontradas:', acctRes.data?.length, acctRes.data, 'Erro:', acctRes.error?.message);
  console.log('Cartões encontrados:', cardRes.data?.length, cardRes.data, 'Erro:', cardRes.error?.message);
  console.log('Metas encontradas:', goalRes.data?.length, goalRes.data, 'Erro:', goalRes.error?.message);
  console.log('Transações encontradas:', txRes.data?.length, 'Erro:', txRes.error?.message);
  if (txRes.data && txRes.data.length > 0) {
    console.log('Amostra de 3 transações:', txRes.data.slice(0, 3));
  }
}

run();
