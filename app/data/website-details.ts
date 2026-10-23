const websiteDetails: Record<string, string[]> = {
  'engage-victoria': ['Login required', 'Online submission'],
  'dcceew-consult': ['Online submission']
}

export const getWebsiteDetails = (website: string): string[] => websiteDetails[website] ?? []
