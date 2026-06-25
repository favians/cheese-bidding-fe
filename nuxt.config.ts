// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // Force dark mode: the brand is a dark raid theme, so Nuxt UI components
  // (inputs, cards) must render their dark surfaces — not the default light
  // (which produced white inputs on the dark background).
  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  runtimeConfig: {
    // server-only: base URL of the Go backend, reached only from Nitro (BFF).
    backendBaseUrl: 'http://localhost:8081',
    // name of the httpOnly cookie that holds the player JWT.
    authCookieName: 'cb_token',
    public: {
      // client talks only to same-origin Nitro routes under this prefix.
      apiBase: '/api'
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
