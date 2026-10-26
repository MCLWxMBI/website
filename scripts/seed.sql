-- Synthetic development fixtures only. Run through npm run db:seed after migrations.
-- The runner owns the transaction; no users, pages, or website indexes are changed.
SET LOCAL TIME ZONE 'UTC';

-- Upload dates are synthetic first-upload dates, separate from content hashes.
CREATE TEMP TABLE opportunity_seed (
  LIKE public.opportunities,
  upload_date date NOT NULL,
  source_index_id bigint
) ON COMMIT DROP;

INSERT INTO opportunity_seed
SELECT * FROM jsonb_populate_recordset(NULL::opportunity_seed, $fixtures$
[
  {
    "id": "victorian-biodiversity-strategy-2037",
    "title": "Refreshing Victoria’s biodiversity strategy",
    "full_text": [
      "Department of Energy, Environment and Climate Action is seeking input on targets, priorities and a practical approach to measuring nature recovery.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://engage.vic.gov.au/project/placeholder-victorian-biodiversity-strategy-2037",
    "website_id": "engage-victoria",
    "source_org": "Department of Energy, Environment and Climate Action",
    "jurisdiction": "Victoria",
    "start_date": null,
    "submission_deadline": "2026-09-18T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Biodiversity & ecosystems"
    ],
    "tags": null,
    "summary": "Help shape the next decade of action to protect and restore Victoria’s native plants, animals and ecosystems.",
    "location": null,
    "upload_date": "2026-08-01"
  },
  {
    "id": "national-climate-risk-assessment",
    "title": "National Climate Risk Assessment framework",
    "full_text": [
      "Department of Climate Change, Energy, the Environment and Water is seeking input on the systems, communities and time horizons used in national adaptation planning.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://consult.dcceew.gov.au/find-consultations/placeholder-national-climate-risk-assessment",
    "website_id": "dcceew-consult",
    "source_org": "Department of Climate Change, Energy, the Environment and Water",
    "jurisdiction": "Commonwealth",
    "start_date": "2026-08-04T00:00:00Z",
    "submission_deadline": "2026-09-30T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Climate change",
      "Communities & environment"
    ],
    "tags": null,
    "summary": "Comment on the framework used to identify, compare and prioritise nationally significant climate risks.",
    "location": null,
    "upload_date": "2026-08-04"
  },
  {
    "id": "murray-darling-basin-plan-review",
    "title": "Murray–Darling Basin Plan review: early insights",
    "full_text": [
      "Murray–Darling Basin Authority is seeking input on river health, cultural flows, water availability and community outcomes.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://consult.dcceew.gov.au/find-consultations/placeholder-murray-darling-basin-plan-review",
    "website_id": "dcceew-consult",
    "source_org": "Murray–Darling Basin Authority",
    "jurisdiction": "Commonwealth",
    "start_date": null,
    "submission_deadline": "2026-10-16T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Water & resources",
      "First Nations & cultural heritage"
    ],
    "tags": null,
    "summary": "Share evidence and experience to inform the first statutory review of the Murray–Darling Basin Plan.",
    "location": null,
    "upload_date": "2026-08-05"
  },
  {
    "id": "offshore-renewables-guidance",
    "title": "Environmental guidance for offshore renewable projects",
    "full_text": [
      "Department of Climate Change, Energy, the Environment and Water is seeking input on biodiversity evidence, cumulative impacts and engagement with coastal communities.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://consult.dcceew.gov.au/find-consultations/placeholder-offshore-renewables-guidance",
    "website_id": "dcceew-consult",
    "source_org": "Department of Climate Change, Energy, the Environment and Water",
    "jurisdiction": "Commonwealth",
    "start_date": "2026-08-10T00:00:00Z",
    "submission_deadline": "2026-09-11T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Climate change",
      "Biodiversity & ecosystems"
    ],
    "tags": [
      "Invite-only"
    ],
    "summary": "Review proposed guidance for environmental assessment and community engagement in offshore renewable energy areas.",
    "location": {
      "label": "Victorian offshore renewable energy study areas (prototype geometry)",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [
          [
            [
              [
                146.2,
                -39.1
              ],
              [
                148.4,
                -39.1
              ],
              [
                148.4,
                -38
              ],
              [
                146.2,
                -38
              ],
              [
                146.2,
                -39.1
              ]
            ]
          ],
          [
            [
              [
                140.6,
                -39.2
              ],
              [
                142.2,
                -39.2
              ],
              [
                142.2,
                -38.1
              ],
              [
                140.6,
                -38.1
              ],
              [
                140.6,
                -39.2
              ]
            ]
          ]
        ]
      }
    },
    "upload_date": "2026-08-10"
  },
  {
    "id": "victorian-waterway-health",
    "title": "Updated standards for Victorian waterway health",
    "full_text": [
      "Department of Energy, Environment and Climate Action is seeking input on ecological indicators, monitoring methods and regional priorities.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://engage.vic.gov.au/project/placeholder-victorian-waterway-health",
    "website_id": "engage-victoria",
    "source_org": "Department of Energy, Environment and Climate Action",
    "jurisdiction": "Victoria",
    "start_date": "2026-08-03T00:00:00Z",
    "submission_deadline": "2026-10-02T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Water & resources",
      "Biodiversity & ecosystems"
    ],
    "tags": null,
    "summary": "Have your say on updated indicators and targets for rivers, wetlands and estuaries across Victoria.",
    "location": {
      "label": "Central Victoria study area (prototype geometry)",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              143.2,
              -38.1
            ],
            [
              146.2,
              -38.1
            ],
            [
              146.2,
              -35.8
            ],
            [
              143.2,
              -35.8
            ],
            [
              143.2,
              -38.1
            ]
          ],
          [
            [
              144.15,
              -37.45
            ],
            [
              145.15,
              -37.45
            ],
            [
              145.15,
              -36.65
            ],
            [
              144.15,
              -36.65
            ],
            [
              144.15,
              -37.45
            ]
          ]
        ]
      }
    },
    "upload_date": "2026-08-03"
  },
  {
    "id": "circular-economy-regulations",
    "title": "Circular economy regulations for priority materials",
    "full_text": [
      "Sustainability Victoria is seeking input on stewardship obligations and minimum recovery targets for producers.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://engage.vic.gov.au/project/placeholder-circular-economy-regulations",
    "website_id": "engage-victoria",
    "source_org": "Sustainability Victoria",
    "jurisdiction": "Victoria",
    "start_date": "2026-08-17T00:00:00Z",
    "submission_deadline": "2026-10-23T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Communities & environment",
      "Climate change"
    ],
    "tags": null,
    "summary": "Provide feedback on proposed requirements for product stewardship, recovery targets and reporting.",
    "location": {
      "label": "Melbourne, Victoria",
      "geometry": {
        "type": "Point",
        "coordinates": [
          144.9631,
          -37.8136
        ]
      }
    },
    "upload_date": "2026-08-17"
  },
  {
    "id": "cultural-landscape-guidelines",
    "title": "Cultural heritage landscape guidelines",
    "full_text": [
      "First Peoples – State Relations is seeking input on recognising Aboriginal cultural landscapes in strategic and project planning.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://engage.vic.gov.au/project/placeholder-cultural-landscape-guidelines",
    "website_id": "engage-victoria",
    "source_org": "First Peoples – State Relations",
    "jurisdiction": "Victoria",
    "start_date": "2026-09-07T00:00:00Z",
    "submission_deadline": "2026-11-06T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "First Nations & cultural heritage",
      "Communities & environment"
    ],
    "tags": [
      "Invite-only"
    ],
    "summary": "Upcoming consultation on recognising and protecting Aboriginal cultural landscapes in environmental planning.",
    "location": null,
    "upload_date": "2026-09-07"
  },
  {
    "id": "nature-repair-methods",
    "title": "New methods for the Nature Repair Market",
    "full_text": [
      "Department of Climate Change, Energy, the Environment and Water is seeking input on habitat restoration, condition assessment, permanence and threatened species.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://consult.dcceew.gov.au/find-consultations/placeholder-nature-repair-methods",
    "website_id": "dcceew-consult",
    "source_org": "Department of Climate Change, Energy, the Environment and Water",
    "jurisdiction": "Commonwealth",
    "start_date": "2026-09-21T00:00:00Z",
    "submission_deadline": "2026-11-01T00:00:00Z",
    "submission_deadline_precision": "month",
    "category": [
      "Biodiversity & ecosystems"
    ],
    "tags": null,
    "summary": "Upcoming opportunity to comment on biodiversity assessment and restoration methods for new projects.",
    "location": null,
    "upload_date": "2026-09-21"
  },
  {
    "id": "urban-forest-controls",
    "title": "Planning controls for urban forest protection",
    "full_text": [
      "Department of Transport and Planning is seeking input on housing growth, urban heat, biodiversity corridors and landowner requirements.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://engage.vic.gov.au/project/placeholder-urban-forest-controls",
    "website_id": "engage-victoria",
    "source_org": "Department of Transport and Planning",
    "jurisdiction": "Victoria",
    "start_date": "2026-05-11T00:00:00Z",
    "submission_deadline": "2026-07-10T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Communities & environment",
      "Biodiversity & ecosystems"
    ],
    "tags": null,
    "summary": "Completed consultation on proposed planning controls to protect canopy trees in growing Victorian suburbs.",
    "location": null,
    "upload_date": "2026-05-11"
  },
  {
    "id": "epbc-offsets-policy",
    "title": "Reforming environmental offsets under the EPBC Act",
    "full_text": [
      "Department of Climate Change, Energy, the Environment and Water is seeking input on additionality, like-for-like requirements, transparency and regional planning.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://consult.dcceew.gov.au/find-consultations/placeholder-epbc-offsets-policy",
    "website_id": "dcceew-consult",
    "source_org": "Department of Climate Change, Energy, the Environment and Water",
    "jurisdiction": "Commonwealth",
    "start_date": "2026-04-20T00:00:00Z",
    "submission_deadline": "2026-06-19T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Biodiversity & ecosystems"
    ],
    "tags": null,
    "summary": "Completed consultation on restoration contributions and environmental offsets under national law.",
    "location": null,
    "upload_date": "2026-04-20"
  },
  {
    "id": "victorian-coastal-strategy",
    "title": "Victoria’s next coastal strategy",
    "full_text": [
      "Marine and Coastal Council is seeking input on sea-level rise, coastal access, cultural values and community-led adaptation.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://engage.vic.gov.au/project/placeholder-victorian-coastal-strategy",
    "website_id": "engage-victoria",
    "source_org": "Marine and Coastal Council",
    "jurisdiction": "Victoria",
    "start_date": "2026-03-16T00:00:00Z",
    "submission_deadline": "2026-05-29T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Climate change",
      "Communities & environment",
      "First Nations & cultural heritage"
    ],
    "tags": null,
    "summary": "Completed consultation on priorities for resilient coastlines, marine ecosystems and coastal communities.",
    "location": null,
    "upload_date": "2026-03-16"
  },
  {
    "id": "critical-minerals-review",
    "title": "Critical Minerals Strategy review",
    "full_text": [
      "Department of Industry, Science and Resources is seeking input on environmental safeguards, water use, circularity and benefit sharing.",
      "Researchers, community organisations, Traditional Owners, practitioners and members of the public are invited to contribute. Feedback will help refine the final policy approach and its implementation."
    ],
    "source_url": "https://consult.dcceew.gov.au/find-consultations/placeholder-critical-minerals-review",
    "website_id": "dcceew-consult",
    "source_org": "Department of Industry, Science and Resources",
    "jurisdiction": "Commonwealth",
    "start_date": "2026-02-09T00:00:00Z",
    "submission_deadline": "2026-04-03T23:59:59Z",
    "submission_deadline_precision": "datetime",
    "category": [
      "Water & resources",
      "First Nations & cultural heritage"
    ],
    "tags": [
      "Invite-only"
    ],
    "summary": "Completed review of environmental, community and economic priorities for Australia’s critical minerals sector.",
    "location": null,
    "upload_date": "2026-02-09"
  }
]
$fixtures$::jsonb);

-- Resolve only the uniquely matching registry entry; the registry is seeded separately.
UPDATE opportunity_seed AS seed SET source_index_id = (
  SELECT CASE WHEN count(*) = 1 THEN min(id) ELSE NULL END
  FROM public.website_indexes
  WHERE rtrim(index_url, '/') = CASE seed.website_id
    WHEN 'engage-victoria' THEN 'https://engage.vic.gov.au/project'
    WHEN 'dcceew-consult' THEN 'https://consult.dcceew.gov.au/find-consultations'
  END
);

INSERT INTO public.websites (id, tags) VALUES
  ('engage-victoria', ARRAY['Login required', 'Online submission']),
  ('dcceew-consult', ARRAY['Online submission'])
ON CONFLICT (id) DO UPDATE SET tags = EXCLUDED.tags;

-- Create history first, then lock in canonical URL order like the scraper.
INSERT INTO public.article_history (source_url, title, upload_date, source_index_id)
SELECT source_url, title, upload_date, source_index_id FROM opportunity_seed ORDER BY source_url
ON CONFLICT (source_url) DO NOTHING;

SELECT source_url FROM public.article_history
WHERE source_url IN (SELECT source_url FROM opportunity_seed)
ORDER BY source_url FOR UPDATE;

WITH saved AS (
  INSERT INTO public.opportunities (id, title, full_text, source_url, website_id, source_org, jurisdiction, start_date, submission_deadline, submission_deadline_precision, category, tags, summary, location)
  SELECT seed.id, seed.title, seed.full_text, seed.source_url, seed.website_id, seed.source_org, seed.jurisdiction, seed.start_date, seed.submission_deadline, seed.submission_deadline_precision, seed.category, seed.tags, seed.summary, seed.location
  FROM opportunity_seed AS seed
  JOIN public.article_history AS history USING (source_url)
  WHERE NOT history.deleted
  ORDER BY seed.source_url
  ON CONFLICT (source_url) DO UPDATE SET
    title = EXCLUDED.title,
    full_text = EXCLUDED.full_text,
    website_id = EXCLUDED.website_id,
    source_org = EXCLUDED.source_org,
    jurisdiction = EXCLUDED.jurisdiction,
    start_date = EXCLUDED.start_date,
    submission_deadline = EXCLUDED.submission_deadline,
    submission_deadline_precision = EXCLUDED.submission_deadline_precision,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    summary = EXCLUDED.summary,
    location = EXCLUDED.location
  RETURNING source_url, title
), remembered AS (
  UPDATE public.article_history AS history SET
    title = saved.title,
    upload_date = COALESCE(history.upload_date, seed.upload_date),
    source_index_id = COALESCE(history.source_index_id, seed.source_index_id),
    hash = encode(sha256(convert_to((to_jsonb(seed) - 'upload_date' - 'source_index_id')::text, 'UTF8')), 'hex')
  FROM saved JOIN opportunity_seed AS seed USING (source_url)
  WHERE history.source_url = saved.source_url AND NOT history.deleted
  RETURNING history.source_url
)
SELECT (SELECT count(*) FROM saved)::integer AS seeded,
       ((SELECT count(*) FROM opportunity_seed) - (SELECT count(*) FROM saved))::integer AS skipped,
       (SELECT count(*) FROM remembered)::integer AS history;
