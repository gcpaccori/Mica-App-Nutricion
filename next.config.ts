import type { NextConfig } from "next";

const devPort = process.env.PORT ?? "3000";
const codespacesForwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

const allowedDevelopmentOrigins = [
  `localhost:${devPort}`,
  `127.0.0.1:${devPort}`,
  ...(codespacesForwardingDomain ? [`*.${codespacesForwardingDomain}`] : []),
  "*.preview.app.github.dev",
  "*.githubpreview.dev",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevelopmentOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: allowedDevelopmentOrigins,
    },
  },
};

export default nextConfig;
