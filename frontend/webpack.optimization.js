/**
 * Webpack Bundle Optimization Configuration
 * Enhances tree-shaking and code splitting for Node Library components
 * 
 * @author Node Library Team
 * @version 1.0.0
 * @since 2024-08-14
 */

const path = require('path');

module.exports = {
  /**
   * Optimization configuration for bundle size reduction
   */
  optimization: {
    // Enable tree-shaking for production builds
    usedExports: true,
    sideEffects: false,
    
    // Code splitting configuration
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Separate vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        
        // Material-UI icons optimization
        muiIcons: {
          test: /[\\/]node_modules[\\/]@mui[\\/]icons-material[\\/]/,
          name: 'mui-icons',
          chunks: 'all',
          priority: 20,
          enforce: true,
        },
        
        // Node Library components
        nodeLibrary: {
          test: /[\\/]src[\\/]components[\\/]NodeLibrary[\\/]/,
          name: 'node-library',
          chunks: 'all',
          priority: 15,
        },
        
        // Individual node components (lazy loaded)
        nodeComponents: {
          test: /[\\/]src[\\/]components[\\/]nodes[\\/]node-types[\\/]/,
          name(module) {
            // Extract component name for individual chunks
            const match = module.resource.match(/[\\/]([^[\\/]+)Node\.tsx?$/);
            if (match) {
              const componentName = match[1].toLowerCase();
              return `node-${componentName}`;
            }
            return 'node-component';
          },
          chunks: 'async', // Only for lazy-loaded components
          priority: 25,
          enforce: true,
        },
        
        // Common utilities and hooks
        common: {
          test: /[\\/]src[\\/](hooks|utils|services)[\\/]/,
          name: 'common',
          chunks: 'all',
          priority: 5,
          minChunks: 2,
        },
      },
    },
    
    // Runtime chunk optimization
    runtimeChunk: {
      name: 'runtime',
    },
  },
  
  /**
   * Module resolution optimizations
   */
  resolve: {
    // Optimize Material-UI imports for tree-shaking
    alias: {
      '@mui/icons-material': path.resolve(__dirname, 'node_modules/@mui/icons-material'),
    },
    
    // Prefer ES modules for better tree-shaking
    mainFields: ['module', 'main'],
  },
  
  /**
   * Module rules for optimization
   */
  module: {
    rules: [
      // Optimize Material-UI icon imports
      {
        test: /[\\/]@mui[\\/]icons-material[\\/]/,
        sideEffects: false,
      },
      
      // Enable tree-shaking for custom components
      {
        test: /\.tsx?$/,
        include: [
          path.resolve(__dirname, 'src/components'),
          path.resolve(__dirname, 'src/config'),
        ],
        sideEffects: false,
      },
    ],
  },
  
  /**
   * Performance hints and budgets
   */
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000, // 500kb
    maxAssetSize: 256000, // 250kb
    assetFilter: (assetFilename) => {
      // Only check JavaScript files
      return assetFilename.endsWith('.js');
    },
  },
  
  /**
   * Development-specific optimizations
   */
  ...(process.env.NODE_ENV === 'development' && {
    devtool: 'eval-cheap-module-source-map',
    optimization: {
      ...module.exports.optimization,
      minimize: false,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: {
        ...module.exports.optimization.splitChunks,
        minSize: 0,
        cacheGroups: {
          ...module.exports.optimization.splitChunks.cacheGroups,
          // Disable some optimizations in development for faster builds
          default: false,
          vendors: false,
        },
      },
    },
  }),
  
  /**
   * Production-specific optimizations
   */
  ...(process.env.NODE_ENV === 'production' && {
    devtool: 'source-map',
    optimization: {
      ...module.exports.optimization,
      minimize: true,
      concatenateModules: true,
      flagIncludedChunks: true,
      occurrenceOrder: true,
      providedExports: true,
      usedExports: true,
      sideEffects: false,
    },
  }),
};

/**
 * Bundle analysis configuration
 * Use with webpack-bundle-analyzer for detailed bundle inspection
 */
const bundleAnalyzerConfig = {
  plugins: [
    // Uncomment to enable bundle analysis
    // new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
    //   analyzerMode: 'static',
    //   openAnalyzer: false,
    //   reportFilename: 'bundle-report.html',
    // }),
  ],
};

module.exports.bundleAnalyzer = bundleAnalyzerConfig;
