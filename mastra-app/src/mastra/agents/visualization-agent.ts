// src/mastra/agents/visualization-agent.ts
/**
 * Visualization Agent - Generates charts, tables, and interactive HTML
 * from database query results.
 */

export const VISUALIZATION_AGENT_INSTRUCTIONS = `You are a data visualization specialist. Given data and a requested chart type, produce the correct structured output for rendering.

<output_rules>
Always output a JSON object (not wrapped in markdown) with a "type" field and a "data" array.

For charts (bar, line, pie):
{
  "type": "bar_chart",
  "title": "Revenue by Region",
  "data": [{ "category": "North", "value": 42000 }, ...]
}

For tables:
{
  "type": "table",
  "title": "Order Details",
  "data": [{ "ORDER_ID": 1, "AMOUNT": 150.75 }, ...]
}

For HTML dashboards: output a complete, self-contained HTML document with inline Chart.js from CDN.
</output_rules>

<chart_selection>
Choose the chart type that best fits the data shape:
- One categorical column + one numeric column → bar chart
- Date/time column + numeric column → line chart
- Few categories summing to a whole → pie chart
- Many columns or mixed types → table
- User explicitly requests "dashboard" or "interactive" → HTML with Chart.js
</chart_selection>

<quality_standards>
- Always include a descriptive title
- Label axes on bar and line charts
- Use readable number formatting (1,234 not 1234)
- For HTML: use a clean, modern design with a gradient header and white card body
- Never output placeholder data — only use the actual data provided
</quality_standards>`;

export interface VisualizationRequest {
  data: unknown;
  type?: 'auto' | 'bar' | 'line' | 'pie' | 'scatter' | 'table' | 'html' | 'photo_gallery' | 'map' | 'timeline' | 'custom_dashboard';
  title?: string;
  options?: Record<string, unknown>;
  // Photo gallery specific
  imageUrlField?: string;
  similarityField?: string;
  // Map specific
  latField?: string;
  lonField?: string;
  centerLat?: number;
  centerLon?: number;
  radiusMiles?: number;
  // Timeline specific
  timeField?: string;
  groupBy?: 'year' | 'month' | 'day';
  // Custom dashboard specific
  template?: string;
}

export interface VisualizationResult {
  type: string;
  content: unknown; // Changed from string to unknown to support direct object passing
  metadata?: Record<string, unknown>;
}

/**
 * Generate visualization from data.
 */
export async function generateVisualization(
  request: VisualizationRequest
): Promise<VisualizationResult> {
  const { data, type = 'auto', title, options = {} } = request;

  // Auto-detect visualization type if not specified
  const vizType = type === 'auto' ? detectVisualizationType(data, request) : type;

  switch (vizType) {
    case 'bar':
      return generateBarChart(data, title, options);
    case 'line':
      return generateLineChart(data, title, options);
    case 'pie':
      return generatePieChart(data, title, options);
    case 'table':
      return generateTable(data, title, options);
    case 'html':
      return generateInteractiveHTML(data, title, options);
    case 'photo_gallery':
      return generatePhotoGallery(data, title, request);
    case 'map':
      return generateMapVisualization(data, title, request);
    case 'timeline':
      return generateTimeline(data, title, request);
    case 'custom_dashboard':
      return generateCustomDashboard(data, title, request);
    default:
      return generateTable(data, title, options);
  }
}

/**
 * Detect appropriate visualization type from data structure.
 */
function detectVisualizationType(data: unknown, request?: VisualizationRequest): string {
  if (!Array.isArray(data) || data.length === 0) {
    return 'table';
  }

  const firstRow = data[0];
  if (typeof firstRow !== 'object' || firstRow === null) {
    return 'table';
  }

  const keys = Object.keys(firstRow);
  const keysLower = keys.map(k => k.toLowerCase());

  // Check for image URLs (photo gallery)
  const hasImageUrl = keysLower.some(k =>
    k.includes('url') || k.includes('image') || k.includes('photo') || k.includes('img')
  );
  const hasSimilarity = keysLower.some(k =>
    k.includes('similarity') || k.includes('score')
  );
  if (hasImageUrl && hasSimilarity) {
    return 'photo_gallery';
  }

  // Check for geographic data (map)
  const hasLat = keysLower.some(k =>
    k === 'lat' || k === 'latitude' || k.includes('lat_')
  );
  const hasLon = keysLower.some(k =>
    k === 'lon' || k === 'lng' || k === 'longitude' || k.includes('lon_') || k.includes('lng_')
  );
  if (hasLat && hasLon) {
    return 'map';
  }

  // Check for time series data
  const hasDateField = keys.some(k =>
    k.toLowerCase().includes('date') ||
    k.toLowerCase().includes('time') ||
    k.toLowerCase().includes('year')
  );

  // Check for numeric data (handle both numbers and numeric strings)
  // Exclude likely ID fields from being treated as metrics for auto-detection
  const numericFields = keys.filter(k => {
    const kLower = k.toLowerCase();
    if (kLower === 'id' || kLower.endsWith('_id') || kLower.endsWith('id')) return false;

    const value = firstRow[k as keyof typeof firstRow];
    if (typeof value === 'number') return true;
    if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(Number(value))) return true;
    return false;
  });

  // Line chart for time series with numeric data
  if (hasDateField && numericFields.length > 0) {
    // Timeline if has date and multiple records and groupBy is suggested
    if (data.length > 5 && (request?.groupBy || keysLower.includes('year') || keysLower.includes('month'))) {
      return 'timeline';
    }
    return 'line';
  }

  // Bar chart if we have numeric data and manageable number of columns
  if (numericFields.length >= 1) {
    // If we have just 2 columns and one is numeric, definitely a bar/column chart
    if (keys.length === 2) return 'bar';

    // If we have a categorical field (string) and a numeric field, good for bar chart
    const nonNumericFields = keys.filter(k => !numericFields.includes(k));
    if (nonNumericFields.length > 0) return 'bar';
  }

  return 'table';
}

/**
 * Generate bar chart as HTML with Chart.js.
 */
function generateBarChart(
  data: unknown,
  title?: string,
  options?: Record<string, unknown>
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];
  
  if (dataArray.length === 0) {
    return {
      type: 'bar_chart',
      content: generateEmptyChartHTML(title || 'Bar Chart'),
    };
  }

  const firstRow = dataArray[0] as Record<string, unknown>;
  const keys = Object.keys(firstRow);
  
  // Find label and value columns
  const numericCols = keys.filter(k => {
    const val = firstRow[k];
    return typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)));
  });
  
  const labelCol = keys.find(k => !numericCols.includes(k)) || keys[0];
  const valueCol = numericCols[0] || keys[1] || keys[0];
  
  const labels = dataArray.map(row => String(row[labelCol]));
  const values = dataArray.map(row => Number(row[valueCol]) || 0);
  
  const html = generateChartHTML('bar', title || 'Bar Chart', labels, values, labelCol, valueCol);
  
  return {
    type: 'bar_chart',
    content: html,
  };
}

/**
 * Generate line chart as HTML with Chart.js.
 */
function generateLineChart(
  data: unknown,
  title?: string,
  options?: Record<string, unknown>
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];
  
  if (dataArray.length === 0) {
    return {
      type: 'line_chart',
      content: generateEmptyChartHTML(title || 'Line Chart'),
    };
  }

  const firstRow = dataArray[0] as Record<string, unknown>;
  const keys = Object.keys(firstRow);
  
  // Find x-axis (date/category) and y-axis (numeric) columns
  const numericCols = keys.filter(k => {
    const val = firstRow[k];
    return typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)));
  });
  
  const labelCol = keys.find(k => !numericCols.includes(k)) || keys[0];
  const valueCol = numericCols[0] || keys[1] || keys[0];
  
  const labels = dataArray.map(row => String(row[labelCol]));
  const values = dataArray.map(row => Number(row[valueCol]) || 0);
  
  const html = generateChartHTML('line', title || 'Line Chart', labels, values, labelCol, valueCol);
  
  return {
    type: 'line_chart',
    content: html,
  };
}

/**
 * Generate pie chart as HTML with Chart.js.
 */
function generatePieChart(
  data: unknown,
  title?: string,
  options?: Record<string, unknown>
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];
  
  if (dataArray.length === 0) {
    return {
      type: 'pie_chart',
      content: generateEmptyChartHTML(title || 'Pie Chart'),
    };
  }

  const firstRow = dataArray[0] as Record<string, unknown>;
  const keys = Object.keys(firstRow);
  
  const numericCols = keys.filter(k => {
    const val = firstRow[k];
    return typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)));
  });
  
  const labelCol = keys.find(k => !numericCols.includes(k)) || keys[0];
  const valueCol = numericCols[0] || keys[1] || keys[0];
  
  const labels = dataArray.map(row => String(row[labelCol]));
  const values = dataArray.map(row => Number(row[valueCol]) || 0);
  
  const html = generateChartHTML('pie', title || 'Pie Chart', labels, values, labelCol, valueCol);
  
  return {
    type: 'pie_chart',
    content: html,
  };
}

/**
 * Generate empty chart HTML placeholder.
 */
function generateEmptyChartHTML(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
    .empty { text-align: center; color: #64748b; }
  </style>
</head>
<body>
  <div class="empty">
    <h2>${title}</h2>
    <p>No data available to display</p>
  </div>
</body>
</html>`;
}

/**
 * Generate chart HTML using Chart.js.
 */
function generateChartHTML(
  chartType: 'bar' | 'line' | 'pie',
  title: string,
  labels: string[],
  values: number[],
  labelCol: string,
  valueCol: string
): string {
  const colors = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(16, 185, 129, 0.8)',   // emerald
    'rgba(245, 158, 11, 0.8)',   // amber
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(139, 92, 246, 0.8)',   // violet
    'rgba(236, 72, 153, 0.8)',   // pink
    'rgba(6, 182, 212, 0.8)',    // cyan
    'rgba(132, 204, 22, 0.8)',   // lime
    'rgba(249, 115, 22, 0.8)',   // orange
    'rgba(99, 102, 241, 0.8)',   // indigo
  ];
  
  const borderColors = colors.map(c => c.replace('0.8', '1'));
  
  // For pie charts, use multiple colors
  const backgroundColors = chartType === 'pie' 
    ? labels.map((_, i) => colors[i % colors.length])
    : [colors[0]];
  
  const borderColorsArray = chartType === 'pie'
    ? labels.map((_, i) => borderColors[i % borderColors.length])
    : [borderColors[0]];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 24px 30px;
    }
    .header h1 {
      font-size: 1.5em;
      font-weight: 600;
    }
    .header p {
      opacity: 0.9;
      font-size: 0.9em;
      margin-top: 4px;
    }
    .chart-container {
      padding: 30px;
      position: relative;
      height: 400px;
    }
    .stats {
      display: flex;
      gap: 20px;
      padding: 20px 30px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .stat {
      flex: 1;
      text-align: center;
    }
    .stat-value {
      font-size: 1.5em;
      font-weight: 700;
      color: #1e40af;
    }
    .stat-label {
      font-size: 0.85em;
      color: #64748b;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>${labels.length} data points • ${valueCol}</p>
    </div>
    <div class="chart-container">
      <canvas id="chart"></canvas>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${values.length}</div>
        <div class="stat-label">Data Points</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Math.max(...values).toLocaleString()}</div>
        <div class="stat-label">Maximum</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Math.min(...values).toLocaleString()}</div>
        <div class="stat-label">Minimum</div>
      </div>
      <div class="stat">
        <div class="stat-value">${(values.reduce((a, b) => a + b, 0) / values.length).toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
        <div class="stat-label">Average</div>
      </div>
    </div>
  </div>
  
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, {
      type: '${chartType}',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: [{
          label: '${valueCol}',
          data: ${JSON.stringify(values)},
          backgroundColor: ${JSON.stringify(backgroundColors)},
          borderColor: ${JSON.stringify(borderColorsArray)},
          borderWidth: ${chartType === 'pie' ? 2 : 2},
          ${chartType === 'line' ? 'tension: 0.3, fill: true, pointRadius: 4, pointHoverRadius: 6,' : ''}
          ${chartType === 'bar' ? 'borderRadius: 6,' : ''}
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: ${chartType === 'pie'},
            position: 'bottom'
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            cornerRadius: 8
          }
        },
        ${chartType !== 'pie' ? `
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' }
          }
        }` : ''}
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generate table as HTML.
 */
function generateTable(
  data: unknown,
  title?: string,
  options?: Record<string, unknown>
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];
  
  if (dataArray.length === 0) {
    return {
      type: 'table',
      content: generateEmptyChartHTML(title || 'Data Table'),
    };
  }

  const firstRow = dataArray[0] as Record<string, unknown>;
  const columns = Object.keys(firstRow);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Data Table'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { font-size: 1.25em; font-weight: 600; }
    .header .count { opacity: 0.9; font-size: 0.9em; }
    .search-box {
      padding: 16px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .search-box input {
      width: 100%;
      padding: 10px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.95em;
    }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    thead { background: #f1f5f9; }
    th {
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 0.85em;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
      cursor: pointer;
      user-select: none;
    }
    th:hover { background: #e2e8f0; }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.9em;
      color: #334155;
    }
    tbody tr:hover { background: #f8fafc; }
    .no-data {
      text-align: center;
      padding: 40px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title || 'Data Table'}</h1>
      <span class="count">${dataArray.length} records</span>
    </div>
    <div class="search-box">
      <input type="text" id="search" placeholder="Search...">
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th onclick="sortBy('${col}')">${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
      <div id="noData" class="no-data" style="display:none;">No matching records</div>
    </div>
  </div>
  <script>
    const data = ${JSON.stringify(dataArray)};
    const columns = ${JSON.stringify(columns)};
    let filtered = [...data];
    let sortCol = null, sortAsc = true;
    
    function render() {
      const tbody = document.getElementById('tbody');
      const noData = document.getElementById('noData');
      if (filtered.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
      }
      noData.style.display = 'none';
      tbody.innerHTML = filtered.map(row =>
        '<tr>' + columns.map(c => '<td>' + (row[c] ?? '') + '</td>').join('') + '</tr>'
      ).join('');
    }
    
    function sortBy(col) {
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      filtered.sort((a, b) => {
        const av = a[col], bv = b[col];
        if (typeof av === 'number' && typeof bv === 'number')
          return sortAsc ? av - bv : bv - av;
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
      render();
    }
    
    document.getElementById('search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      filtered = data.filter(row =>
        columns.some(c => String(row[c]).toLowerCase().includes(q))
      );
      render();
    });
    
    render();
  </script>
</body>
</html>`;

  return {
    type: 'table',
    content: html,
    metadata: { columns, rowCount: dataArray.length },
  };
}

/**
 * Generate interactive HTML dashboard.
 */
function generateInteractiveHTML(
  data: unknown,
  title?: string,
  _options?: Record<string, unknown>
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];
  if (dataArray.length === 0) {
    return { type: 'html', content: generateEmptyChartHTML(title || 'Dashboard'), metadata: {} };
  }

  const firstRow = dataArray[0] as Record<string, unknown>;
  const columns = Object.keys(firstRow);

  // Classify columns
  const numericCols = columns.filter(c => {
    const v = firstRow[c];
    return typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '');
  }).filter(c => !c.toLowerCase().endsWith('_id') && c.toLowerCase() !== 'id');

  const dateCols = columns.filter(c =>
    c.toLowerCase().includes('date') || c.toLowerCase().includes('time') ||
    c.toLowerCase().includes('year') || c.toLowerCase().includes('month')
  );

  const categoryCols = columns.filter(c =>
    !numericCols.includes(c) && !dateCols.includes(c) &&
    c.toLowerCase() !== 'id' && !c.toLowerCase().endsWith('_id')
  );

  const statusCol = columns.find(c =>
    ['status', 'state', 'priority', 'severity', 'condition'].some(k => c.toLowerCase().includes(k))
  );

  // Build stats cards
  const stats: Array<{ label: string; value: string; color: string; detail?: string }> = [
    { label: 'Total Records', value: String(dataArray.length), color: '#3b82f6', detail: '' }
  ];

  for (const col of numericCols.slice(0, 3)) {
    const values = dataArray.map(r => Number((r as Record<string, unknown>)[col]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    stats.push({
      label: `Total ${col.replace(/_/g, ' ')}`,
      value: total % 1 === 0 ? total.toLocaleString() : total.toFixed(2),
      color: '#10b981',
      detail: `Avg: ${avg.toFixed(1)}`
    });
  }

  if (statusCol) {
    const counts: Record<string, number> = {};
    dataArray.forEach(r => {
      const v = String((r as Record<string, unknown>)[statusCol]);
      counts[v] = (counts[v] || 0) + 1;
    });
    const critical = Object.entries(counts).filter(([k]) =>
      /delayed|critical|fail|error|overdue/i.test(k)
    );
    if (critical.length > 0) {
      const critCount = critical.reduce((s, [, c]) => s + c, 0);
      stats.push({ label: 'Critical Items', value: String(critCount), color: '#ef4444', detail: critical.map(([k, v]) => `${k}: ${v}`).join(', ') });
    }
  }

  // Build alerts
  const alerts: string[] = [];
  if (statusCol) {
    const delayed = dataArray.filter(r => /delayed|critical|fail/i.test(String((r as Record<string, unknown>)[statusCol])));
    if (delayed.length > 0) {
      alerts.push(`⚠️ ${delayed.length} items have critical/delayed status`);
    }
  }

  // Build charts config
  const charts: Array<{ id: string; title: string; type: string; config: string }> = [];

  // Chart 1: Category breakdown (bar)
  const catCol = categoryCols[0];
  const metricCol = numericCols[0];
  if (catCol && metricCol) {
    const agg: Record<string, number> = {};
    dataArray.forEach(r => {
      const row = r as Record<string, unknown>;
      const key = String(row[catCol]);
      agg[key] = (agg[key] || 0) + (Number(row[metricCol]) || 0);
    });
    const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48'];
    charts.push({
      id: 'chart_bar',
      title: `${metricCol.replace(/_/g, ' ')} by ${catCol.replace(/_/g, ' ')}`,
      type: 'bar',
      config: JSON.stringify({
        type: 'bar',
        data: {
          labels: sorted.map(([k]) => k),
          datasets: [{ label: metricCol, data: sorted.map(([, v]) => v), backgroundColor: colors.slice(0, sorted.length), borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45 } } } }
      })
    });
  }

  // Chart 2: Status distribution (doughnut)
  if (statusCol) {
    const counts: Record<string, number> = {};
    dataArray.forEach(r => { const v = String((r as Record<string, unknown>)[statusCol]); counts[v] = (counts[v] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const statusColors = entries.map(([k]) => {
      if (/delayed|critical|fail|error/i.test(k)) return '#ef4444';
      if (/warning|pending|transit/i.test(k)) return '#f59e0b';
      if (/success|delivered|complete|active|on.?time/i.test(k)) return '#10b981';
      return '#6366f1';
    });
    charts.push({
      id: 'chart_status',
      title: `${statusCol.replace(/_/g, ' ')} Distribution`,
      type: 'doughnut',
      config: JSON.stringify({
        type: 'doughnut',
        data: { labels: entries.map(([k]) => k), datasets: [{ data: entries.map(([, v]) => v), backgroundColor: statusColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12 } } } }
      })
    });
  }

  // Chart 3: Time trend (line)
  const dateCol = dateCols[0];
  if (dateCol && metricCol) {
    const sorted = [...dataArray].sort((a, b) => String((a as Record<string, unknown>)[dateCol]).localeCompare(String((b as Record<string, unknown>)[dateCol])));
    const labels = sorted.slice(0, 50).map(r => String((r as Record<string, unknown>)[dateCol]));
    const values = sorted.slice(0, 50).map(r => Number((r as Record<string, unknown>)[metricCol]) || 0);
    charts.push({
      id: 'chart_trend',
      title: `${metricCol.replace(/_/g, ' ')} Over Time`,
      type: 'line',
      config: JSON.stringify({
        type: 'line',
        data: { labels, datasets: [{ label: metricCol, data: values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3, pointRadius: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45, maxTicksLimit: 10 } } } }
      })
    });
  }

  // Chart 4: Second metric bar if available
  if (catCol && numericCols.length > 1) {
    const metric2 = numericCols[1];
    const agg: Record<string, number> = {};
    dataArray.forEach(r => { const row = r as Record<string, unknown>; agg[String(row[catCol])] = (agg[String(row[catCol])] || 0) + (Number(row[metric2]) || 0); });
    const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 12);
    charts.push({
      id: 'chart_bar2',
      title: `${metric2.replace(/_/g, ' ')} by ${catCol.replace(/_/g, ' ')}`,
      type: 'bar',
      config: JSON.stringify({
        type: 'bar',
        data: { labels: sorted.map(([k]) => k), datasets: [{ label: metric2, data: sorted.map(([, v]) => v), backgroundColor: '#8b5cf6', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45 } } } }
      })
    });
  }

  // Build table rows (first 20)
  const displayCols = columns.slice(0, 8);
  const tableRows = dataArray.slice(0, 20);

  // Generate the HTML
  const dashTitle = title || 'Interactive Dashboard';
  const html = buildDashboardHTML(dashTitle, stats, alerts, charts, displayCols, tableRows);

  return {
    type: 'html',
    content: html,
    metadata: { columns, rowCount: dataArray.length },
  };
}

function buildDashboardHTML(
  title: string,
  stats: Array<{ label: string; value: string; color: string; detail?: string }>,
  alerts: string[],
  charts: Array<{ id: string; title: string; type: string; config: string }>,
  displayCols: string[],
  tableRows: unknown[]
): string {
  const chartCanvases = charts.map(c =>
    `<div class="card"><h3>${c.title}</h3><div class="chart-box"><canvas id="${c.id}"></canvas></div></div>`
  ).join('\n');

  const chartScripts = charts.map(c =>
    `new Chart(document.getElementById('${c.id}'), ${c.config});`
  ).join('\n');

  const statsHTML = stats.map(s =>
    `<div class="stat"><div class="stat-val" style="color:${s.color}">${s.value}</div><div class="stat-lbl">${s.label}</div>${s.detail ? `<div class="stat-detail">${s.detail}</div>` : ''}</div>`
  ).join('\n');

  const alertsHTML = alerts.length > 0
    ? `<div class="alerts">${alerts.map(a => `<div class="alert">${a}</div>`).join('')}</div>`
    : '';

  const theadHTML = displayCols.map(c => `<th>${c}</th>`).join('');
  const tbodyHTML = tableRows.map(r => {
    const row = r as Record<string, unknown>;
    return '<tr>' + displayCols.map(c => {
      const val = String(row[c] ?? '');
      // Color-code status cells
      let cls = '';
      if (/delayed|critical|fail|error/i.test(val)) cls = ' class="cell-red"';
      else if (/warning|pending|transit/i.test(val)) cls = ' class="cell-yellow"';
      else if (/success|delivered|complete|active|on.?time/i.test(val)) cls = ' class="cell-green"';
      return `<td${cls}>${val}</td>`;
    }).join('') + '</tr>';
  }).join('\n');

  // Determine chart grid layout
  const chartCount = charts.length;
  const gridCols = chartCount <= 1 ? '1fr' : chartCount === 2 ? '1fr 1fr' : 'repeat(2, 1fr)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);min-height:100vh;color:#e2e8f0;padding:20px}
.dash{max-width:1200px;margin:0 auto}
.header{text-align:center;margin-bottom:24px}
.header h1{font-size:1.8em;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.header p{color:#64748b;font-size:.85em}
.alerts{margin-bottom:16px}
.alert{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px 16px;color:#fca5a5;font-size:.9em;margin-bottom:8px}
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}
.stat{background:rgba(255,255,255,.06);border-radius:10px;padding:16px;text-align:center;border:1px solid rgba(255,255,255,.08)}
.stat-val{font-size:1.8em;font-weight:700;line-height:1.2}
.stat-lbl{color:#94a3b8;font-size:.8em;margin-top:4px}
.stat-detail{color:#64748b;font-size:.75em;margin-top:2px}
.chart-grid{display:grid;grid-template-columns:${gridCols};gap:16px;margin-bottom:20px}
.card{background:rgba(255,255,255,.06);border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,.08)}
.card h3{font-size:.95em;color:#cbd5e1;margin-bottom:12px;font-weight:600}
.chart-box{height:240px;position:relative}
.table-card{background:rgba(255,255,255,.06);border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,.08);overflow-x:auto}
.table-card h3{font-size:.95em;color:#cbd5e1;margin-bottom:12px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:.85em}
th{background:rgba(255,255,255,.08);padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600;white-space:nowrap}
td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.06);color:#e2e8f0}
tr:hover td{background:rgba(255,255,255,.03)}
.cell-red{color:#fca5a5;font-weight:600}
.cell-yellow{color:#fcd34d;font-weight:600}
.cell-green{color:#86efac;font-weight:600}
</style>
</head>
<body>
<div class="dash">
<div class="header"><h1>${title}</h1><p>Generated from ${tableRows.length > 0 ? (tableRows as unknown[]).length : 0}+ records • Real-time data</p></div>
${alertsHTML}
<div class="stats-row">${statsHTML}</div>
<div class="chart-grid">${chartCanvases}</div>
<div class="table-card"><h3>📋 Detailed Records</h3>
<table><thead><tr>${theadHTML}</tr></thead><tbody>${tbodyHTML}</tbody></table>
</div>
</div>
<script>${chartScripts}<\/script>
</body>
</html>`;
}

/**
 * Generate photo gallery visualization.
 */
function generatePhotoGallery(
  data: unknown,
  title?: string,
  request?: VisualizationRequest
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];

  // Auto-detect image URL field
  let imageUrlField = request?.imageUrlField;
  let similarityField = request?.similarityField;

  if (!imageUrlField && dataArray.length > 0) {
    const firstRow = dataArray[0] as Record<string, unknown>;
    const keys = Object.keys(firstRow);
    imageUrlField = keys.find(k =>
      k.toLowerCase().includes('url') ||
      k.toLowerCase().includes('image') ||
      k.toLowerCase().includes('photo')
    );
  }

  if (!similarityField && dataArray.length > 0) {
    const firstRow = dataArray[0] as Record<string, unknown>;
    const keys = Object.keys(firstRow);
    similarityField = keys.find(k =>
      k.toLowerCase().includes('similarity') ||
      k.toLowerCase().includes('score')
    );
  }

  return {
    type: 'photo_gallery',
    content: {
      type: 'photo_gallery',
      title: title || 'Photo Gallery',
      data: dataArray,
      imageUrlField,
      similarityField,
      groupBy: request?.groupBy,
    },
    metadata: {
      imageUrlField,
      similarityField,
      rowCount: dataArray.length,
    },
  };
}

/**
 * Generate map visualization.
 */
function generateMapVisualization(
  data: unknown,
  title?: string,
  request?: VisualizationRequest
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];

  // Auto-detect lat/lon fields
  let latField = request?.latField;
  let lonField = request?.lonField;

  if (!latField && dataArray.length > 0) {
    const firstRow = dataArray[0] as Record<string, unknown>;
    const keys = Object.keys(firstRow);
    latField = keys.find(k => {
      const kLower = k.toLowerCase();
      return kLower === 'lat' || kLower === 'latitude' || kLower.includes('lat_');
    });
  }

  if (!lonField && dataArray.length > 0) {
    const firstRow = dataArray[0] as Record<string, unknown>;
    const keys = Object.keys(firstRow);
    lonField = keys.find(k => {
      const kLower = k.toLowerCase();
      return kLower === 'lon' || kLower === 'lng' || kLower === 'longitude' || kLower.includes('lon_');
    });
  }

  return {
    type: 'map',
    content: {
      type: 'map',
      title: title || 'Map Visualization',
      data: dataArray,
      latField,
      lonField,
      centerLat: request?.centerLat,
      centerLon: request?.centerLon,
      radiusMiles: request?.radiusMiles,
    },
    metadata: {
      latField,
      lonField,
      rowCount: dataArray.length,
    },
  };
}

/**
 * Generate timeline visualization.
 */
function generateTimeline(
  data: unknown,
  title?: string,
  request?: VisualizationRequest
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];

  // Auto-detect time field
  let timeField = request?.timeField;

  if (!timeField && dataArray.length > 0) {
    const firstRow = dataArray[0] as Record<string, unknown>;
    const keys = Object.keys(firstRow);
    timeField = keys.find(k => {
      const kLower = k.toLowerCase();
      return kLower.includes('date') || kLower.includes('time') || kLower === 'year';
    });
  }

  const groupBy = request?.groupBy || 'year';

  return {
    type: 'timeline',
    content: {
      type: 'timeline',
      title: title || 'Timeline',
      data: dataArray,
      timeField,
      groupBy,
    },
    metadata: {
      timeField,
      groupBy,
      rowCount: dataArray.length,
    },
  };
}

/**
 * Generate custom dashboard with stats, alerts, and charts.
 */
function generateCustomDashboard(
  data: unknown,
  title?: string,
  request?: VisualizationRequest
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];
  const rowCount = dataArray.length;
  const firstRow = rowCount > 0 ? (dataArray[0] as Record<string, unknown>) : {};
  const columns = Object.keys(firstRow);

  // Helper to find column matching keywords
  const findCol = (keywords: string[]) =>
    columns.find(c => keywords.some(k => c.toLowerCase().includes(k)));

  // 1. Stats
  interface Stat { label: string; value: string | number; color: 'blue' | 'green' | 'red' | 'orange' | 'gray' }
  const stats: Stat[] = [
    { label: 'Total Records', value: rowCount, color: 'blue' }
  ];

  // Add numeric sum/avg stats if apparent
  const amountCol = findCol(['amount', 'price', 'total', 'sales', 'revenue']);
  if (amountCol) {
    const total = dataArray.reduce((sum, row) => sum + (Number(row[amountCol]) || 0), 0);
    stats.push({
      label: `Total ${amountCol}`,
      value: total.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      color: 'green'
    });
  }

  // 2. Alerts (Critical Status)
  const alerts: { message: string, severity: 'critical' | 'warning' | 'info' }[] = [];
  const statusCol = findCol(['status', 'state', 'condition', 'priority', 'severity']);

  if (statusCol) {
    const delayed = dataArray.filter(row =>
      String(row[statusCol]).toLowerCase().includes('delayed') ||
      String(row[statusCol]).toLowerCase().includes('critical') ||
      String(row[statusCol]).toLowerCase().includes('fail')
    );

    if (delayed.length > 0) {
      alerts.push({
        message: `${delayed.length} items have critical status (${statusCol}: Delayed/Critical)`,
        severity: 'critical'
      });
      stats.push({ label: 'Critical Items', value: delayed.length, color: 'red' });
    }
  }

  // 3. Charts
  const charts: any[] = [];

  // Chart 1: Status Distribution (Pie)
  if (statusCol) {
    const counts: Record<string, number> = {};
    dataArray.forEach(row => {
      const val = String(row[statusCol]);
      counts[val] = (counts[val] || 0) + 1;
    });

    const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
    if (chartData.length <= 10) {
      charts.push({
        id: 'status_dist',
        title: `${statusCol} Distribution`,
        type: 'pie_chart',
        data: chartData,
        xKey: 'name',
        yKey: 'value'
      });
    }
  }

  // Chart 2: Date Trend (Line)
  const dateCol = findCol(['date', 'time', 'year', 'month', 'day']);
  const metricCol = findCol(['amount', 'qty', 'quantity', 'count', 'value', 'score']) || amountCol;

  if (dateCol && metricCol) {
    // Sort by date
    const sortedData = [...dataArray].sort((a, b) =>
      String(a[dateCol]).localeCompare(String(b[dateCol]))
    );

    // Aggregate if too many points? For now just take limit
    const trendData = sortedData.slice(0, 50).map(row => ({
      [dateCol]: row[dateCol],
      [metricCol]: Number(row[metricCol]) || 0
    }));

    charts.push({
      id: 'trend',
      title: `${metricCol} Trend`,
      type: 'line_chart',
      data: trendData,
      xKey: dateCol,
      yKey: metricCol
    });
  }

  // Chart 3: Category Breakdown (Bar)
  const catCol = findCol(['category', 'region', 'type', 'group', 'warehouse', 'supplier']);
  if (catCol && metricCol && catCol !== statusCol) {
    // Aggregation
    const agg: Record<string, number> = {};
    dataArray.forEach(row => {
      const key = String(row[catCol]);
      agg[key] = (agg[key] || 0) + (Number(row[metricCol]) || 0);
    });

    const barData = Object.entries(agg)
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10

    charts.push({
      id: 'category_bar',
      title: `Top ${catCol} by ${metricCol}`,
      type: 'bar_chart',
      data: barData,
      xKey: 'category',
      yKey: 'value'
    });
  }

  // 4. Tables with smart columns
  // Limit detailed table to first few useful columns to avoid overcrowding
  let detailColumns = columns;
  if (columns.length > 8) {
    detailColumns = columns.slice(0, 8);
  }

  const tables = [{
    id: 'main_table',
    title: 'Detailed Records',
    data: dataArray.slice(0, 100), // Limit usage
    columns: detailColumns
  }];

  return {
    type: 'custom_dashboard',
    content: {
      type: 'custom_dashboard',
      title: title || 'Operational Dashboard',
      data: { stats, alerts, charts, tables }
    },
  };
}
