import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
  },
  // Configure webpack to handle mongoose properly
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize mongoose on server to avoid bundling issues
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('mongoose');
      }
    }
    return config;
  },
  // Add empty turbopack config to silence the warning
  turbopack: {},
};

export default nextConfig;
