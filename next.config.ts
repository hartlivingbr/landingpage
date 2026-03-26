import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Páginas públicas estáticas (servidas de /public)
      { source: '/',            destination: '/index.html',      permanent: false },
      { source: '/parceiros',   destination: '/parceiros.html',  permanent: false },
      { source: '/termos',      destination: '/termos.html',     permanent: false },
      { source: '/privacidade', destination: '/privacidade.html',permanent: false },
      { source: '/cookies',     destination: '/cookies.html',    permanent: false },
      // Proprietário (ainda em HTML estático)
      { source: '/login/proprietario',   destination: '/login-proprietario.html',   permanent: false },
      { source: '/cadastro/proprietario',destination: '/cadastro-proprietario.html',permanent: false },
    ]
  },
}

export default nextConfig
