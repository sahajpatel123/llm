import withPWA from "next-pwa";

const config = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/[^/]+\/_next\/static\//,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /^https?:\/\/[^/]+\/icons\//,
      handler: "CacheFirst",
      options: {
        cacheName: "icons",
        expiration: { maxEntries: 16, maxAgeSeconds: 86400 },
      },
    },
  ],
})(config);
