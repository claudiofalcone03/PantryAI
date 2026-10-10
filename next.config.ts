import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // output: "standalone", // <-- Disabilitato temporaneamente per permettere i test locali con `npm start`
  turbopack: {},
  allowedDevOrigins: ["192.168.1.182", "10.31.12.14", "172.20.10.2", "dark-banks-like.loca.lt"], //Per test su wifi di casa e eduroam (30-06-26) non vale per google auth

  serverExternalPackages: [
    "genkit",
    "@genkit-ai/core",
    "@genkit-ai/google-genai",
    "@genkit-ai/ai",
  ],

  images: {
    remotePatterns: [
      {
        //Per visualizzare le immagini del profilo degli utenti da Google
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/genkit",
        destination: "/profilo/sviluppo/genkit",
        permanent: false,
      },
      {
        source: "/architettura",
        destination: "/profilo/sviluppo/genkit",
        permanent: false,
      },
    ];
  },
};

export default withSerwist(nextConfig);
