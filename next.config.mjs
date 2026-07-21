/** @type {import('next').NextConfig} */

// GitHub Pages project site — served from /<repo>/. Set BASE_PATH='' for a
// custom domain (or for local preview at the root).
const basePath = process.env.BASE_PATH ?? '/hlsr-live'

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  // Exposed so plain <img> srcs can be basePath-prefixed.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
