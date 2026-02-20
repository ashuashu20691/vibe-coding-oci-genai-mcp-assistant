// src/app/api/supplier-analysis/route.ts
/**
 * Dedicated Supplier Analysis API
 * Runs comprehensive analysis and returns rich HTML dashboard
 */

import { NextRequest } from 'next/server';
import { runSupplierAnalysis, SupplierPerformanceResult } from '@/services/supplier-analysis';

/**
 * Generate rich HTML dashboard from analysis results
 */
function generateDashboardHTML(result: SupplierPerformanceResult): string {
  const { summary, topPerformers, bottomPerformers, regionalBreakdown, insights, recommendations } = result;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Supplier Delivery Performance Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%);
      min-height: 100vh;
      color: #fff;
      padding: 20px;
    }
    .dashboard {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 30px;
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      border-radius: 16px;
      backdrop-filter: blur(10px);
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header p { color: #94a3b8; font-size: 1.1em; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .stat-value {
      font-size: 2.5em;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .stat-value.blue { color: #00d4ff; }
    .stat-value.green { color: #10b981; }
    .stat-value.yellow { color: #f59e0b; }
    .stat-value.red { color: #ef4444; }
    .stat-label { color: #94a3b8; font-size: 0.9em; }
    
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card h2 {
      font-size: 1.3em;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card h2 .icon { font-size: 1.5em; }
    
    .performer-list { list-style: none; }
    .performer-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      margin-bottom: 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
    }
    .performer-name { font-weight: 500; }
    .performer-stats { display: flex; gap: 20px; align-items: center; }
    .performer-rate { font-weight: 700; }
    .grade {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .grade-a { background: #10b981; color: #fff; }
    .grade-b { background: #3b82f6; color: #fff; }
    .grade-c { background: #f59e0b; color: #000; }
    .grade-d { background: #ef4444; color: #fff; }
    
    .insights-list { list-style: none; }
    .insight-item {
      padding: 12px 16px;
      margin-bottom: 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      border-left: 4px solid #00d4ff;
    }
    .recommendation-item {
      padding: 12px 16px;
      margin-bottom: 8px;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 8px;
      border-left: 4px solid #10b981;
    }
    
    .chart-container {
      height: 300px;
      margin-top: 20px;
    }
    
    .regional-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .region-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .region-name { font-weight: 600; margin-bottom: 8px; }
    .region-rate { font-size: 2em; font-weight: 700; color: #00d4ff; }
    .region-count { color: #94a3b8; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>📊 Supplier Delivery Performance</h1>
      <p>Comprehensive analysis with trend insights and performance grades</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value blue">${summary.totalSuppliers}</div>
        <div class="stat-label">Total Suppliers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value green">${summary.totalDeliveries}</div>
        <div class="stat-label">Total Deliveries</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${summary.overallOnTimeRate >= 80 ? 'green' : 'yellow'}">${summary.overallOnTimeRate.toFixed(1)}%</div>
        <div class="stat-label">On-Time Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value blue">${summary.avgDeliveryDays.toFixed(1)}</div>
        <div class="stat-label">Avg Delivery Days</div>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="card">
        <h2><span class="icon">🏆</span> Top Performers</h2>
        <ul class="performer-list">
          ${topPerformers.map(p => `
            <li class="performer-item">
              <span class="performer-name">${p.supplierName}</span>
              <div class="performer-stats">
                <span class="performer-rate">${p.onTimeRate.toFixed(1)}%</span>
                <span class="grade grade-${p.grade.toLowerCase()}">${p.grade}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
      
      <div class="card">
        <h2><span class="icon">⚠️</span> Needs Improvement</h2>
        <ul class="performer-list">
          ${bottomPerformers.map(p => `
            <li class="performer-item">
              <span class="performer-name">${p.supplierName}</span>
              <div class="performer-stats">
                <span class="performer-rate">${p.onTimeRate.toFixed(1)}%</span>
                <span class="grade grade-${p.grade.toLowerCase()}">${p.grade}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: 30px;">
      <h2><span class="icon">🌍</span> Regional Performance</h2>
      <div class="regional-grid">
        ${regionalBreakdown.map(r => `
          <div class="region-card">
            <div class="region-name">${r.region}</div>
            <div class="region-rate">${r.onTimeRate.toFixed(1)}%</div>
            <div class="region-count">${r.supplierCount} suppliers</div>
          </div>
        `).join('')}
      </div>
      <div class="chart-container">
        <canvas id="regionalChart"></canvas>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="card">
        <h2><span class="icon">💡</span> Key Insights</h2>
        <ul class="insights-list">
          ${insights.map(i => `<li class="insight-item">${i}</li>`).join('')}
        </ul>
      </div>
      
      <div class="card">
        <h2><span class="icon">✅</span> Recommendations</h2>
        <ul class="insights-list">
          ${recommendations.map(r => `<li class="recommendation-item">${r}</li>`).join('')}
        </ul>
      </div>
    </div>
  </div>
  
  <script>
    // Regional Performance Chart
    const ctx = document.getElementById('regionalChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(regionalBreakdown.map(r => r.region))},
        datasets: [{
          label: 'On-Time Rate (%)',
          data: ${JSON.stringify(regionalBreakdown.map(r => r.onTimeRate))},
          backgroundColor: ${JSON.stringify(regionalBreakdown.map(r => 
            r.onTimeRate >= 80 ? 'rgba(16, 185, 129, 0.8)' : 
            r.onTimeRate >= 60 ? 'rgba(245, 158, 11, 0.8)' : 
            'rgba(239, 68, 68, 0.8)'
          ))},
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(255,255,255,0.1)' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionName } = body;

    const progressSteps: Array<{ step: string; detail: string }> = [];
    
    const result = await runSupplierAnalysis(connectionName, (step, detail) => {
      progressSteps.push({ step, detail });
    });

    const html = generateDashboardHTML(result);

    return new Response(JSON.stringify({
      success: true,
      result,
      html,
      progressSteps,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[supplier-analysis] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
