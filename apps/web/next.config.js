module.exports = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL || "http://api:4000"}/:path*` }];
  }
};
