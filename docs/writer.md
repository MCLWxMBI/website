# Writing and publishing ECHO pages

This guide explains how to edit the About and Resources pages. You do not need
to know how websites are built. The editor works much like a simple word
processor, with a preview beside or below it showing how the public page will
look.

## Open a page for editing

1. Sign in through **Login for Admins** in the ECHO header.
2. On the admin panel, open the **Pages** tab.
3. Choose **Edit page** for About or Resources.

The first time a page is opened, the editor contains an **original template**.
This is prepared starting content, but it is not public until you select
**Save and publish**. The status above the editor tells you where you are:

- **Not published** means the original template is ready but the database does
  not yet have a public copy.
- **Unsaved changes** means you have changed something since the last save.
- **Saved** followed by a time means the displayed content is published.

## Make ordinary text changes

Click in the editor where you want to type. You can select words by dragging
over them with the mouse, or hold Shift while using the arrow keys.

The toolbar provides familiar writing controls:

- **Undo** reverses your most recent change. **Redo** restores an undone change.
- **Paragraph** changes the selected line to ordinary text or a heading.
- **Bold** adds strong emphasis. **Italic** adds lighter emphasis.
- The list buttons create bulleted or numbered lists.
- **Blockquote** marks a quotation as separate from the surrounding text.
- **Link** turns selected words into a link.
- **Remove format** clears formatting from selected text when it has become
  difficult to correct.

Use headings to divide the page into meaningful parts. Heading 1 is the page
title. Use Heading 2 for main sections and Heading 3 for sections within them.
Heading 4 can label a small item but does not appear in the page navigation.
Avoid choosing a heading merely to make text look larger.

## Add links

Select words that explain where the link goes, then choose the link button.
Paste the complete address and confirm it. Prefer labels such as “Read the
consultation guide” instead of “click here”. After adding a link, check it in
the public preview or open the public page after saving.

## Add an image from a link

Open **Insert an image from a link** above the editor. Enter either a complete
address beginning with `https://` or an address on the ECHO site beginning with
`/`. ECHO does not upload image files in this version.

Alternative text briefly describes useful information in the image for someone
who cannot see it. Describe its purpose rather than starting with “image of”.
For example, “Map showing the consultation area around Port Phillip Bay” is
more useful than “Map”. Alternative text is required. After inserting the
image, replace “Image caption” in the editor with a useful caption.

## Insert an ECHO styled block

Styled blocks preserve the established appearance of the About and Resources
pages. First click in the editor at the exact place where the new block should
go. Choose a block from **Insert a styled block**, then select **Insert block**.
Replace its sample words with your own.

About blocks include the main About body, an acknowledgment, an FAQ group, an
FAQ subsection, an FAQ entry, a numbered FAQ list, a Roman-numeral list, and a
disclaimer. Resources blocks include a content section, introductory header,
encouragement, prompt, numbered steps, comparison list, checklist, green
callout, reading links, and attribution.

Insert a whole block and edit inside it. Deleting only part of a block can leave
an empty box or an unexpected gap. Use Undo if the result does not look right.

## Control “On this page” navigation

The navigation panel finds Heading 1, Heading 2, and Heading 3 text in document
order. For each heading you can:

- Include or exclude it from **On this page**.
- Enter a shorter label if the full heading is too long for navigation.
- Place it under an earlier top-level heading. Only one level of nesting is
  available.

Changing this panel also changes the page content that will be saved. Use short,
distinct labels, and keep the order of headings logical. If two headings use the
same wording, make their short labels distinct.

A nested heading must come after its parent. If you cut and paste a nested
heading above its parent, ECHO makes that heading top-level when you save so it
does not disappear from the public navigation.

## Preview, restore, and publish

The **Public preview** is the best reference for layout, spacing, and styled
blocks. Review the entire preview before publishing, especially after moving a
list or deleting a section.

**Reload original template** replaces the editor with ECHO's prepared starting
document. If you have made changes, the page asks before discarding them. On an
unpublished, untouched template it reloads without a warning. Reloading never
publishes anything by itself.

Select **Save and publish** when the page is ready. An unpublished original
template can be saved without first editing it. A successful save updates the
public page immediately for its next visit or refresh. If saving fails, the
previously published page remains unchanged.

The editor and its writing controls pause briefly while saving. Wait for the
success or error message before continuing to edit. This prevents changes made
during a slow save from being lost.

If the message mentions a security token, reload the editor page and try the
save again. If it reports invalid content, check that the document still has a
title and meaningful text. A database error usually needs help from the person
who maintains ECHO. If the editor stylesheet fails to load, check the internet
connection and use **Retry loading editor**.

## Before publishing

- Read the page from beginning to end in the public preview.
- Check that headings describe the sections beneath them and follow a sensible
  order.
- Check the “On this page” labels and nesting.
- Use meaningful link wording and test important links.
- Give every image useful alternative text and an accurate caption.
- Make sure instructions do not depend only on colour or position.
- Check lists for missing or duplicated items.
- Confirm that names, dates, acknowledgments, and source attributions are exact.

## Small glossary

- **Editor:** the writing area where you change the page.
- **Toolbar:** the row of writing and formatting buttons above the editor.
- **Template:** prepared starting content that can be edited and published.
- **Styled block:** a reusable piece of page layout designed for a particular
  kind of content.
- **Preview:** an unsaved view of how the content will look publicly.
- **Publish:** save the editor content to the database so the public page uses it.
- **Alternative text:** a written description that communicates an image's
  useful information to people using screen readers or when an image cannot load.
