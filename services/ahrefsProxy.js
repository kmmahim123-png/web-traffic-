const https = require('https');

/**
 * Ahrefs Reverse-Engineered RPC client
 * Discovered via REA static JS / network analysis
 * Endpoint: https://ahrefs.com/v4/stGetFreeTrafficOverview
 */
async function queryAhrefsRpc(targetUrl, mode = 'subdomains', captchaToken = '') {
  return new Promise((resolve, reject) => {
    const input = {
      url: targetUrl,
      mode: mode === 'exact' ? 'exact' : 'subdomains',
      protocol: null,
      country: null,
      captcha: captchaToken || ''
    };

    const endpoint = `https://ahrefs.com/v4/stGetFreeTrafficOverview?input=${encodeURIComponent(JSON.stringify(input))}`;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://ahrefs.com/traffic-checker',
        'Origin': 'https://ahrefs.com'
      },
      timeout: 10000
    };

    const req = https.get(endpoint, options, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (Array.isArray(parsed) && parsed[0] === 'Ok') {
            resolve({ success: true, source: 'ahrefs_rpc', data: parsed[1] });
          } else if (Array.isArray(parsed) && parsed[0] === 'Error') {
            resolve({ success: false, error: parsed[1], raw: rawData });
          } else {
            resolve({ success: false, error: 'Unexpected response format', raw: rawData });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse JSON', raw: rawData });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timed out' });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Official Ahrefs API v3 Client
 * Endpoint: https://api.ahrefs.com/v3/site-explorer/metrics
 */
async function queryOfficialAhrefsApi(target, apiKey, mode = 'subdomains') {
  return new Promise((resolve) => {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://api.ahrefs.com/v3/site-explorer/metrics?target=${encodeURIComponent(target)}&mode=${mode}&date=${today}`;

    const options = {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    };

    const req = https.get(url, options, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, source: 'ahrefs_api', data: parsed });
          } else {
            resolve({ success: false, error: parsed.error || `HTTP ${res.statusCode}`, raw: rawData });
          }
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response', raw: rawData });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

module.exports = {
  queryAhrefsRpc,
  queryOfficialAhrefsApi
};
