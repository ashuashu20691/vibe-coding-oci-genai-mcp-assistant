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
  options?: Record<string, unknown>
): VisualizationResult {
  const dataArray = Array.isArray(data) ? data : [];
  const columns = dataArray.length > 0 && typeof dataArray[0] === 'object' && dataArray[0] !== null
    ? Object.keys(dataArray[0])
    : [];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Interactive Dashboard'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .filters {
      padding: 20px 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .filter-group label {
      font-size: 0.85em;
      font-weight: 600;
      color: #495057;
    }
    
    .filter-group input,
    .filter-group select {
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 6px;
      font-size: 0.95em;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
    }
    
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    
    .stat-card .value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }
    
    .stat-card .label {
      font-size: 0.9em;
      color: #6c757d;
    }
    
    .table-container {
      padding: 30px;
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }
    
    thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
    }
    
    th:hover {
      background: rgba(255,255,255,0.1);
    }
    
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #dee2e6;
    }
    
    tbody tr:hover {
      background: #f8f9fa;
    }
    
    .no-data {
      text-align: center;
      padding: 40px;
      color: #6c757d;
      font-size: 1.1em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title || 'Interactive Dashboard'}</h1>
      <p>Filter and explore your data</p>
    </div>
    
    <div class="filters">
      <div class="filter-group">
        <label>Search</label>
        <input type="text" id="searchInput" placeholder="Search all columns...">
      </div>
      ${columns.map(col => `
      <div class="filter-group">
        <label>${col}</label>
        <select id="filter_${col}">
          <option value="">All</option>
        </select>
      </div>
      `).join('')}
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="value" id="totalCount">0</div>
        <div class="label">Total Records</div>
      </div>
      <div class="stat-card">
        <div class="value" id="filteredCount">0</div>
        <div class="label">Filtered Records</div>
      </div>
    </div>
    
    <div class="table-container">
      <table id="dataTable">
        <thead>
          <tr>
            ${columns.map(col => `<th onclick="sortTable('${col}')">${col} ▼</th>`).join('')}
          </tr>
        </thead>
        <tbody id="tableBody">
        </tbody>
      </table>
      <div id="noData" class="no-data" style="display: none;">
        No data matches your filters
      </div>
    </div>
  </div>
  
  <script>
    const data = ${JSON.stringify(dataArray)};
    const columns = ${JSON.stringify(columns)};
    let filteredData = [...data];
    let sortColumn = null;
    let sortAsc = true;
    
    // Initialize
    function init() {
      populateFilters();
      renderTable();
      updateStats();
      
      document.getElementById('searchInput').addEventListener('input', applyFilters);
      columns.forEach(col => {
        document.getElementById('filter_' + col).addEventListener('change', applyFilters);
      });
    }
    
    // Populate filter dropdowns
    function populateFilters() {
      columns.forEach(col => {
        const select = document.getElementById('filter_' + col);
        const uniqueValues = [...new Set(data.map(row => row[col]))].sort();
        uniqueValues.forEach(val => {
          const option = document.createElement('option');
          option.value = val;
          option.textContent = val;
          select.appendChild(option);
        });
      });
    }
    
    // Apply filters
    function applyFilters() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      
      filteredData = data.filter(row => {
        // Search filter
        const matchesSearch = searchTerm === '' || 
          columns.some(col => String(row[col]).toLowerCase().includes(searchTerm));
        
        // Column filters
        const matchesFilters = columns.every(col => {
          const filterValue = document.getElementById('filter_' + col).value;
          return filterValue === '' || String(row[col]) === filterValue;
        });
        
        return matchesSearch && matchesFilters;
      });
      
      renderTable();
      updateStats();
    }
    
    // Sort table
    function sortTable(column) {
      if (sortColumn === column) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = column;
        sortAsc = true;
      }
      
      filteredData.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortAsc ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
      
      renderTable();
    }
    
    // Render table
    function renderTable() {
      const tbody = document.getElementById('tableBody');
      const noData = document.getElementById('noData');
      
      if (filteredData.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
      }
      
      noData.style.display = 'none';
      tbody.innerHTML = filteredData.map(row => 
        '<tr>' + columns.map(col => '<td>' + row[col] + '</td>').join('') + '</tr>'
      ).join('');
    }
    
    // Update statistics
    function updateStats() {
      document.getElementById('totalCount').textContent = data.length;
      document.getElementById('filteredCount').textContent = filteredData.length;
    }
    
    init();
  </script>
</body>
</html>`;

  return {
    type: 'html',
    content: html,
    metadata: {
      columns,
      rowCount: dataArray.length,
    },
  };
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
