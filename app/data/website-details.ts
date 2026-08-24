import type { WebsiteKey } from '~/types/opportunity'

const websiteDetails: Record<WebsiteKey, string[]> = {
  'engage-victoria': ['Login required', 'Online submission'],
  'dcceew-consult': ['Online submission']
}

export const getWebsiteDetails = (website: WebsiteKey): string[] => websiteDetails[website]
