// __tests__/demo/multi-agent-demo.test.ts
/**
 * Demo test showing the Multi-Agent System in action.
 * This demonstrates the Claude-like intelligent data exploration.
 */

import { describe, it, expect } from 'vitest';
import { analyzeData } from '../../src/mastra/agents/data-analysis-agent';
import { generateVisualization } from '../../src/mastra/agents/visualization-agent';
import * as fs from 'fs';
import * as path from 'path';

// Sample orders data (simulating database query result from Claude example)
const ordersData = [
  { ORDER_ID: 1, CUSTOMER_ID: 101, ORDER_DATE: '15-01-23', TOTAL_AMOUNT: 150.75 },
  { ORDER_ID: 2, CUSTOMER_ID: 102, ORDER_DATE: '16-01-23', TOTAL_AMOUNT: 200 },
  { ORDER_ID: 3, CUSTOMER_ID: 101, ORDER_DATE: '17-01-23', TOTAL_AMOUNT: 50.25 },
  { ORDER_ID: 4, CUSTOMER_ID: 103, ORDER_DATE: '18-01-23', TOTAL_AMOUNT: 300.5 },
  { ORDER_ID: 5, CUSTOMER_ID: 102, ORDER_DATE: '19-01-23', TOTAL_AMOUNT: 75 },
];

describe('🚀 Multi-Agent System Demo', () => {
  it('should demonstrate full Claude-like workflow', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Multi-Agent System Demo');
    console.log('='.repeat(60));
    
    // Step 1: Show raw data
    console.log('\n📊 Raw Data (simulating database query result):');
    console.log('ORDER_ID | CUSTOMER_ID | ORDER_DATE | TOTAL_AMOUNT');
    console.log('-'.repeat(50));
    ordersData.forEach(row => {
      console.log(`${row.ORDER_ID.toString().padEnd(8)} | ${row.CUSTOMER_ID.toString().padEnd(11)} | ${row.ORDER_DATE.padEnd(10)} | $${row.TOTAL_AMOUNT}`);
    });
    
    // Step 2: Analyze the data
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Data Analysis Agent Output:');
    console.log('='.repeat(60));
    
    const analysis = analyzeData({
      data: ordersData,
      query: 'SELECT * FROM orders',
    });
    
    console.log('\n📈 Summary:', analysis.summary);
    
    const columnStats = analysis.statistics.columnStats as Record<string, { type: string; avg?: number; sum?: number; min?: number; max?: number }>;
    
    console.log('\n📊 Statistics:');
    console.log(`   - Total Orders: ${analysis.statistics.rowCount}`);
    console.log(`   - Total Revenue: $${columnStats.TOTAL_AMOUNT?.sum?.toFixed(2)}`);
    console.log(`   - Average Order Value: $${columnStats.TOTAL_AMOUNT?.avg?.toFixed(2)}`);
    console.log(`   - Min Order: $${columnStats.TOTAL_AMOUNT?.min?.toFixed(2)}`);
    console.log(`   - Max Order: $${columnStats.TOTAL_AMOUNT?.max?.toFixed(2)}`);
    
    console.log('\n💡 Insights:');
    analysis.insights.forEach((insight, i) => console.log(`   ${i + 1}. ${insight}`));
    
    console.log('\n📋 Recommendations:');
    analysis.recommendations.forEach((rec, i) => console.log(`   ${i + 1}. ${rec}`));
    
    console.log('\n📈 Suggested Visualizations:');
    analysis.suggestedVisualizations.forEach((viz, i) => console.log(`   ${i + 1}. ${viz}`));
    
    // Verify analysis
    expect(analysis.statistics.rowCount).toBe(5);
    expect(columnStats.TOTAL_AMOUNT?.sum).toBeCloseTo(776.5, 1);
    
    // Step 3: Generate visualizations
    console.log('\n' + '='.repeat(60));
    console.log('🎨 Visualization Agent Output:');
    console.log('='.repeat(60));
    
    // Table visualization
    const tableViz = await generateVisualization({
      data: ordersData,
      type: 'table',
      title: 'Orders Table',
    });
    console.log('\n✅ Generated Table Visualization');
    console.log(`   Type: ${tableViz.type}`);
    expect(tableViz.type).toBe('table');
    
    // Bar chart
    const barViz = await generateVisualization({
      data: ordersData,
      type: 'bar',
      title: 'Orders by Customer',
    });
    console.log('\n✅ Generated Bar Chart');
    console.log(`   Type: ${barViz.type}`);
    expect(barViz.type).toBe('bar_chart');
    
    // Interactive HTML Dashboard
    const htmlViz = await generateVisualization({
      data: ordersData,
      type: 'html',
      title: 'Orders Dashboard',
    });
    console.log('\n✅ Generated Interactive HTML Dashboard');
    console.log(`   Type: ${htmlViz.type}`);
    console.log(`   Columns: ${(htmlViz.metadata?.columns as string[])?.join(', ')}`);
    console.log(`   Row Count: ${htmlViz.metadata?.rowCount}`);
    expect(htmlViz.type).toBe('html');
    expect(htmlViz.content).toContain('<!DOCTYPE html>');
    expect(htmlViz.content).toContain('searchInput');
    expect(htmlViz.content).toContain('filter_');
    
    // Save HTML dashboard to file
    const dashboardPath = path.join(__dirname, '../../demo-dashboard.html');
    fs.writeFileSync(dashboardPath, htmlViz.content);
    console.log(`\n📁 Dashboard saved to: demo-dashboard.html`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ Demo Complete!');
    console.log('='.repeat(60));
    console.log('\nThe multi-agent system provides:');
    console.log('  ✅ Automatic data analysis with insights');
    console.log('  ✅ Statistical calculations');
    console.log('  ✅ Actionable recommendations');
    console.log('  ✅ Multiple visualization options');
    console.log('  ✅ Interactive HTML dashboards');
    console.log('\n📂 Open demo-dashboard.html in a browser to see the interactive dashboard!');
    console.log('='.repeat(60) + '\n');
  });

  it('should generate customer analysis like Claude example', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Customer Analysis (Claude-like)');
    console.log('='.repeat(60));
    
    // Aggregate data by customer (simulating GROUP BY query)
    const customerData = [
      { CUSTOMER_ID: 101, ORDER_COUNT: 2, TOTAL_REVENUE: 201.00 },
      { CUSTOMER_ID: 102, ORDER_COUNT: 2, TOTAL_REVENUE: 275.00 },
      { CUSTOMER_ID: 103, ORDER_COUNT: 1, TOTAL_REVENUE: 300.50 },
    ];
    
    const analysis = analyzeData({ data: customerData });
    
    console.log('\n📈 Customer Summary:');
    customerData.forEach(c => {
      console.log(`   Customer ${c.CUSTOMER_ID}: ${c.ORDER_COUNT} orders, $${c.TOTAL_REVENUE.toFixed(2)} revenue`);
    });
    
    const columnStats = analysis.statistics.columnStats as Record<string, { sum?: number }>;
    console.log(`\n   Total Revenue: $${columnStats.TOTAL_REVENUE?.sum?.toFixed(2)}`);
    
    // Generate bar chart
    const barChart = await generateVisualization({
      data: customerData,
      type: 'bar',
      title: 'Revenue by Customer',
    });
    
    console.log('\n✅ Generated Bar Chart for Customer Revenue');
    expect(barChart.type).toBe('bar_chart');
    
    // Generate interactive dashboard
    const dashboard = await generateVisualization({
      data: customerData,
      type: 'html',
      title: 'Customer Analysis Dashboard',
    });
    
    console.log('✅ Generated Interactive Customer Dashboard');
    expect(dashboard.type).toBe('html');
    
    console.log('\n' + '='.repeat(60) + '\n');
  });
});
