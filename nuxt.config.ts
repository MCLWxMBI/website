// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      titleTemplate: '%s | ECHO',
      meta: [{ name: 'description', content: 'Discover public consultation opportunities shaping environmental policy in Victoria and across Australia.' }]
    }
  },

  nitro: {
    preset: 'netlify'
  },

  modules: ['@netlify/nuxt']
})
