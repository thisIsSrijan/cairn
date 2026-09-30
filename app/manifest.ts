import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cairn - Data Intelligence Platform",
    short_name: "Cairn",
    description: "AI-powered web data collection with receipts for every cell.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3EFE6",
    theme_color: "#D9482B",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
