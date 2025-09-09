import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Reduce hydration warnings
    optimizePackageImports: ['lucide-react'],
  },
  // Configure Turbopack (stable configuration)
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  // Webpack configuration for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js modules from client-side bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        child_process: false,
        http2: false,
        zlib: false,
        stream: false,
        util: false,
        url: false,
        querystring: false,
        http: false,
        https: false,
        assert: false,
        buffer: false,
        events: false,
      };
      
      // Exclude googleapis and related packages from client bundle
      config.externals = config.externals || [];
      config.externals.push({
        'googleapis': 'commonjs googleapis',
        'google-auth-library': 'commonjs google-auth-library',
        'gaxios': 'commonjs gaxios',
        'gtoken': 'commonjs gtoken',
        'jws': 'commonjs jws',
        'gcp-metadata': 'commonjs gcp-metadata',
      });
    }
    return config;
  },
  // PWA Configuration
  headers: async () => {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
  },
  // Suppress hydration warnings in development
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  // Enable standalone mode for better PWA performance
  output: 'standalone',
};

export default nextConfig;
