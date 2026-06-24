import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.31.12.14"], //Per test su rete locale 24-06-26
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
