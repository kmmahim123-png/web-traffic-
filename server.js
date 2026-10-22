const express = require('express');
const cors = require('cors');
const path = require('path');
const { analyzeDomain, sanitizeDomain, BENCHMARK_DOMAINS } = require('./services/trafficEngine');
const { queryAhrefsRpc, queryOfficialAhrefsApi } = require('./services/ahrefsProxy');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Autocomplete and suggestions endpoint
app.get('/api/suggest', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const popular = [
    'coca-cola.com', 'ahrefs.com', 'semrush.com', 'apple.com', 'github.com',
    'wikipedia.org', 'google.com', 'openai.com', 'amazon.com', 'microsoft.com',
    'reddit.com', 'youtube.com', 'netflix.com', 'spotify.com', 'kappa.vercel.app'
  ];

  if (!q) {
    return res.json({ suggestions: popular.slice(0, 6) });
  }

  const matches = popular.filter(d => d.includes(q));
  if (!matches.includes(q) && q.includes('.')) {
    matches.unshift(q);
  }
  res.json({ suggestions: matches.slice(0, 8) });
});

// Single Domain Traffic Check Endpoint (supports POST & GET)
const handleCheckTraffic = async (req, res) => {
  try {
    const rawTarget = req.body?.url || req.body?.domain || req.body?.target || req.query?.url || req.query?.domain || req.query?.target;
    const mode = req.body?.mode || req.query?.mode || 'subdomains';
    const captchaToken = req.body?.captchaToken || req.query?.captchaToken || '';
    const apiKey = req.body?.apiKey || req.query?.apiKey || '';
    const provider = req.body?.provider || req.query?.provider || 'auto';
    
    if (!rawTarget) {
      return res.status(400).json({ success: false, error: 'Target URL or domain is required.' });
    }

    const cleanDomain = sanitizeDomain(rawTarget);
    if (!cleanDomain) {
      return res.status(400).json({ success: false, error: 'Invalid domain format.' });
    }

    // 1. If Official API Key is provided
    if (apiKey && (provider === 'ahrefs_api' || provider === 'auto')) {
      const apiResult = await queryOfficialAhrefsApi(cleanDomain, apiKey, mode);
      if (apiResult.success) {
        return res.json({
          success: true,
          source: 'official_api',
          data: apiResult.data
        });
      }
    }

    // 2. If Reverse-Engineered RPC is explicitly requested with Turnstile Captcha
    if (captchaToken && (provider === 'ahrefs_rpc' || provider === 'auto')) {
      const rpcResult = await queryAhrefsRpc(rawTarget, mode, captchaToken);
      if (rpcResult.success) {
        return res.json({
          success: true,
          source: 'origin_rpc',
          data: rpcResult.data
        });
      }
    }

    // 3. km.mahim High-Precision Web Traffic Intelligence Engine (Default / Fallback)
    const trafficData = await analyzeDomain(rawTarget, mode);
    
    res.json({
      success: true,
      source: 'km_mahim_intelligence',
      data: trafficData
    });
  } catch (err) {
    console.error('Error checking traffic:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
};

app.post('/api/check-traffic', handleCheckTraffic);
app.get('/api/check-traffic', handleCheckTraffic);

// Competitor Comparison Endpoint
app.post('/api/compare', async (req, res) => {
  try {
    const { targets = [], mode = 'subdomains' } = req.body;
    if (!Array.isArray(targets) || targets.length < 2) {
      return res.status(400).json({ success: false, error: 'Provide at least two targets to compare.' });
    }

    const results = await Promise.all(
      targets.slice(0, 4).map(target => analyzeDomain(target, mode))
    );

    res.json({
      success: true,
      comparison: results
    });
  } catch (err) {
    console.error('Error comparing domains:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Batch Traffic Check Endpoint
app.post('/api/batch-check', async (req, res) => {
  try {
    const { domains = [], mode = 'subdomains' } = req.body;
    if (!Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ success: false, error: 'Please provide an array of domains.' });
    }

    const slice = domains.slice(0, 25);
    const results = await Promise.all(
      slice.map(async (d) => {
        try {
          const res = await analyzeDomain(d, mode);
          return {
            domain: res.domain,
            dr: res.dr,
            ur: res.ur,
            trafficMonthlyAvg: res.trafficMonthlyAvg,
            costMonthlyAvg: res.costMonthlyAvg,
            backlinks: res.backlinks,
            referringDomains: res.referringDomains,
            topCountry: res.topCountries && res.topCountries[0] ? res.topCountries[0].country.name : 'N/A'
          };
        } catch (e) {
          return { domain: d, error: e.message };
        }
      })
    );

    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    console.error('Batch check error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health & Info Endpoint
app.get('/api/status', (req, res) => {
  res.json({
    brand: 'km.mahim',
    service: 'Website Traffic Checker & SEO Intelligence',
    status: 'online',
    version: '2.0.0'
  });
});

// Fallback to index.html for SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 km.mahim Website Traffic Checker is LIVE!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
