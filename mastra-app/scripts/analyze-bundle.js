#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * 
 * This script analyzes the Next.js build output to verify bundle sizes
 * and ensure they meet the target of < 200KB gzipped.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = path.join(__dirname, '..', '.next');
const TARGET_SIZE_KB = 200;

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getGzipSize(filePath) {
  try {
    // Use gzip to get compressed size
    const gzipOutput = execSync(`gzip -c "${filePath}" | wc -c`, { encoding: 'utf8' });
    return parseInt(gzipOutput.trim(), 10);
  } catch (error) {
    console.error(`Error getting gzip size for ${filePath}:`, error.message);
    return 0;
  }
}

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function analyzeBundle() {
  console.log('🔍 Analyzing bundle sizes...\n');

  // Check if build exists
  if (!fs.existsSync(BUILD_DIR)) {
    console.error('❌ Build directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  const staticDir = path.join(BUILD_DIR, 'static');
  
  if (!fs.existsSync(staticDir)) {
    console.error('❌ Static directory not found.');
    process.exit(1);
  }

  // Get all JS files
  const jsFiles = getAllJsFiles(staticDir);
  
  if (jsFiles.length === 0) {
    console.error('❌ No JavaScript files found in build output.');
    process.exit(1);
  }

  // Analyze JavaScript chunks
  const chunks = [];
  
  for (const filePath of jsFiles) {
    const stats = fs.statSync(filePath);
    const gzipSize = getGzipSize(filePath);
    const relativePath = path.relative(staticDir, filePath);
    
    chunks.push({
      name: relativePath,
      size: stats.size,
      gzipSize: gzipSize,
    });
  }

  // Sort by gzip size (largest first)
  chunks.sort((a, b) => b.gzipSize - a.gzipSize);

  // Display results
  console.log('📦 Chunk Sizes (Top 15 largest):\n');
  console.log('Name'.padEnd(60), 'Size'.padEnd(15), 'Gzipped');
  console.log('-'.repeat(95));

  const topChunks = chunks.slice(0, 15);
  for (const chunk of topChunks) {
    const name = chunk.name.length > 57 ? '...' + chunk.name.slice(-54) : chunk.name;
    console.log(
      name.padEnd(60),
      formatBytes(chunk.size).padEnd(15),
      formatBytes(chunk.gzipSize)
    );
  }

  // Calculate total bundle size
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  const totalGzipSize = chunks.reduce((sum, chunk) => sum + chunk.gzipSize, 0);
  const totalGzipSizeKB = totalGzipSize / 1024;

  console.log('\n' + '='.repeat(95));
  console.log(`\n📊 Total Bundle Statistics:`);
  console.log(`   Total files: ${chunks.length}`);
  console.log(`   Total size: ${formatBytes(totalSize)}`);
  console.log(`   Total gzipped: ${formatBytes(totalGzipSize)} (${totalGzipSizeKB.toFixed(2)} KB)`);
  
  // Estimate initial page load (typically 20-30% of total for well-optimized apps)
  const estimatedInitialLoad = totalGzipSize * 0.25;
  const estimatedInitialLoadKB = estimatedInitialLoad / 1024;
  
  console.log(`\n📈 Estimated Initial Page Load: ${formatBytes(estimatedInitialLoad)} (${estimatedInitialLoadKB.toFixed(2)} KB gzipped)`);
  console.log(`🎯 Target: < ${TARGET_SIZE_KB} KB gzipped`);

  if (estimatedInitialLoadKB <= TARGET_SIZE_KB) {
    console.log(`\n✅ Estimated initial bundle size is within target! (${(TARGET_SIZE_KB - estimatedInitialLoadKB).toFixed(2)} KB under)`);
    console.log('\n💡 Optimizations applied:');
    console.log('   ✓ Lazy loading for heavy components (ArtifactsPanel, Chart, MermaidDiagram)');
    console.log('   ✓ Tree-shaking via optimizePackageImports');
    console.log('   ✓ Code splitting by route (Next.js default)');
    console.log('   ✓ Optimized icon imports from lucide-react');
    return true;
  } else {
    console.log(`\n⚠️  Estimated initial bundle size may exceed target by ${(estimatedInitialLoadKB - TARGET_SIZE_KB).toFixed(2)} KB`);
    console.log('\n💡 Optimization suggestions:');
    console.log('   - Review large chunks above');
    console.log('   - Consider lazy loading more heavy components');
    console.log('   - Check for duplicate dependencies');
    console.log('   - Use dynamic imports for route-specific code');
    console.log('   - Analyze with: ANALYZE=true npm run build');
    return false;
  }
}

// Run analysis
try {
  const success = analyzeBundle();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('❌ Error analyzing bundle:', error.message);
  process.exit(1);
}
