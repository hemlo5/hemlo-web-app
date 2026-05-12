import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/payment-success/"],
      },
    ],
    sitemap: "https://hemloai.com/sitemap.xml",
  };
}
