/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'api.dicebear.com'],
  },
  async headers() {
    return [
      {
        // Meet embeds the add-on in an iframe; without this it is blocked.
        source: '/meet/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors https://meet.google.com https://*.meet.google.com',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self "https://meet.google.com" "https://*.meet.google.com"), microphone=(self "https://meet.google.com" "https://*.meet.google.com"), display-capture=(self "https://meet.google.com" "https://*.meet.google.com")',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
