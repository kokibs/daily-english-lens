import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Daily English Lens",
    short_name: "English Lens",
    description: "写真と英語で、一日を振り返る。",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4ee",
    theme_color: "#194b3e",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
