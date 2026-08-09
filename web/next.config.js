/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Makes sure db/schema.sql and the config/*.md prompt docs are bundled
    // into serverless functions that read them via fs at runtime (rather
    // than importing them as modules). Using a broad "/api/**" key instead
    // of per-route keys since exact key-to-route matching for dynamic app
    // router routes isn't well documented — this just includes them
    // everywhere under /api, which costs nothing meaningful.
    outputFileTracingIncludes: {
      "/api/**": ["./db/schema.sql", "./config/*.md"],
    },
  },
};

module.exports = nextConfig;
