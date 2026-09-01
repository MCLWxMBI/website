<script setup lang="ts">
import type { PageSectionNavItem } from '~/types/page-section-nav'

useSeoMeta({
  title: 'Public participation resources',
  description: 'Learn how public submissions work and how to make a clear, useful contribution to an Australian public consultation.'
})

const sectionNavItems: PageSectionNavItem[] = [
  { label: 'Public submissions', href: '#public-submissions' },
  { label: 'Getting started', href: '#getting-started' },
  { label: 'Structure your submission', href: '#submission-structure' },
  { label: 'Influencing a decision', href: '#influencing-decisions' },
  { label: 'After you submit', href: '#after-submission' },
  { label: 'Participation checklist', href: '#participation-checklist' },
  { label: 'For consultation designers', href: '#consultation-designers' },
  { label: 'Further readings', href: '#further-readings' }
]

const checklistItems = [
  'I know what decision or review I am responding to.',
  'I have chosen the question or issue I can genuinely contribute to.',
  'My main message is clear in the first few paragraphs.',
  'I have described the problem in concrete terms.',
  'I have explained why it matters.',
  'I have separated my own experience from information drawn from other sources.',
  'I have made at least one clear recommendation.',
  'My recommendation says who should do what.',
  'I have written in language that a non-expert can understand.',
  'I have checked the deadline, submission method and any publication or privacy requirements.'
]
</script>

<template>
  <div class="info-page">
    <div class="container info-layout">
      <PageSectionNav :items="sectionNavItems" />

      <article class="info-content resource-content">
        <header class="resource-intro">
          <p class="section-kicker">Public participation guide</p>
          <h1>A guide for taking part in Australian public consultations</h1>
          <p>This page explains how submissions work and how to make your contribution clear and useful. It does not
            constitute legal advice.</p>
          <p class="resource-encouragement">You do not need to be a lawyer, academic or technical expert to make a
            useful submission.</p>
        </header>

        <section id="public-submissions" class="resource-section">
          <h2>What is a public submission?</h2>
          <p>A public submission is a way of telling a government, parliamentary committee, independent reviewer or
            public inquiry what you think about an issue they are considering. It can include your experience,
            knowledge, concerns, evidence, ideas and recommendations.</p>
          <h3>What is its purpose?</h3>
          <p>To explain what is working or not working, why it matters and what you think should change.</p>
        </section>

        <section id="getting-started" class="resource-section">
          <h2>Start by answering three questions</h2>
          <ol class="resource-steps">
            <li>
              <h3>What are they deciding?</h3>
              <p>Find the consultation questions, discussion paper or terms of reference. You do not need to understand
                the whole law or policy. Identify the part that relates to something you know, experience or care about.
              </p>
            </li>
            <li>
              <h3>What can you contribute?</h3>
              <p>Your contribution might be personal experience, community knowledge, professional experience, research,
                data, cultural knowledge, observations about how a system works in practice, or a problem that
                decision-makers may not be seeing.</p>
            </li>
            <li>
              <h3>What would you like them to do differently?</h3>
              <p>A strong submission does more than say that something is wrong. It gives the decision-maker a clear
                idea of what could be changed, improved or protected.</p>
            </li>
          </ol>
        </section>

        <section id="submission-structure" class="resource-section">
          <h2>A simple structure for your submission</h2>
          <ol class="resource-steps">
            <li>
              <h3>Who are you, and why are you writing?</h3>
              <p>Use two or three sentences. You do not need to prove that you are an expert. Explain your connection to
                the issue.</p>
              <blockquote><strong>Example:</strong> I live in a regional community that depends on this river system,
                and I am making this submission because changes to water availability directly affect our community and
                local ecosystems.</blockquote>
            </li>
            <li>
              <h3>State your main message</h3>
              <p>Give the reader one or two sentences that make your position immediately clear.</p>
              <p class="resource-prompt">Ask yourself: if the reviewer only remembers two lines from my submission, what
                do I want those lines to say?</p>
            </li>
            <li>
              <h3>Describe the problem</h3>
              <p>Focus on one or a small number of concrete problems. A submission is usually stronger when it explains
                a few issues properly rather than listing many issues without detail.</p>
              <blockquote><strong>Example:</strong> Water information may technically be public, but it can be difficult
                for non-specialists to find, understand or connect to the decision being made.</blockquote>
            </li>
            <li>
              <h3>Explain why the problem matters</h3>
              <p>Show the consequences of the problem for people, communities, Country, ecosystems, accountability or
                future decision-making.</p>
              <blockquote><strong>Example:</strong> If people cannot understand the information behind a decision, they
                cannot meaningfully scrutinise it, challenge assumptions or take part in consultation.</blockquote>
            </li>
            <li>
              <h3>Give your evidence</h3>
              <p>Evidence does not only mean academic research. Useful evidence can include personal experience,
                community knowledge, examples, public documents, data, research, photographs or records of what
                happened.</p>
              <p class="resource-prompt">Be clear about what you know directly and what comes from another source.</p>
            </li>
            <li>
              <h3>Make a recommendation</h3>
              <p>Say clearly what you want the decision-maker to do. Try to make the recommendation realistic and
                specific.</p>
              <p class="resource-prompt">A useful formula is: I recommend that <em>(who)</em> should <em>(do or not do
                  what)</em> so that <em>(public or nature benefit)</em>.</p>
            </li>
          </ol>

          <div class="resource-callout">
            <h3>What you do not need to do</h3>
            <ul>
              <li>You do not need to answer every consultation question.</li>
              <li>You do not need to read an entire Act of Parliament.</li>
              <li>You do not need to use legal or academic language.</li>
              <li>You do not need a university degree or professional title.</li>
              <li>You do not need to produce new research.</li>
              <li>You do not need to agree with other submissions.</li>
              <li>You do not need to write a long document.</li>
            </ul>
            <p>A short, clear submission based on genuine knowledge or experience can be more useful than a long
              document that does not identify a specific problem or recommendation.</p>
          </div>
        </section>

        <section id="influencing-decisions" class="resource-section">
          <h2>How can a submission influence a decision?</h2>
          <p>A submission does not guarantee that the government will accept your recommendation. Its value is that it
            can become part of the evidence considered by the inquiry or review.</p>
          <p>The easiest submissions for reviewers to use are those that give them a clear finding, example or
            recommendation that can be compared with other
            evidence.</p>
          <p>Consider these three versions:</p>
          <ol class="comparison-list">
            <li>The information system is confusing.</li>
            <li>The current information framework makes it difficult for non-specialists to identify the evidence
              underlying particular water-management decisions.</li>
            <li>Require decision-makers to publish, alongside significant water-management decisions, a plain-English
              evidence statement identifying the information relied on, relevant uncertainty, key modelling assumptions
              and how that information affected the decision.</li>
          </ol>
          <p>The third example is more useful because it identifies a clear finding and makes an evidence-based
            recommendation.</p>
        </section>

        <section id="after-submission" class="resource-section">
          <h2>What should happen after you submit?</h2>
          <p>Good governance requires more than simply allowing people to upload a document. People should be able to
            understand what is being decided, what evidence is being used, how their contribution will be considered
            and, where possible, how the final decision responds to the issues raised.</p>
        </section>

        <section id="participation-checklist" class="resource-section">
          <h2>A participation checklist</h2>
          <ul class="participation-checklist">
            <li v-for="item in checklistItems" :key="item">{{ item }}</li>
          </ul>
        </section>

        <section id="consultation-designers" class="resource-section">
          <h2>For governments and consultation designers</h2>
          <p>Meaningful participation does not begin with the submission form. Before asking people to participate,
            public bodies should make the decision-making process accessible. This reflects Principle 10 of the Rio
            Declaration.</p>
          <p>Public participation should not be reserved for people who already know how government works. A
            consultation is more democratic and more useful when all citizens can understand the issue, identify where
            their knowledge matters, and see a realistic pathway between participation and decision-making.</p>
        </section>

        <section id="further-readings" class="resource-section">
          <h2>Further readings</h2>
          <ul class="resource-list">
            <li><a href="https://law.unimelb.edu.au/centres/mcle#research" target="_blank" rel="noopener"><span>Research
                  on key themes in environment-related law</span><span aria-hidden="true">↗</span><span class="sr-only">
                  (opens on the University of Melbourne website in a new tab)</span></a></li>
            <li><a href="https://law.unimelb.edu.au/centres/mcle/research/policy-briefs" target="_blank"
                rel="noopener"><span>Policy briefs on current issues in environment-related law</span><span
                  aria-hidden="true">↗</span><span class="sr-only"> (opens on the University of Melbourne website in a
                  new tab)</span></a></li>
          </ul>
          <p class="resource-attribution"><em>This page was prepared by MCLE to help bring academia and the wider
              community together in support of good governance of natural resources, and to foster a better public
              understanding of multispecies relationships in Australia.</em></p>
        </section>
      </article>
    </div>
  </div>
</template>
