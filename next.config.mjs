/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.CAPACITOR_BUILD === "true" && { output: "export" }),
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/opencv/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
