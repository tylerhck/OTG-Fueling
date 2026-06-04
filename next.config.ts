import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["mariadb", "@prisma/adapter-mariadb", "bcryptjs"],
};

export default nextConfig;
// trigger rebuild
