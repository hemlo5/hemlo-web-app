import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://hemloai.com";
  const now = new Date();
  const routes = [
    { path: "/", priority: 1 },
    { path: "/simulate/mirofish", priority: 1 },
    { path: "/polymarket", priority: 0.95 },
    { path: "/kalshi", priority: 0.95 },
    { path: "/pricing", priority: 0.7 },
    { path: "/features", priority: 0.8 },
    { path: "/vision", priority: 0.75 },
    { path: "/founders", priority: 0.65 },
    { path: "/support", priority: 0.65 },
    { path: "/terms", priority: 0.4 },
    { path: "/privacy-policy", priority: 0.4 },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.path.includes("polymarket") || route.path.includes("kalshi") ? "hourly" : "weekly",
    priority: route.priority,
  }));
}
