/** @type {import('next').NextConfig} */

// Served from the root of its own domain (hlsrlive.eyesonscore.com), so no base
// path. Set BASE_PATH='/hlsr-live' to build for the github.io project URL.
const basePath = process.env.BASE_PATH ?? ''

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath !== '' ? { basePath, assetPrefix: basePath } : {}),
  // Exposed so plain <img> srcs can be basePath-prefixed.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
