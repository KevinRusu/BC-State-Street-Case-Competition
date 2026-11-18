import type { MetadataRoute } from "next";

// The hosted dashboard is for the people given the password: no crawler should index any of it.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
