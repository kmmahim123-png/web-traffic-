const http = require('http');

async function runTests() {
  const app = require('../server.js');
  const server = app.listen(3001);
  await new Promise(r => setTimeout(r, 600));

  function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      }, (res) => {
        let respData = '';
        res.on('data', chunk => respData += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, body: respData });
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  console.log('--- TEST 1: km.mahim Status ---');
  const rStatus = await request('GET', '/api/status');
  console.log('Status code:', rStatus.status);
  console.log('Status body:', rStatus.body);

  console.log('\n--- TEST 2: kappa.vercel.app Zero-Traffic Validation ---');
  const rKappa = await request('POST', '/api/check-traffic', { url: 'kappa.vercel.app', mode: 'exact' });
  const kappaData = JSON.parse(rKappa.body);
  console.log('Success:', kappaData.success);
  console.log('Traffic:', kappaData.data.trafficMonthlyAvg);
  console.log('Cost ($):', kappaData.data.costMonthlyAvg);
  console.log('isUnranked:', kappaData.data.isUnranked);
  if (kappaData.data.trafficMonthlyAvg !== 0) {
    throw new Error('Expected kappa.vercel.app to have 0 organic traffic');
  }

  console.log('\n--- TEST 3: ahrefs.com Real Value Validation ---');
  const rAhrefs = await request('POST', '/api/check-traffic', { url: 'ahrefs.com', mode: 'subdomains' });
  const ahrefsData = JSON.parse(rAhrefs.body);
  console.log('ahrefs.com traffic:', ahrefsData.data.trafficMonthlyAvg);
  console.log('ahrefs.com DR:', ahrefsData.data.dr);
  if (ahrefsData.data.trafficMonthlyAvg <= 0) {
    throw new Error('Expected ahrefs.com to have ranked traffic');
  }

  console.log('\n--- TEST 4: Batch Analysis ---');
  const rBatch = await request('POST', '/api/batch-check', { domains: ['kappa.vercel.app', 'ahrefs.com', 'coca-cola.com'] });
  const batchData = JSON.parse(rBatch.body);
  console.log('Batch results:', batchData.data.map(d => `${d.domain}: Traffic ${d.trafficMonthlyAvg}, DR ${d.dr}`));

  console.log('\n ALL TESTS PASSED SUCCESSFULLY!');
  server.close();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
