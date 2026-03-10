import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize production builds
  productionBrowserSourceMaps: false,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    // Turbopack handles tree-shaking and code-splitting automatically
    // No additional configuration needed for basic optimization
  },
  
  // Experimental features for better performance
  experimental: {
    // Optimize package imports for better tree-shaking
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'lucide-react',
      'recharts',
    ],
  },
};

export default nextConfig;
