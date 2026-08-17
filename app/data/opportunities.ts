import type { Opportunity, OpportunityCategory, OpportunityStatus, Jurisdiction } from '~/types/opportunity'

type Seed = Omit<Opportunity, 'fullText'> & {
  focus: string
}

const seed = (
  id: string,
  title: string,
  summary: string,
  sourceOrg: string,
  jurisdiction: Jurisdiction,
  openDate: string,
  closeDate: string,
  status: OpportunityStatus,
  tags: OpportunityCategory[],
  focus: string
): Seed => ({
  id, title, summary, sourceOrg, jurisdiction, openDate, closeDate, status, tags, focus,
  sourceUrl: jurisdiction === 'Victoria' ? 'https://engage.vic.gov.au/' : 'https://consult.dcceew.gov.au/'
})

const seeds: Seed[] = [
  seed('victorian-biodiversity-strategy-2037', 'Refreshing Victoria’s biodiversity strategy', 'Help shape the next decade of action to protect and restore Victoria’s native plants, animals and ecosystems.', 'Department of Energy, Environment and Climate Action', 'Victoria', '2026-07-28', '2026-09-18', 'open', ['Biodiversity & ecosystems'], 'targets, priorities and a practical approach to measuring nature recovery'),
  seed('national-climate-risk-assessment', 'National Climate Risk Assessment framework', 'Comment on the framework used to identify, compare and prioritise nationally significant climate risks.', 'Department of Climate Change, Energy, the Environment and Water', 'Commonwealth', '2026-08-04', '2026-09-30', 'open', ['Climate change', 'Communities & environment'], 'the systems, communities and time horizons used in national adaptation planning'),
  seed('murray-darling-basin-plan-review', 'Murray–Darling Basin Plan review: early insights', 'Share evidence and experience to inform the first statutory review of the Murray–Darling Basin Plan.', 'Murray–Darling Basin Authority', 'Commonwealth', '2026-08-12', '2026-10-16', 'open', ['Water & resources', 'First Nations & cultural heritage'], 'river health, cultural flows, water availability and community outcomes'),
  seed('offshore-renewables-guidance', 'Environmental guidance for offshore renewable projects', 'Review proposed guidance for environmental assessment and community engagement in offshore renewable energy areas.', 'Department of Climate Change, Energy, the Environment and Water', 'Commonwealth', '2026-08-10', '2026-09-11', 'open', ['Climate change', 'Biodiversity & ecosystems'], 'biodiversity evidence, cumulative impacts and engagement with coastal communities'),
  seed('victorian-waterway-health', 'Updated standards for Victorian waterway health', 'Have your say on updated indicators and targets for rivers, wetlands and estuaries across Victoria.', 'Department of Energy, Environment and Climate Action', 'Victoria', '2026-08-03', '2026-10-02', 'open', ['Water & resources', 'Biodiversity & ecosystems'], 'ecological indicators, monitoring methods and regional priorities'),
  seed('circular-economy-regulations', 'Circular economy regulations for priority materials', 'Provide feedback on proposed requirements for product stewardship, recovery targets and reporting.', 'Sustainability Victoria', 'Victoria', '2026-08-17', '2026-10-23', 'open', ['Communities & environment', 'Climate change'], 'stewardship obligations and minimum recovery targets for producers'),
  seed('cultural-landscape-guidelines', 'Cultural heritage landscape guidelines', 'Upcoming consultation on recognising and protecting Aboriginal cultural landscapes in environmental planning.', 'First Peoples – State Relations', 'Victoria', '2026-09-07', '2026-11-06', 'upcoming', ['First Nations & cultural heritage', 'Communities & environment'], 'recognising Aboriginal cultural landscapes in strategic and project planning'),
  seed('nature-repair-methods', 'New methods for the Nature Repair Market', 'Upcoming opportunity to comment on biodiversity assessment and restoration methods for new projects.', 'Department of Climate Change, Energy, the Environment and Water', 'Commonwealth', '2026-09-21', '2026-11-20', 'upcoming', ['Biodiversity & ecosystems'], 'habitat restoration, condition assessment, permanence and threatened species'),
  seed('urban-forest-controls', 'Planning controls for urban forest protection', 'Completed consultation on proposed planning controls to protect canopy trees in growing Victorian suburbs.', 'Department of Transport and Planning', 'Victoria', '2026-05-11', '2026-07-10', 'closed', ['Communities & environment', 'Biodiversity & ecosystems'], 'housing growth, urban heat, biodiversity corridors and landowner requirements'),
  seed('epbc-offsets-policy', 'Reforming environmental offsets under the EPBC Act', 'Completed consultation on restoration contributions and environmental offsets under national law.', 'Department of Climate Change, Energy, the Environment and Water', 'Commonwealth', '2026-04-20', '2026-06-19', 'closed', ['Biodiversity & ecosystems'], 'additionality, like-for-like requirements, transparency and regional planning'),
  seed('victorian-coastal-strategy', 'Victoria’s next coastal strategy', 'Completed consultation on priorities for resilient coastlines, marine ecosystems and coastal communities.', 'Marine and Coastal Council', 'Victoria', '2026-03-16', '2026-05-29', 'closed', ['Climate change', 'Communities & environment', 'First Nations & cultural heritage'], 'sea-level rise, coastal access, cultural values and community-led adaptation'),
  seed('critical-minerals-review', 'Critical Minerals Strategy review', 'Completed review of environmental, community and economic priorities for Australia’s critical minerals sector.', 'Department of Industry, Science and Resources', 'Commonwealth', '2026-02-09', '2026-04-03', 'closed', ['Water & resources', 'First Nations & cultural heritage'], 'environmental safeguards, water use, circularity and benefit sharing')
]

export const opportunities: Opportunity[] = seeds.map(({ focus, ...item }) => ({
  ...item,
  fullText: [
    `${item.sourceOrg} is seeking input on ${focus}.`,
    'Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation.'
  ]
}))
