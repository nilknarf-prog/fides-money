const fs = require('fs');

const raw = fs.readFileSync('supabase_logs.json', 'utf8');
const logs = JSON.parse(raw);

console.log('Total logs:', logs.length);

const types = {};
logs.forEach(l => { types[l.log_type] = (types[l.log_type] || 0) + 1; });
console.log('Log types:', types);

const postgrestLogs = logs.filter(l => l.log_type === 'postgrest' || (l.event_message && l.event_message.toLowerCase().includes('error')));
console.log('PostgREST or error logs count:', postgrestLogs.length);

postgrestLogs.slice(0, 20).forEach(l => {
  console.log('---');
  console.log('Type:', l.log_type, 'Level:', l.level, 'Status:', l.status);
  console.log('Message:', l.event_message);
  if (l.logs && l.logs.length) console.log('Nested logs:', l.logs);
  if (l.headers && Object.keys(l.headers).length) console.log('Headers:', l.headers);
});
