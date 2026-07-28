import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow microphone access — required for Web Speech API / SpeechRecognition
          {
            key: "Permissions-Policy",
            value: "microphone=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
