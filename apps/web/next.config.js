module.exports = {
  output: "standalone",
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  }
};
