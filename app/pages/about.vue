<script setup lang="ts">
import type { PageSectionNavItem } from '~/types/page-section-nav'

useSeoMeta({
  title: 'About ECHO',
  description: 'Learn how the Melbourne Centre for Law and the Environment brings public opportunities to have your say together in one place.'
})

const sectionNavItems: PageSectionNavItem[] = [
  { label: 'About ECHO', href: '#about-echo' },
  {
    label: 'FAQ',
    href: '#faq',
    children: [
      { label: 'Types of processes', href: '#process-types' },
      { label: 'Topic categories', href: '#topic-categories' },
      { label: 'How to use this website', href: '#using-echo' }
    ]
  }
]
</script>

<template>
  <div class="info-page">
    <div class="container info-layout">
      <PageSectionNav :items="sectionNavItems" />

      <article id="about-echo" class="info-content about-content">
        <h1>Find the opportunity to have your say.</h1>
        <p class="about-acknowledgement"><em>MCLE acknowledges the Traditional Owners of the unceded lands on which we work, learn and live. This project was developed at the University of Melbourne, on the unceded lands of the Wurundjeri Woi Wurrung and Bunurong peoples. We pay our respects to Elders past, present and future, and recognise the enduring connection of Aboriginal and Torres Strait Islander peoples to Country, waters and ecosystems across Australia.</em></p>
        <div class="about-body">
          <p>This website is a University of Melbourne initiative developed through the Melbourne Centre for Law and the Environment (MCLE). It brings together public opportunities to contribute to environmental law, policy and decision-making in one searchable place.</p>
          <p>We bring together publicly available calls for submissions, consultations and inquiries from government and public-sector sources. These include:</p>
          <ol type="I">
            <li>Victorian Government consultation platforms</li>
            <li>Victorian parliamentary committees</li>
            <li>Commonwealth departments and agencies</li>
            <li>Commonwealth parliamentary committees</li>
            <li>statutory authorities and public bodies whose work affects the environment and natural resources</li>
            <li>water authorities and catchment management bodies</li>
            <li>environmental, planning, infrastructure and natural-resource agencies</li>
          </ol>
          <p>Each listing links back to the official source, where you can read the full consultation material and make your submission.<sup class="footnote-marker"><a href="#submission-disclaimer" aria-label="Read submission disclaimer">1</a></sup></p>
        </div>

        <section id="faq" class="about-faq" aria-labelledby="faq-heading">
          <h2 id="faq-heading">FAQ</h2>

          <section id="process-types" class="faq-section">
            <h3>What kinds of processes will I find?</h3>
            <p>Government consultations are often spread across different departmental, parliamentary and agency websites. This can make it difficult to know when a submission is open, who is asking for input, what is being decided, and when the opportunity closes. Our goal is to make these opportunities easier to find, understand and participate in, so that more voices can contribute to environmental decision-making.</p>
            <div class="faq-entry">
              <h4>Policy consultation</h4>
              <p>Government may ask for feedback while developing or reviewing a policy, strategy, plan or framework. A policy does not necessarily change the law, but it can strongly influence how government makes decisions and sets future priorities. For example: a biodiversity strategy, climate adaptation plan or water policy.</p>
            </div>
            <div class="faq-entry">
              <h4>Law reform</h4>
              <p>A law reform process considers whether legislation should be created, amended or replaced. You may be asked to comment on an existing Act, a proposed change to legislation or broader options for reform. For example: a statutory review of an environmental or water law.</p>
            </div>
            <div class="faq-entry">
              <h4>Parliamentary inquiry</h4>
              <p>A parliamentary committee may investigate an issue and invite individuals and organisations to provide evidence or submissions. The committee may later make findings and recommendations to Parliament or government.</p>
            </div>
            <div class="faq-entry">
              <h4>Proposed legislation</h4>
              <p>Parliamentary committees may seek views on Bills or other proposed legislative changes.</p>
              <p>A submission can help identify environmental, social, legal or practical consequences before the law is finalised.</p>
            </div>
            <div class="faq-entry">
              <h4>Regulatory consultation</h4>
              <p>Governments may consult on regulations, standards, rules or other instruments that determine how legislation works in practice.</p>
            </div>
            <div class="faq-entry">
              <h4>Agency or authority consultation</h4>
              <p>Public authorities may seek input on plans, strategies, management decisions or regulatory approaches within their area of responsibility. This may include water corporations, catchment management authorities, environmental bodies and infrastructure agencies.</p>
            </div>
          </section>

          <section id="topic-categories" class="faq-section">
            <h3>What do the topic categories mean?</h3>
            <ol class="faq-numbered-list">
              <li>
                <h4>Biodiversity &amp; ecosystems</h4>
                <p>Opportunities concerning native species, habitats, protected areas, ecological restoration, conservation and ecosystem health.</p>
              </li>
              <li>
                <h4>Climate change</h4>
                <p>Consultations concerning climate mitigation, adaptation, climate risk, emissions, resilience and the transition to a low-carbon economy.</p>
              </li>
              <li>
                <h4>First Nations &amp; cultural heritage</h4>
                <p>Processes concerning First Nations rights, interests, knowledge, Country, cultural heritage and participation in environmental and natural-resource governance. Please consider that First Nations interests may also be relevant across all other categories on this website.</p>
              </li>
              <li>
                <h4>Water &amp; resources</h4>
                <p>Opportunities concerning rivers, groundwater, water allocation and management, mining, natural resources and the governance of shared environmental resources.</p>
              </li>
              <li>
                <h4>Communities &amp; environment</h4>
                <p>Processes concerning the relationship between environmental decisions and communities, including health, liveability, regional communities, public participation and environmental impacts.</p>
              </li>
            </ol>
          </section>

          <section id="using-echo" class="faq-section">
            <h3>How to use this website</h3>
            <ol class="faq-numbered-list faq-steps">
              <li>
                <h4>Find an opportunity</h4>
                <p>Search by topic, organisation or keyword, or use the filters to browse current opportunities. You can narrow results by jurisdiction, topic and whether submissions are still open.</p>
              </li>
              <li>
                <h4>Understand what is being decided</h4>
                <p>Open an opportunity to see a plain-English summary of the consultation, who is running it, what they are asking about and when submissions close.</p>
              </li>
              <li>
                <h4>Read the official material</h4>
                <p>Follow the links to the original consultation page and key documents. You do not need to respond to every question. Focus on the issues where your experience, knowledge or perspective can contribute.</p>
              </li>
              <li>
                <h4>Have your say</h4>
                <p>Prepare your submission and send it directly to the government body, parliamentary committee or agency running the consultation.</p>
              </li>
            </ol>
          </section>
        </section>

        <footer id="submission-disclaimer" class="about-disclaimer" tabindex="-1" aria-label="Submission disclaimer">
          <p><sup aria-hidden="true">1</sup> This website does not run the consultations and does not receive submissions on behalf of government. We help you find and understand the opportunity. Your submission is made directly to the government body, parliamentary committee or agency responsible for the consultation.</p>
        </footer>
      </article>
    </div>
  </div>
</template>
