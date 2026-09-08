import about from './about.txt?raw'
import resources from './resources.txt?raw'
import type { StaticPageSlug } from '~~/shared/types/static-page'

export const staticPageTemplates: Record<StaticPageSlug, string> = { about, resources }

export const staticPageDetails: Record<StaticPageSlug, {
  title: string
  description: string
  publicPath: string
  contentClass: string
}> = {
  about: {
    title: 'About',
    description: 'About ECHO, the MCLE initiative, and frequently asked questions.',
    publicPath: '/about',
    contentClass: 'about-content'
  },
  resources: {
    title: 'Resources',
    description: 'Guidance for participating in public consultations.',
    publicPath: '/resources',
    contentClass: 'resource-content'
  }
}
