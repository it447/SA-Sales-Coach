/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Makes sure db/schema.sql is bundled into the serverless function for
    // /api/admin/migrate, since it's read at runtime via fs rather than
    // imported as a module.
    outputFileTracingIncludes: {
      "/api/admin/migrate": ["./db/schema.sql"],
    },
  },
};

module.exports = nextConfig;
