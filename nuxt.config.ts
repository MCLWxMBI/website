// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@netlify/nuxt', 'nuxt-auth-utils', 'nuxt-csurf'],

  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  vite: {
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
      }
    }
  },

  app: {
    head: {
      titleTemplate: '%s | ECHO',
      meta: [{ name: 'description', content: 'Discover public consultation opportunities shaping environmental policy in Victoria and across Australia.' }]
    }
  },

  csurf: {
    methodsToProtect: ['POST', 'PUT', 'PATCH', 'DELETE']
  },

  runtimeConfig: {
    session: {
      maxAge: 86_400,
      cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
    },
    public: {
      mapTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      mapAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },

  nitro: {
    preset: 'netlify'
  },

  netlify: {
    database: {
      enabled: false
    }
  }
})
