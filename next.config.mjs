/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  async rewrites() {
    return [
      {
        source: '/skrining-mandiri',
        destination: '/skrining-tamu',
      },
      {
        source: '/kalkulator',
        destination: '/skrining-tamu',
      },
    ]
  },
};

export default nextConfig;
