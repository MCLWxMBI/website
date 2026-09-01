export interface PageSectionNavItem {
  label: string
  href: `#${string}`
  children?: PageSectionNavItem[]
}

