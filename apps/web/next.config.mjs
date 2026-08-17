/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  transpilePackages: ["@recalllens/matcher", "@recalllens/extraction"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts"],
      ...(config.resolve.extensionAlias ?? {}),
    };
    return config;
  },
};

export default nextConfig;