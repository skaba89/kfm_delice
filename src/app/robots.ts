import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.PUBLIC_APP_URL || "https://kfm-delice-ggb4.onrender.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/platform"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
