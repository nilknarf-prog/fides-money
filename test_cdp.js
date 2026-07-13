const http = require('http');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  const pages = await getJson('http://127.0.0.1:9222/json/list');
  const page = pages.find(p => p.type === 'page' && p.webSocketDebuggerUrl);
  if (!page) { console.log('No page found'); process.exit(1); }

  const ws = new (require('ws'))(page.webSocketDebuggerUrl);
  ws.on('open', () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: 'Array.from(document.querySelectorAll("button")).map(b => b.textContent + " (" + b.className + ")").join("\\n")',
        returnByValue: true
      }
    }));
  });
  
  ws.on('message', (msg) => {
    const res = JSON.parse(msg);
    if (res.id === 1) {
      console.log('Buttons:');
      console.log(res.result?.result?.value);
      process.exit(0);
    }
  });
})();
