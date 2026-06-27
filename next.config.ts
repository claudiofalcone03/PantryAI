import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.182"], //Per test su wifi di casa, non vale per google auth
  images: {
    remotePatterns: [
      {
        //Per visualizzare le immagini del profilo degli utenti da Google
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
