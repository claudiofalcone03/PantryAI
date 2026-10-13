import type { NextConfig } from "next";
import os from "node:os";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

function getLocalDevIps(): string[] {
  try {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          ips.push(net.address);
        }
      }
    }
    return ips;
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // output: "standalone", // <-- Disabilitato temporaneamente per permettere i test locali con `npm start`
  turbopack: {},
  allowedDevOrigins: [
    ...getLocalDevIps(),
    "192.168.1.182",
    "10.31.12.14",
    "172.20.10.2",
    "dark-banks-like.loca.lt",
  ],

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
