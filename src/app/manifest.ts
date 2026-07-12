import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlainRecipe — Just the Recipe",
    short_name: "PlainRecipe",
    description: "Clean recipes without ads, preambles, or clutter.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e7",
    theme_color: "#1e201b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
