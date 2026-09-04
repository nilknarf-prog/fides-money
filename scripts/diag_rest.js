const https = require('https');

const supabaseUrl = 'https://nhwarucfecoqcahcosga.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2FydWNmZWNvcWNhaGNvc2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTk0MDUsImV4cCI6MjA5NTQ3NTQwNX0.7PTvXgI5ea5WSS89MfHpn-ZSMsv3ztOC64Ogin6Y3qU';

function post(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      },
      timeout: 10000
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'apikey': anonKey,
        ...headers
      },
      timeout: 10000
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function main() {
  const auth = await post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    email: 'deyglisonfsouza@gmail.com',
    password: '110591Dey200@'
  }, { apikey: anonKey });
  
  const authJson = JSON.parse(auth.data);
  const token = authJson.access_token;

  for (const table of ['transactions', 'accounts', 'cards', 'goals', 'user_categories', 'profiles']) {
    try {
      const res = await get(`${supabaseUrl}/rest/v1/${table}?select=*`, {
        Authorization: `Bearer ${token}`
      });
      console.log(`Table ${table} -> Status: ${res.status}, Body: ${res.data}`);
    } catch (e) {
      console.error(`Table ${table} -> Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
