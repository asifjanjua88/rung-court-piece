/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Tell Next.js to transpile @babylonjs/core through its own bundler.
  // Without this, Next.js 14 webpack can't resolve the package's ES-module
  // exports even when the import() is inside a useEffect / dynamic().
  transpilePackages: ['@babylonjs/core'],

  webpack(config, { isServer }) {
    if (isServer) {
      // Skip Babylon.js entirely on the server — it needs browser globals
      // (WebGL, window, navigator) and is loaded only in the browser via
      // the dynamic import() inside useEffect.
      const existing = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean)
      config.externals = [...existing, '@babylonjs/core']
    }
    return config
  },
}

module.exports = nextConfig
