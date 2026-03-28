import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevents the site from being embedded in an iframe (clickjacking)
  { key: 'X-Frame-Options',        value: 'DENY' },
  // Stops browsers from guessing the MIME type (MIME-sniffing attacks)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Controls how much referrer info is sent when navigating away
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  // Restricts access to sensitive browser APIs
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
  // Enables DNS prefetch for performance
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  async redirects() {
    return [
      // Public static pages (served from /public)
      { source: '/',            destination: '/index.html',       permanent: false },
      { source: '/parceiros',   destination: '/parceiros.html',   permanent: false },
      { source: '/termos',      destination: '/termos.html',      permanent: false },
      { source: '/privacidade', destination: '/privacidade.html', permanent: false },
      { source: '/cookies',     destination: '/cookies.html',     permanent: false },
      // Proprietário (still on static HTML)
      { source: '/login/proprietario',    destination: '/login-proprietario.html',    permanent: false },
      { source: '/cadastro/proprietario', destination: '/cadastro-proprietario.html', permanent: false },
    ]
  },
}

export default nextConfig
