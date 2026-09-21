(() => {
  function slugWords(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  }
  function slugifyKebab(text) { return slugWords(text).join('-'); }
  function slugifyCamel(text) {
    return slugWords(text).map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join('');
  }

  const SKIP_CLASSES = ['govuk-back-link', 'govuk-phase-banner', 'govuk-header', 'govuk-footer', 'govuk-skip-link', 'govuk-breadcrumbs'];
  const SKIP_TAGS = new Set(['header', 'footer', 'nav']);

  function shouldSkip(el) {
    if (SKIP_TAGS.has(el.tagName.toLowerCase())) return true;
    return SKIP_CLASSES.some(cls => el.classList.contains(cls));
  }

  function extractFormGroup(el) {
    const hintEl = el.querySelector(':scope > .govuk-hint, :scope > fieldset > .govuk-hint');
    const hintText = hintEl?.textContent.trim();

    const radiosEl = el.querySelector('.govuk-radios');
    if (radiosEl) {
      const legend = el.querySelector('legend');
      const legendText = legend?.textContent.trim().replace(/\s+/g, ' ');
      const items = [...radiosEl.querySelectorAll('.govuk-radios__item')]
        .map(item => {
          const inp = item.querySelector('input[type="radio"]');
          const lbl = item.querySelector('label');
          return { value: inp?.value || slugifyKebab(lbl?.textContent.trim()), text: lbl?.textContent.trim() };
        }).filter(i => i.text);
      return {
        component: 'Radios', nunjucksMacro: 'govukRadios',
        name: slugifyCamel(legendText),
        fieldset: { legend: { text: legendText } },
        ...(hintText ? { hint: { text: hintText } } : {}),
        items
      };
    }

    const checkboxesEl = el.querySelector('.govuk-checkboxes');
    if (checkboxesEl) {
      const legend = el.querySelector('legend');
      const legendText = legend?.textContent.trim().replace(/\s+/g, ' ');
      const items = [...checkboxesEl.querySelectorAll('.govuk-checkboxes__item')]
        .map(item => {
          const inp = item.querySelector('input[type="checkbox"]');
          const lbl = item.querySelector('label');
          return { value: inp?.value || slugifyKebab(lbl?.textContent.trim()), text: lbl?.textContent.trim() };
        }).filter(i => i.text);
      return {
        component: 'Checkboxes', nunjucksMacro: 'govukCheckboxes',
        name: slugifyCamel(legendText),
        fieldset: { legend: { text: legendText } },
        ...(hintText ? { hint: { text: hintText } } : {}),
        items
      };
    }

    const dateInputEl = el.querySelector('.govuk-date-input');
    if (dateInputEl) {
      const legend = el.querySelector('legend');
      const legendText = legend?.textContent.trim().replace(/\s+/g, ' ');
      return {
        component: 'Date input', nunjucksMacro: 'govukDateInput',
        id: slugifyKebab(legendText),
        namePrefix: slugifyCamel(legendText),
        fieldset: { legend: { text: legendText } },
        ...(hintText ? { hint: { text: hintText } } : {})
      };
    }

    const fileUploadEl = el.querySelector('.govuk-file-upload');
    if (fileUploadEl) {
      const lbl = el.querySelector('label.govuk-label');
      const labelText = lbl?.textContent.trim();
      return {
        component: 'File upload', nunjucksMacro: 'govukFileUpload',
        id: fileUploadEl.id || slugifyKebab(labelText),
        name: fileUploadEl.name || slugifyCamel(labelText),
        label: { text: labelText },
        ...(hintText ? { hint: { text: hintText } } : {})
      };
    }

    const textareaEl = el.querySelector('.govuk-textarea');
    if (textareaEl) {
      const lbl = el.querySelector('label.govuk-label');
      const labelText = lbl?.textContent.trim();
      return {
        component: 'Textarea', nunjucksMacro: 'govukTextarea',
        id: textareaEl.id || slugifyKebab(labelText),
        name: textareaEl.name || slugifyCamel(labelText),
        label: { text: labelText },
        ...(hintText ? { hint: { text: hintText } } : {})
      };
    }

    const selectEl = el.querySelector('.govuk-select');
    if (selectEl) {
      const lbl = el.querySelector('label.govuk-label');
      const labelText = lbl?.textContent.trim();
      return {
        component: 'Select', nunjucksMacro: 'govukSelect',
        id: selectEl.id || slugifyKebab(labelText),
        name: selectEl.name || slugifyCamel(labelText),
        label: { text: labelText },
        ...(hintText ? { hint: { text: hintText } } : {})
      };
    }

    const inputEl = el.querySelector('.govuk-input');
    if (inputEl) {
      const lbl = el.querySelector('label.govuk-label');
      const labelText = lbl?.textContent.trim();
      return {
        component: 'Text input', nunjucksMacro: 'govukInput',
        id: inputEl.id || slugifyKebab(labelText),
        name: inputEl.name || slugifyCamel(labelText),
        label: { text: labelText },
        ...(hintText ? { hint: { text: hintText } } : {})
      };
    }

    return null;
  }

  function extractBlocks(container) {
    const blocks = [];

    for (const el of container.children) {
      if (shouldSkip(el)) continue;
      const tag = el.tagName.toLowerCase();

      // Panel (confirmation) — check before headings; panel contains an h1
      if (el.classList.contains('govuk-panel')) {
        const titleEl = el.querySelector('.govuk-panel__title');
        const bodyEl = el.querySelector('.govuk-panel__body');
        blocks.push({
          component: 'Panel', nunjucksMacro: 'govukPanel',
          titleText: titleEl?.textContent.trim() ?? '',
          text: bodyEl?.textContent.trim() ?? ''
        });
        continue;
      }

      // Error summary
      if (el.classList.contains('govuk-error-summary')) {
        const titleEl = el.querySelector('.govuk-error-summary__title');
        const errorLinks = [...el.querySelectorAll('.govuk-error-summary__list a')]
          .map(a => ({ text: a.textContent.trim() }));
        blocks.push({
          component: 'Error summary', nunjucksMacro: 'govukErrorSummary',
          titleText: titleEl?.textContent.trim() ?? 'There is a problem',
          errorList: errorLinks
        });
        continue;
      }

      // Headings
      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1]);
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        if (text) blocks.push({ style: 'Headings', level, text });
        continue;
      }

      // Paragraphs
      if (tag === 'p' && el.classList.contains('govuk-body')) {
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        if (text) blocks.push({ style: 'Paragraphs', text });
        continue;
      }

      // Button (element or link styled as button)
      if (el.classList.contains('govuk-button')) {
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        if (text) blocks.push({ component: 'Button', nunjucksMacro: 'govukButton', text });
        continue;
      }

      // Standalone link (not back link, not button)
      if (tag === 'a' && el.classList.contains('govuk-link')) {
        const text = el.textContent.trim();
        if (text) blocks.push({ style: 'Links', text });
        continue;
      }

      // Form group (inputs, radios, checkboxes, etc.)
      if (el.classList.contains('govuk-form-group')) {
        const formBlock = extractFormGroup(el);
        if (formBlock) blocks.push(formBlock);
        continue;
      }

      // Form element: recurse into children, handling form-group children and buttons
      if (tag === 'form') {
        blocks.push(...extractBlocks(el));
        continue;
      }

      // Recurse into layout containers
      if (['div', 'section', 'article', 'fieldset'].includes(tag)) {
        blocks.push(...extractBlocks(el));
      }
    }

    return blocks;
  }

  // Collect nextSteps from form action and button/link hrefs
  function extractNextSteps(main) {
    const steps = [];
    const form = main.querySelector('form');
    if (form?.action) {
      try {
        const url = new URL(form.action);
        steps.push({ action: 'Continue', goToPage: url.pathname });
      } catch (_) {}
    }
    // Link-style buttons (a.govuk-button with href)
    for (const a of main.querySelectorAll('a.govuk-button[href]')) {
      const href = a.getAttribute('href');
      if (href && href !== '#') {
        steps.push({ action: a.textContent.trim().replace(/\s+/g, ' '), goToPage: href });
      }
    }
    return steps;
  }

  const main = document.querySelector('main');
  if (!main) return null;

  const content = extractBlocks(main);

  const fieldComponents = new Set(['Radios', 'Checkboxes', 'Text input', 'Textarea', 'Select', 'Date input', 'File upload']);
  const hasPanel = content.some(b => b.component === 'Panel');
  const hasForm = content.some(b => fieldComponents.has(b.component));
  const pageType = hasPanel ? 'confirmation' : hasForm ? 'form' : 'content';

  const titleBlock = content.find(b => (b.style === 'Headings' && b.level === 1) || b.component === 'Panel');
  const title = titleBlock?.component === 'Panel' ? titleBlock.titleText : (titleBlock?.text ?? null);

  return [{
    metadata: {
      urlPath: window.location.pathname,
      title,
      pageType
    },
    content,
    nextSteps: extractNextSteps(main)
  }];
})()
