// State Management
let currentData = null;
let trafficChart = null;
let engineConfig = {
  provider: localStorage.getItem('km_engine_provider') || 'auto',
  apiKey: localStorage.getItem('km_api_key') || ''
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Set initial engine label
  updateEngineBadge();

  // Setup Autocomplete
  const inputEl = document.getElementById('target-input');
  const suggestionsBox = document.getElementById('suggestions-box');

  let debounceTimer;
  inputEl.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value.trim();
    if (!val) {
      suggestionsBox.classList.add('hidden');
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(val)}`);
        const json = await res.json();
        if (json.suggestions && json.suggestions.length > 0) {
          suggestionsBox.innerHTML = json.suggestions.map(s => `
            <div class="px-4 py-2 hover:bg-[#22263A] cursor-pointer flex items-center justify-between text-xs" onclick="selectSuggestion('${s}')">
              <span class="font-medium text-white">${s}</span>
              <span class="text-[#64748B]">suggestion</span>
            </div>
          `).join('');
          suggestionsBox.classList.remove('hidden');
        } else {
          suggestionsBox.classList.add('hidden');
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }, 200);
  });

  // Hide suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });

  // Perform initial search
  handleTrafficSubmit(new Event('submit'));
});

// Format numbers human-friendly (e.g. 11.2M, 340K, $1.5M, or 0)
function formatCompact(num) {
  if (num === null || num === undefined || num === 0) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

// Select an autocomplete suggestion
function selectSuggestion(domain) {
  const inputEl = document.getElementById('target-input');
  inputEl.value = domain;
  document.getElementById('suggestions-box').classList.add('hidden');
  handleTrafficSubmit(new Event('submit'));
}

// Quick Example click handler
function fillExample(domain) {
  const inputEl = document.getElementById('target-input');
  inputEl.value = domain;
  handleTrafficSubmit(new Event('submit'));
}

// Update Active Engine Badge in UI
function updateEngineBadge() {
  const badge = document.getElementById('active-engine-badge');
  if (engineConfig.provider === 'ahrefs_rpc') {
    badge.textContent = 'Engine: Direct Origin RPC';
  } else if (engineConfig.provider === 'ahrefs_api') {
    badge.textContent = 'Engine: Official API v3';
  } else {
    badge.textContent = 'Engine: km.mahim Index';
  }
}

// Main Traffic Form Submission
async function handleTrafficSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const inputEl = document.getElementById('target-input');
  const modeSelect = document.getElementById('mode-select');
  const target = inputEl.value.trim();

  if (!target) return;

  const btnText = document.getElementById('btn-text');
  const btnIcon = document.getElementById('btn-icon');
  const btnSpinner = document.getElementById('btn-spinner');
  const submitBtn = document.getElementById('submit-btn');

  // Loading state
  btnText.textContent = 'Analyzing...';
  btnIcon.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/check-traffic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: target,
        mode: modeSelect.value,
        apiKey: engineConfig.apiKey,
        provider: engineConfig.provider
      })
    });

    const result = await res.json();

    if (!result.success) {
      alert(`Error checking traffic: ${result.error || 'Unknown error'}`);
      return;
    }

    currentData = result.data;
    renderResults(result.data, target, modeSelect.value, result.source);

    // Smooth scroll to results
    const resultsWrapper = document.getElementById('results-wrapper');
    resultsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error('Fetch error:', err);
    alert('Failed to connect to km.mahim traffic check engine. Please check your connection.');
  } finally {
    btnText.textContent = 'Check traffic';
    btnIcon.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

// Render Results into UI
function renderResults(data, query, mode, source) {
  const resultsWrapper = document.getElementById('results-wrapper');
  resultsWrapper.classList.remove('hidden');

  // Title and subtitle
  document.getElementById('report-title').textContent = `Organic traffic of ${data.domain || query}`;
  document.getElementById('report-badge').textContent = mode === 'exact' ? 'Only specified URL' : 'Domain including subdomains';
  
  const sourceLabel = source === 'ahrefs_reverse_engineered_rpc' 
    ? 'Direct Origin RPC' 
    : source === 'ahrefs_official_api' 
    ? 'Official API' 
    : 'km.mahim Global Index';
  document.getElementById('report-source-label').textContent = `Source: ${sourceLabel}`;
  document.getElementById('report-timestamp').textContent = `Updated ${new Date().toLocaleDateString()}`;

  // Check unranked state
  const unrankedNotice = document.getElementById('unranked-notice');
  if (data.isUnranked || data.trafficMonthlyAvg === 0) {
    unrankedNotice.classList.remove('hidden');
  } else {
    unrankedNotice.classList.add('hidden');
  }

  // Primary Metrics
  document.getElementById('stat-traffic').textContent = formatCompact(data.trafficMonthlyAvg);
  document.getElementById('stat-value').textContent = '$' + formatCompact(data.costMonthlyAvg);
  
  // Rating Rings
  document.getElementById('stat-dr').textContent = data.dr || 0;
  document.getElementById('circle-dr').style.setProperty('--score', data.dr || 0);
  
  document.getElementById('stat-ur').textContent = data.ur || 0;
  document.getElementById('circle-ur').style.setProperty('--score', data.ur || 0);

  document.getElementById('stat-backlinks').textContent = formatCompact(data.backlinks);
  document.getElementById('stat-refdomains').textContent = formatCompact(data.referringDomains);

  // Render Traffic History Chart
  renderChart(data.trafficHistory || []);

  // Render Top Countries Table
  const countriesTbody = document.getElementById('countries-table-body');
  if (data.topCountries && data.topCountries.length > 0) {
    countriesTbody.innerHTML = data.topCountries.map(c => `
      <tr class="hover:bg-[#22263A] transition-colors">
        <td class="py-3 flex items-center gap-2.5">
          <img 
            src="https://flagcdn.com/w40/${c.country.code.toLowerCase()}.png" 
            alt="${c.country.name}" 
            class="flag-icon"
            onerror="this.style.display='none'"
          >
          <span class="font-medium text-white">${c.country.name}</span>
        </td>
        <td class="py-3 text-right">
          <div class="flex items-center justify-end gap-2">
            <div class="w-16 bg-[#141622] h-2 rounded-full overflow-hidden">
              <div class="bg-[#00D2FF] h-full rounded-full" style="width: ${c.share}%"></div>
            </div>
            <span class="font-bold text-white w-10 text-right">${c.share}%</span>
          </div>
        </td>
        <td class="py-3 text-right text-[#9BA3B8] font-mono">
          ${formatCompact(c.traffic)}
        </td>
      </tr>
    `).join('');
  } else {
    countriesTbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-[#64748B]">No organic traffic recorded for this target</td></tr>`;
  }

  // Render Top Keywords Table
  const keywordsTbody = document.getElementById('keywords-table-body');
  if (data.topKeywords && data.topKeywords.length > 0) {
    keywordsTbody.innerHTML = data.topKeywords.map(k => {
      let badgeClass = 'badge-pos-other';
      if (k.position === 1) badgeClass = 'badge-pos-1';
      else if (k.position === 2) badgeClass = 'badge-pos-2';
      else if (k.position === 3) badgeClass = 'badge-pos-3';

      return `
        <tr class="hover:bg-[#22263A] transition-colors">
          <td class="py-3 font-medium text-white">
            ${k.keyword}
          </td>
          <td class="py-3 text-center">
            <span class="px-2 py-0.5 rounded text-xs inline-block min-w-[24px] ${badgeClass}">
              #${k.position}
            </span>
          </td>
          <td class="py-3 text-right text-[#9BA3B8] font-mono">
            ${formatCompact(k.volume)}
          </td>
          <td class="py-3 text-right text-cyan-400 font-bold font-mono">
            ${formatCompact(k.traffic)}
          </td>
        </tr>
      `;
    }).join('');
  } else {
    keywordsTbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-[#64748B]">No organic search keywords ranked</td></tr>`;
  }

  // Render Top Pages Table
  const pagesTbody = document.getElementById('pages-table-body');
  if (data.topPages && data.topPages.length > 0) {
    pagesTbody.innerHTML = data.topPages.map(p => `
      <tr class="hover:bg-[#22263A] transition-colors">
        <td class="py-3 pr-4 max-w-xs sm:max-w-md truncate">
          <a href="${p.url}" target="_blank" rel="noopener" class="text-[#00D2FF] hover:text-[#5ce1ff] hover:underline flex items-center gap-1.5 truncate">
            <span class="truncate">${p.url}</span>
            <i data-lucide="external-link" class="w-3.5 h-3.5 flex-shrink-0 text-[#64748B]"></i>
          </a>
        </td>
        <td class="py-3 text-right font-bold text-white font-mono">
          ${formatCompact(p.traffic)}
        </td>
        <td class="py-3 text-right font-semibold text-[#9BA3B8]">
          ${p.share}%
        </td>
      </tr>
    `).join('');
  } else {
    pagesTbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-[#64748B]">No organic top pages found</td></tr>`;
  }

  // Re-run Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Render Interactive Area Chart using Chart.js
function renderChart(historyData) {
  const canvas = document.getElementById('traffic-history-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (trafficChart) {
    trafficChart.destroy();
  }

  const labels = historyData.map(d => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  const values = historyData.map(d => d.organic);

  // Gradient fill for km.mahim cyan theme
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(0, 210, 255, 0.40)');
  gradient.addColorStop(0.7, 'rgba(0, 210, 255, 0.06)');
  gradient.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

  trafficChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Monthly Organic Visits',
        data: values,
        borderColor: '#00D2FF',
        borderWidth: 2.5,
        pointBackgroundColor: '#00D2FF',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.5,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: gradient,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#181B2A',
          titleColor: '#FFFFFF',
          bodyColor: '#00D2FF',
          borderColor: '#282D42',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return ` ${formatCompact(context.parsed.y)} monthly visits`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748B',
            font: { size: 11 }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#64748B',
            font: { size: 11 },
            callback: function(val) {
              return formatCompact(val);
            }
          }
        }
      }
    }
  });
}

// Chart Range Filter
function setChartRange(months) {
  if (!currentData || !currentData.trafficHistory) return;

  const buttons = document.querySelectorAll('.chart-range-btn');
  buttons.forEach(b => {
    b.classList.remove('bg-[#00D2FF]', 'text-black');
    b.classList.add('text-[#9BA3B8]');
  });

  const eventTarget = window.event ? window.event.target : null;
  if (eventTarget) {
    eventTarget.classList.add('bg-[#00D2FF]', 'text-black');
    eventTarget.classList.remove('text-[#9BA3B8]');
  }

  let data = currentData.trafficHistory;
  if (months > 0) {
    data = data.slice(-months);
  }
  renderChart(data);
}

// Close report
function closeReport() {
  document.getElementById('results-wrapper').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle FAQ Accordion
function toggleFaq(btn) {
  const content = btn.nextElementSibling;
  const icon = btn.querySelector('[data-lucide="chevron-down"]');
  const isHidden = content.classList.contains('hidden');

  if (isHidden) {
    content.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
  } else {
    content.classList.add('hidden');
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
}

// EXPORTS
function exportToCSV() {
  if (!currentData) return;
  const d = currentData;
  let csv = 'Domain,Mode,DR,UR,Estimated Monthly Organic Traffic,Traffic Value USD,Backlinks,Referring Domains\n';
  csv += `"${d.domain}","${d.mode}",${d.dr},${d.ur},${d.trafficMonthlyAvg},${d.costMonthlyAvg},${d.backlinks},${d.referringDomains}\n\n`;

  csv += 'Top Countries,Share %,Traffic\n';
  (d.topCountries || []).forEach(c => {
    csv += `"${c.country.name}",${c.share},${c.traffic}\n`;
  });
  csv += '\n';

  csv += 'Top Keywords,Position,Volume,Traffic,CPC,KD\n';
  (d.topKeywords || []).forEach(k => {
    csv += `"${k.keyword}",${k.position},${k.volume},${k.traffic},${k.cpc},${k.kd}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `km-mahim-traffic-${d.domain}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function exportToJSON() {
  if (!currentData) return;
  const jsonStr = JSON.stringify(currentData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `km-mahim-traffic-${currentData.domain}.json`;
  a.click();
}

// COMPETITOR COMPARISON MODAL
function openCompareModal() {
  document.getElementById('compare-modal').classList.remove('hidden');
}

function closeCompareModal() {
  document.getElementById('compare-modal').classList.add('hidden');
}

function launchCompareFromCurrent() {
  if (currentData) {
    document.getElementById('cmp-domain-1').value = currentData.domain;
  }
  openCompareModal();
}

async function runComparison() {
  const d1 = document.getElementById('cmp-domain-1').value.trim();
  const d2 = document.getElementById('cmp-domain-2').value.trim();
  const d3 = document.getElementById('cmp-domain-3').value.trim();

  const targets = [d1, d2, d3].filter(Boolean);
  if (targets.length < 2) {
    alert('Please enter at least two domains to compare.');
    return;
  }

  const btn = document.getElementById('run-compare-btn');
  btn.disabled = true;
  btn.innerHTML = `Comparing...`;

  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets })
    });

    const result = await res.json();
    if (!result.success) {
      alert(result.error);
      return;
    }

    const container = document.getElementById('compare-results');
    container.classList.remove('hidden');

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border border-[#282D42] rounded overflow-hidden">
          <thead class="bg-[#141622] text-[#9BA3B8]">
            <tr>
              <th class="p-3">Metric</th>
              ${result.comparison.map(c => `<th class="p-3 font-bold text-white">${c.domain}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-[#202436]">
            <tr>
              <td class="p-3 font-medium text-[#9BA3B8]">Domain Rating (DR)</td>
              ${result.comparison.map(c => `<td class="p-3 font-extrabold text-[#00D2FF] text-sm">${c.dr}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-3 font-medium text-[#9BA3B8]">Monthly Organic Traffic</td>
              ${result.comparison.map(c => `<td class="p-3 font-extrabold text-white text-sm">${formatCompact(c.trafficMonthlyAvg)}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-3 font-medium text-[#9BA3B8]">Traffic Value (USD)</td>
              ${result.comparison.map(c => `<td class="p-3 font-bold text-emerald-400">$${formatCompact(c.costMonthlyAvg)}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-3 font-medium text-[#9BA3B8]">Backlinks</td>
              ${result.comparison.map(c => `<td class="p-3 font-mono">${formatCompact(c.backlinks)}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-3 font-medium text-[#9BA3B8]">Referring Domains</td>
              ${result.comparison.map(c => `<td class="p-3 font-mono">${formatCompact(c.referringDomains)}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    console.error(err);
    alert('Comparison failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Compare Traffic</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

// BATCH CHECKER MODAL
function openBatchModal() {
  document.getElementById('batch-modal').classList.remove('hidden');
}

function closeBatchModal() {
  document.getElementById('batch-modal').classList.add('hidden');
}

let lastBatchResults = [];

async function runBatchCheck() {
  const textarea = document.getElementById('batch-domains-input');
  const domains = textarea.value.split('\n').map(d => d.trim()).filter(Boolean);

  if (domains.length === 0) {
    alert('Please enter at least one domain.');
    return;
  }

  const btn = document.getElementById('run-batch-btn');
  btn.disabled = true;
  btn.innerHTML = `Evaluating ${domains.length} domains...`;

  try {
    const res = await fetch('/api/batch-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains })
    });

    const result = await res.json();
    if (!result.success) {
      alert(result.error);
      return;
    }

    lastBatchResults = result.data;
    document.getElementById('batch-results-container').classList.remove('hidden');
    document.getElementById('export-batch-btn').classList.remove('hidden');

    const tbody = document.getElementById('batch-table-body');
    tbody.innerHTML = result.data.map(item => `
      <tr class="hover:bg-[#22263A] transition-colors">
        <td class="p-2.5 font-bold text-white">${item.domain}</td>
        <td class="p-2.5 text-center font-bold text-[#00D2FF]">${item.dr || '0'}</td>
        <td class="p-2.5 text-right font-bold text-white font-mono">${formatCompact(item.trafficMonthlyAvg)}</td>
        <td class="p-2.5 text-right font-bold text-emerald-400 font-mono">$${formatCompact(item.costMonthlyAvg)}</td>
        <td class="p-2.5 text-right text-[#9BA3B8] font-mono">${formatCompact(item.backlinks)}</td>
        <td class="p-2.5 text-[#9BA3B8]">${item.topCountry || 'Global'}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error(err);
    alert('Batch check failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Run Batch Analysis</span> <i data-lucide="play" class="w-3.5 h-3.5"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

function exportBatchCSV() {
  if (!lastBatchResults || lastBatchResults.length === 0) return;
  let csv = 'Domain,DR,Traffic,Traffic Value USD,Backlinks,Top Country\n';
  lastBatchResults.forEach(r => {
    csv += `"${r.domain}",${r.dr},${r.trafficMonthlyAvg},${r.costMonthlyAvg},${r.backlinks},"${r.topCountry}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `km-mahim-batch-traffic-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ENGINE CONFIG MODAL
function openApiModal() {
  document.getElementById('engine-provider-select').value = engineConfig.provider;
  document.getElementById('user-api-key').value = engineConfig.apiKey;
  document.getElementById('api-modal').classList.remove('hidden');
}

function closeApiModal() {
  document.getElementById('api-modal').classList.add('hidden');
}

function saveEngineConfig() {
  const provider = document.getElementById('engine-provider-select').value;
  const apiKey = document.getElementById('user-api-key').value.trim();

  engineConfig.provider = provider;
  engineConfig.apiKey = apiKey;

  localStorage.setItem('km_engine_provider', provider);
  localStorage.setItem('km_api_key', apiKey);

  updateEngineBadge();
  closeApiModal();
  alert('km.mahim engine configuration updated!');
}
