import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    '*': ['./legacy/**/*'],
  },
  images: {
    remotePatterns: [
      // Vercel Blob public bucket. Tightened to the exact store hostname at deploy time.
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

export default nextConfig;
