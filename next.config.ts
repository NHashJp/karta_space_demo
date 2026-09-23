import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /*
   * Memory photographs live in `private/cards/<slug>/`, outside `public/`, and
   * are read from disk by the media route (spec v0.2 §14.3). The path is built
   * from the request, so the build's tracer cannot see which files that route
   * will need — left alone it warns that it is tracing the whole project, and
   * on a serverless deployment the photographs might not be bundled at all.
   * Naming them here is both the fix and the answer to the warning.
   */
  outputFileTracingIncludes: {
    "/c/[slug]/media/[...path]": ["./private/cards/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
