var ENTER_ONLY_ATTRS = ['up-autosubmit', 'up-watch', 'up-watch-delay', 'up-validate', 'up-validate-delay'];

function installEnterOnly(root) {
  try {
    root = root || document;
    var form = (root.querySelector && root.querySelector('#theform form')) || document.querySelector('#theform form');
    if (!form) return 0;

    var q = form.querySelector ? form.querySelector('input[name="q"]') : null;
    if (!q) return 0;

    var dataset = q.dataset || {};
    if (dataset.enterOnly === '1' || q.getAttribute('data-enter-only') === '1') return 0;

    var originalAttrs = {};
    for (var i = 0; i < ENTER_ONLY_ATTRS.length; i++) {
      var attr = ENTER_ONLY_ATTRS[i];
      if (q.hasAttribute && q.hasAttribute(attr)) {
        originalAttrs[attr] = q.getAttribute(attr);
        q.removeAttribute(attr);
      }
    }

    var start = null;
    var end = null;
    try { start = q.selectionStart; end = q.selectionEnd; } catch (_selErr) {}

    var q2 = q.cloneNode(true);
    q2.value = q.value;
    if (q2.dataset) {
      q2.dataset.enterOnly = '1';
      try { q2.dataset.enterOnlyAttrs = JSON.stringify(originalAttrs || {}); } catch (_jsonErr) {}
    }
    try { q2.setAttribute('data-enter-only', '1'); } catch (_attrErr) {}
    try { q2.setAttribute('data-enter-only-attrs', JSON.stringify(originalAttrs || {})); } catch (_attrErr2) {}

    if (q.parentNode) q.parentNode.replaceChild(q2, q);

    try { q2.focus(); } catch (_focusErr) {}
    if (start != null && end != null) {
      try { q2.setSelectionRange(start, end); } catch (_rangeErr) {}
    }

    q2.addEventListener('keydown', function (ev) {
      var key = ev && (ev.key || ev.keyCode);
      if (key === 'Enter' || key === 13) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        try {
          if (window.up && typeof window.up.submit === 'function') {
            window.up.submit(form);
          } else if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
          } else {
            form.submit();
          }
        } catch (_submitErr) {
          try {
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
            } else {
              form.submit();
            }
          } catch (_fallbackErr) {}
        }
      }
    }, true);

    try {
      if (window.console && typeof window.console.log === 'function') {
        console.log('[Sanskrit Ext] Auto-search disabled; press Enter to search.');
      }
    } catch (_logErr) {}
    return 1;
  } catch (_err) {
    return 0;
  }
}

function restoreAutoSearch(root) {
  try {
    root = root || document;
    var form = (root.querySelector && root.querySelector('#theform form')) || document.querySelector('#theform form');
    if (!form) return 0;

    var q = form.querySelector ? form.querySelector('input[name="q"]') : null;
    if (!q) return 0;

    var dataset = q.dataset || {};
    var isEnterOnly = dataset.enterOnly === '1' || q.getAttribute('data-enter-only') === '1';
    if (!isEnterOnly) {
      if (!q.hasAttribute || !q.hasAttribute('up-autosubmit')) {
        try { q.setAttribute('up-autosubmit', 'true'); } catch (_setAuto) {}
      }
      if (!q.hasAttribute || !q.hasAttribute('up-watch-delay')) {
        try { q.setAttribute('up-watch-delay', '500'); } catch (_setDelay) {}
      }
      return 0;
    }

    var rawAttrs = dataset.enterOnlyAttrs || q.getAttribute('data-enter-only-attrs');
    var attrMap = {};
    if (rawAttrs) {
      try { attrMap = JSON.parse(rawAttrs); } catch (_parseErr) { attrMap = {}; }
    }

    var start = null;
    var end = null;
    try { start = q.selectionStart; end = q.selectionEnd; } catch (_selErr) {}

    var q2 = q.cloneNode(true);
    q2.value = q.value;
    if (q2.dataset) {
      try { delete q2.dataset.enterOnly; } catch (_del1) {}
      try { delete q2.dataset.enterOnlyAttrs; } catch (_del2) {}
    }
    try { q2.removeAttribute('data-enter-only'); } catch (_remAttr) {}
    try { q2.removeAttribute('data-enter-only-attrs'); } catch (_remAttr2) {}

    var keys = attrMap && typeof attrMap === 'object' ? Object.keys(attrMap) : [];
    if (keys.length) {
      for (var i = 0; i < keys.length; i++) {
        var attr = keys[i];
        try {
          if (attrMap[attr] != null) q2.setAttribute(attr, attrMap[attr]);
        } catch (_setAttrErr) {}
      }
    } else {
      try { q2.setAttribute('up-autosubmit', 'true'); } catch (_autoErr) {}
      if (!q2.hasAttribute || !q2.hasAttribute('up-watch-delay')) {
        try { q2.setAttribute('up-watch-delay', '500'); } catch (_delayErr) {}
      }
    }

    if (q.parentNode) q.parentNode.replaceChild(q2, q);

    try { q2.focus(); } catch (_focusErr) {}
    if (start != null && end != null) {
      try { q2.setSelectionRange(start, end); } catch (_rangeErr) {}
    }
    return 1;
  } catch (_err) {
    return 0;
  }
}

(function () {
  'use strict';

  var TERM_PATTERN = /dictionary|wörterbuch/i;
  var LONG_ARTICLE_THRESHOLD = 50;
  var dictionaryCache = null;
  var defaultSettingsCache = null;
  var currentSettings = null;
  var settingsReady = false;
  var scheduled = false;
  var pendingRoot = null;
  var originalResultsMarkup = new WeakMap();
  var resultStylesInjected = false;
  var articleStates = new WeakMap();
  var settingsGeneration = 0;

  loadSettings();

  window.addEventListener('load', function () {
    run(document);

    document.addEventListener('up:fragment:inserted', function (e) {
      var target = (e && e.target && e.target.nodeType) ? e.target : document;
      try { applyAutosearchSetting(target); } catch (_err) {}
      scheduleRun(target);
    }, true);

    try {
      var mo = new MutationObserver(function () {
        scheduleRun(document);
      });
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (_err2) {}
  }, true);

  function loadSettings() {
    var defaults = getDefaultSettings(document);
    updateCurrentSettings(sanitizeSettings(defaults));

    if (!(chrome && chrome.storage && chrome.storage.sync)) {
      settingsReady = true;
      run(document);
      return;
    }

    try {
      chrome.storage.sync.get(defaults, function (stored) {
        var data = stored || {};
        if (chrome.runtime && chrome.runtime.lastError) {
          data = defaults;
        }
        try {
          updateCurrentSettings(sanitizeSettings(data));
        } catch (_err) {
          updateCurrentSettings(sanitizeSettings(defaults));
        }
        settingsReady = true;
        run(document);
      });
    } catch (_errOuter) {
      updateCurrentSettings(sanitizeSettings(defaults));
      settingsReady = true;
      run(document);
    }

    try {
      chrome.storage.onChanged.addListener(function (_changes, areaName) {
        if (areaName !== 'sync') return;
        var defaults = getDefaultSettings(document);
        chrome.storage.sync.get(defaults, function (stored) {
          var data = stored || defaults;
          if (chrome.runtime && chrome.runtime.lastError) {
            data = defaults;
          }
          try {
            updateCurrentSettings(sanitizeSettings(data));
          } catch (_errSan) {
            updateCurrentSettings(sanitizeSettings(defaults));
          }
          if (settingsReady) scheduleRun(document);
        });
      });
    } catch (_errListener) {}
  }

  function run(root) {
    if (!settingsReady) return;
    var target = (root && root.nodeType) ? root : document;
    try { applyPreselection(target); } catch (_err1) {}
    try { applyAutosearchSetting(target); } catch (_err2) {}
    try { applyDictionaryOrder(target); } catch (_err3) {}
    try { applyResultPresentation(target); } catch (_err4) {}
  }

  function scheduleRun(root) {
    if (!settingsReady) return;
    pendingRoot = (root && root.nodeType) ? root : document;
    if (scheduled) {
      if (pendingRoot !== document) pendingRoot = document;
      return;
    }
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      var target = pendingRoot && pendingRoot.nodeType ? pendingRoot : document;
      pendingRoot = null;
      run(target);
    }, 120);
  }

  function findLabelFor(cb) {
    if (!cb) return null;
    var id = cb.id || '';
    if (id) {
      try {
        var selector = 'label[for="' + id.replace(/"/g, '\\"') + '"]';
        var direct = document.querySelector(selector);
        if (direct) return direct;
      } catch (_err) {}
    }

    var next = cb.nextElementSibling;
    if (next && next.tagName && next.tagName.toUpperCase() === 'LABEL') return next;

    var node = cb.parentNode;
    while (node && node !== document) {
      if (node.tagName && node.tagName.toUpperCase() === 'LABEL') return node;
      node = node.parentNode;
    }
    return null;
  }

  function applyPreselection(root) {
    if (!currentSettings) return 0;
    var container = document.getElementById('dict-select');
    if (!container && root && root.querySelector) container = root.querySelector('#dict-select');
    if (!container) container = document;

    var checkboxes = container.querySelectorAll ? container.querySelectorAll('input[type="checkbox"][name="s"]') : [];
    if (!checkboxes || !checkboxes.length) return 0;

    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) return 0;
    }

    var desired = Array.isArray(currentSettings.preselectedDictionaries) ? currentSettings.preselectedDictionaries : [];
    if (!desired.length) return 0;

    var desiredSet = createLookup(desired);
    if (!desiredSet) return 0;

    var changed = [];
    for (var j = 0; j < checkboxes.length; j++) {
      var cb = checkboxes[j];
      if (!cb || cb.disabled) continue;
      var code = normalizeCode(cb.value || cb.getAttribute('value'));
      if (!code) continue;
      if (desiredSet[code]) {
        if (!cb.checked) {
          cb.checked = true;
          changed.push(cb);
        }
      }
    }

    if (!changed.length) return 0;
    triggerFormSubmission(container, changed);
    return changed.length;
  }

  function applyAutosearchSetting(root) {
    if (!currentSettings) return 0;
    if (currentSettings.disableAutosearch) {
      installEnterOnly(root);
    } else {
      restoreAutoSearch(root);
    }
  }

  function applyDictionaryOrder(root) {
    if (!currentSettings) return 0;
    var order = Array.isArray(currentSettings.dictionaryOrder) ? currentSettings.dictionaryOrder : [];
    if (!order.length) return 0;

    var orderMap = {};
    for (var i = 0; i < order.length; i++) {
      var key = normalizeCode(order[i]);
      if (!key && key !== '') continue;
      if (typeof orderMap[key] === 'undefined') orderMap[key] = i;
    }

    var resultNodes = document.querySelectorAll('div[id^="result-:"]');
    if (!resultNodes || !resultNodes.length) return 0;

    var container = resultNodes[0].parentNode;
    if (!container || !container.appendChild) return 0;

    var nodes = Array.prototype.slice.call(resultNodes);
    nodes.sort(function (a, b) {
      var codeA = normalizeCode(extractResultCode(a && a.id));
      var codeB = normalizeCode(extractResultCode(b && b.id));
      var idxA = (codeA != null && typeof orderMap[codeA] !== 'undefined') ? orderMap[codeA] : Number.MAX_SAFE_INTEGER;
      var idxB = (codeB != null && typeof orderMap[codeB] !== 'undefined') ? orderMap[codeB] : Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return codeA < codeB ? -1 : codeA > codeB ? 1 : 0;
    });

    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      if (node && node.parentNode === container) {
        container.appendChild(node);
      }
    }
    return nodes.length;
  }

  function triggerFormSubmission(container, changedCbs) {
    if (!changedCbs || !changedCbs.length) return;

    var form = null;
    if (container && typeof container.closest === 'function') {
      form = container.closest('form');
    }
    if (!form) form = document.querySelector('#theform form');

    if (form) {
      try {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          return;
        }
        form.submit();
        return;
      } catch (_submitErr) {}
    }

    var target = changedCbs[0];
    if (!target) return;
    try {
      var ev;
      if (typeof Event === 'function') {
        ev = new Event('change', { bubbles: true });
      } else {
        ev = document.createEvent('HTMLEvents');
        ev.initEvent('change', true, false);
      }
      target.dispatchEvent(ev);
    } catch (_evErr) {}
  }

  function getDefaultSettings(root) {
    if (!defaultSettingsCache) {
      var dictionaries = ensureDictionaryData(root);
      var order = [];
      for (var i = 0; i < dictionaries.length; i++) {
        var code = dictionaries[i] && dictionaries[i].code;
        if (code) order.push(code);
      }
      var pre = [];
      for (var j = 0; j < dictionaries.length; j++) {
        var dict = dictionaries[j];
        if (!dict) continue;
        if (TERM_PATTERN.test(String(dict.label || ''))) pre.push(dict.code);
      }
      defaultSettingsCache = {
        dictionaryOrder: order,
        preselectedDictionaries: pre,
        disableAutosearch: true,
        mergeResults: true,
        minimizeLongArticles: true
      };
    }
    return {
      dictionaryOrder: defaultSettingsCache.dictionaryOrder.slice(),
      preselectedDictionaries: defaultSettingsCache.preselectedDictionaries.slice(),
      disableAutosearch: defaultSettingsCache.disableAutosearch,
      mergeResults: defaultSettingsCache.mergeResults,
      minimizeLongArticles: defaultSettingsCache.minimizeLongArticles
    };
  }

  function ensureDictionaryData(root) {
    if (dictionaryCache && dictionaryCache.length) return dictionaryCache.slice();

    var list = [];
    if (typeof SANSKRIT_DICTIONARIES !== 'undefined' && Array.isArray(SANSKRIT_DICTIONARIES) && SANSKRIT_DICTIONARIES.length) {
      for (var i = 0; i < SANSKRIT_DICTIONARIES.length; i++) {
        var item = SANSKRIT_DICTIONARIES[i];
        if (!item) continue;
        var code = normalizeCode(item.code || item.id);
        if (!code) continue;
        list.push({ code: code, label: item.label || '' });
      }
    }

    if (!list.length) {
      try {
        var scope = (root && root.querySelectorAll) ? root : document;
        var nodes = scope.querySelectorAll('#dict-select input[type="checkbox"][name="s"]');
        for (var j = 0; j < nodes.length; j++) {
          var cb = nodes[j];
          if (!cb) continue;
          var code = normalizeCode(cb.value || cb.getAttribute('value'));
          if (!code) continue;
          var labelEl = findLabelFor(cb);
          var labelText = '';
          if (labelEl) labelText = (labelEl.textContent || labelEl.innerText || '').trim();
          list.push({ code: code, label: labelText });
        }
      } catch (_err) {}
    }

    dictionaryCache = list;
    return list.slice();
  }

  function sanitizeSettings(raw) {
    var defaults = getDefaultSettings(document);
    var order = ensureOrderIncludesAll(asArray(raw && raw.dictionaryOrder));
    if (!order.length) order = ensureOrderIncludesAll(defaults.dictionaryOrder);

    var preselected = sanitizeCodes(asArray(raw && raw.preselectedDictionaries));
    if (!preselected.length && defaults.preselectedDictionaries && defaults.preselectedDictionaries.length) {
      preselected = sanitizeCodes(defaults.preselectedDictionaries);
    }

    var disable = (raw && typeof raw.disableAutosearch === 'boolean') ? raw.disableAutosearch : defaults.disableAutosearch;
    var merge = (raw && typeof raw.mergeResults === 'boolean') ? raw.mergeResults : defaults.mergeResults;
    var minimize = (raw && typeof raw.minimizeLongArticles === 'boolean') ? raw.minimizeLongArticles : defaults.minimizeLongArticles;

    return {
      dictionaryOrder: order,
      preselectedDictionaries: preselected,
      disableAutosearch: disable,
      mergeResults: merge,
      minimizeLongArticles: minimize
    };
  }

  function updateCurrentSettings(newSettings) {
    if (!newSettings) return;
    var changed = !currentSettings || !settingsEqual(currentSettings, newSettings);
    currentSettings = {
      dictionaryOrder: Array.isArray(newSettings.dictionaryOrder) ? newSettings.dictionaryOrder.slice() : [],
      preselectedDictionaries: Array.isArray(newSettings.preselectedDictionaries) ? newSettings.preselectedDictionaries.slice() : [],
      disableAutosearch: !!newSettings.disableAutosearch,
      mergeResults: !!newSettings.mergeResults,
      minimizeLongArticles: !!newSettings.minimizeLongArticles
    };
    if (changed) settingsGeneration += 1;
  }

  function settingsEqual(a, b) {
    if (!a || !b) return false;
    return arraysEqual(a.dictionaryOrder, b.dictionaryOrder) &&
      arraysEqual(a.preselectedDictionaries, b.preselectedDictionaries) &&
      a.disableAutosearch === b.disableAutosearch &&
      a.mergeResults === b.mergeResults &&
      a.minimizeLongArticles === b.minimizeLongArticles;
  }

  function arraysEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function ensureOrderIncludesAll(order) {
    var normalized = [];
    var seen = Object.create(null);

    function push(code) {
      var key = normalizeCode(code);
      if (!key) return;
      if (seen[key]) return;
      seen[key] = true;
      normalized.push(key);
    }

    for (var i = 0; i < order.length; i++) push(order[i]);

    var dictionaries = ensureDictionaryData(document);
    for (var j = 0; j < dictionaries.length; j++) {
      push(dictionaries[j] && dictionaries[j].code);
    }

    return normalized;
  }

  function sanitizeCodes(list) {
    var normalized = [];
    var seen = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var key = normalizeCode(list[i]);
      if (!key || seen[key]) continue;
      seen[key] = true;
      normalized.push(key);
    }
    return normalized;
  }

  function asArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.slice();
    return [value];
  }

  function applyResultPresentation(_root) {
    if (!currentSettings) return 0;
    ensureResultStyles();
    var containers = document.querySelectorAll('div[id^="result-:"]');
    if (!containers || !containers.length) return 0;
    for (var i = 0; i < containers.length; i++) {
      processResultContainer(containers[i]);
    }
    return containers.length;
  }

  function processResultContainer(container) {
    if (!container || container.nodeType !== 1) return 0;

    var processedMarker = container.querySelector && container.querySelector('.sd-ext-article');

    if (!processedMarker || !originalResultsMarkup.has(container)) {
      try {
        originalResultsMarkup.set(container, container.innerHTML);
      } catch (_errStore) {}
      if (container.dataset) container.dataset.sdMerged = '0';
    }

    if (currentSettings.mergeResults) {
      var isMerged = container.dataset && container.dataset.sdMerged === '1';
      var hasProcessedArticles = container.querySelector && container.querySelector('.sd-ext-article');
      if (!isMerged || !hasProcessedArticles) {
        restoreOriginalContainer(container);
        mergeArticlesInContainer(container);
      }
    } else if (container.dataset && container.dataset.sdMerged === '1') {
      restoreOriginalContainer(container);
    }

    installArticleControls(container);
    return 1;
  }

  function restoreOriginalContainer(container) {
    try {
      clearArticleStates(container);
      var original = originalResultsMarkup.get(container);
      if (typeof original === 'string') {
        container.innerHTML = original;
      }
    } catch (_err) {}
    if (container && container.dataset) {
      container.dataset.sdMerged = '0';
    }
  }

  function mergeArticlesInContainer(container) {
    if (!container || container.nodeType !== 1) return 0;
    var articles = getDirectArticles(container);
    if (!articles || !articles.length) return 0;
    if (articles.length === 1) {
      if (container && container.dataset) container.dataset.sdMerged = '1';
      return 0;
    }

    var combinedParts = [];
    for (var i = 0; i < articles.length; i++) {
      var bodyHtml = getArticleBodyHtml(articles[i]);
      if (!bodyHtml) continue;
      if (combinedParts.length) combinedParts.push('<p class="sd-ext-merge-gap"></p>');
      combinedParts.push(bodyHtml);
    }

    var primary = articles[0];
    articleStates.delete(primary);
    var footerHtml = getArticleFooterHtml(primary);
    primary.innerHTML = combinedParts.join('') + footerHtml;
    if (primary.dataset) {
      delete primary.dataset.sdSetup;
      delete primary.dataset.sdCollapsed;
      delete primary.dataset.sdUserOverride;
    }

    for (var j = 1; j < articles.length; j++) {
      if (articles[j]) articleStates.delete(articles[j]);
      if (articles[j] && articles[j].parentNode) {
        articles[j].parentNode.removeChild(articles[j]);
      }
    }

    if (container && container.dataset) container.dataset.sdMerged = '1';
    return 1;
  }

  function installArticleControls(container) {
    if (!container || container.nodeType !== 1) return 0;
    var articles = getDirectArticles(container);
    if (!articles || !articles.length) return 0;
    for (var i = 0; i < articles.length; i++) {
      setupArticle(articles[i]);
    }
    return articles.length;
  }

  function getArticleState(article) {
    if (!article) return null;
    var state = articleStates.get(article);
    if (!state) {
      state = { lines: null, collapsed: null, userOverride: false, generation: settingsGeneration };
      articleStates.set(article, state);
      return state;
    }
    if (state.generation !== settingsGeneration) {
      state.generation = settingsGeneration;
      state.userOverride = false;
      state.collapsed = null;
    }
    return state;
  }

  function clearArticleStates(container) {
    if (!container || !container.querySelectorAll) return;
    try {
      var nodes = container.querySelectorAll('.sd-ext-article');
      for (var i = 0; i < nodes.length; i++) {
        articleStates.delete(nodes[i]);
      }
    } catch (_err) {}
  }

  function logDebug(label, payload) {
    try {
      if (!window || !window.localStorage) return;
      var enabled = window.localStorage.getItem('sdExtDebug');
      if (enabled !== '1' && enabled !== 'true') return;
      if (window.console && typeof window.console.log === 'function') {
        window.console.log('[SanskritExt]', label, payload || {});
      }
    } catch (_err) {}
  }

  function getDirectArticles(container) {
    var list = [];
    if (!container) return list;
    var node = container.firstElementChild;
    while (node) {
      if (node.tagName && node.tagName.toLowerCase() === 'article') list.push(node);
      node = node.nextElementSibling;
    }
    return list;
  }

  function getArticleBodyHtml(article) {
    if (!article) return '';
    var clone = article.cloneNode(true);
    var footers = clone.querySelectorAll('footer');
    for (var i = 0; i < footers.length; i++) {
      if (footers[i] && footers[i].parentNode) footers[i].parentNode.removeChild(footers[i]);
    }
    var html = clone.innerHTML || '';
    return html.trim();
  }

  function getArticleFooterHtml(article) {
    if (!article) return '';
    var footers = article.querySelectorAll('footer');
    if (!footers || !footers.length) return '';
    var html = '';
    for (var i = 0; i < footers.length; i++) {
      html += footers[i].outerHTML || '';
    }
    return html;
  }

  function setupArticle(article) {
    if (!article || article.nodeType !== 1) return 0;

    var initGen = article.dataset ? article.dataset.sdInitGen : null;
    if (initGen && String(initGen) === String(settingsGeneration) && articleStates.has(article)) {
      return 0;
    }

    if (article.dataset) {
      try { article.dataset.sdInitGen = String(settingsGeneration); } catch (_eSetGen) {}
    }

    if (article.classList && !article.classList.contains('sd-ext-article')) {
      article.classList.add('sd-ext-article');
    }

    var body = article.querySelector(':scope > .sd-ext-article-body');
    var toggle = article.querySelector(':scope > .sd-ext-article-toggle');

    if (!body) {
      var contentNodes = [];
      var footerNodes = [];
      while (article.firstChild) {
        var child = article.removeChild(article.firstChild);
        if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'footer') {
          footerNodes.push(child);
        } else {
          contentNodes.push(child);
        }
      }

      body = document.createElement('div');
      body.className = 'sd-ext-article-body';
      for (var i = 0; i < contentNodes.length; i++) {
        body.appendChild(contentNodes[i]);
      }

      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'sd-ext-article-toggle';
      toggle.textContent = '-';
      toggle.setAttribute('aria-label', 'Collapse dictionary entry');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.addEventListener('click', function (ev) {
        try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (_e0) {}
        try { if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (_e1) {}
        var state = getArticleState(article);
        var isCollapsed = state && state.collapsed != null ? !!state.collapsed : article.classList.contains('sd-ext-article-collapsed');
        logDebug('toggleClick', { collapsed: isCollapsed, id: article && article.dataset ? article.dataset.sdArticleId : undefined, generation: settingsGeneration });
        setArticleCollapsed(article, !isCollapsed, true);
      }, false);

      article.appendChild(toggle);
      article.appendChild(body);
      for (var j = 0; j < footerNodes.length; j++) {
        article.appendChild(footerNodes[j]);
      }
    }

    var state = getArticleState(article);
    if (state) {
      if (state.lines == null) {
        state.lines = countApproxLines(body);
      }
      var defaultCollapse = false;
      if (currentSettings && currentSettings.minimizeLongArticles && state.lines > LONG_ARTICLE_THRESHOLD) {
        defaultCollapse = true;
      }
      var desiredCollapse = state.userOverride && state.collapsed != null ? !!state.collapsed : defaultCollapse;
      if (!state.userOverride) {
        state.collapsed = desiredCollapse;
      }
      setArticleCollapsed(article, desiredCollapse, false);
      if (article.dataset && state.lines != null) {
        try { article.dataset.sdLineCount = String(state.lines); } catch (_eStore) {}
      }
    } else {
      setArticleCollapsed(article, false, false);
    }

    if (article.dataset) article.dataset.sdSetup = '1';
    return 1;
  }

  function setArticleCollapsed(article, collapsed, userAction) {
    if (!article || article.nodeType !== 1) return;
    var state = getArticleState(article);
    var body = article.querySelector(':scope > .sd-ext-article-body');
    if (!body) return;

    logDebug('setArticleCollapsed', { collapsed: collapsed, userAction: !!userAction, state: state });

    var alreadyCollapsed = article.classList && article.classList.contains('sd-ext-article-collapsed');
    if (!userAction && state && state.collapsed === collapsed && alreadyCollapsed === collapsed) {
      updateArticleToggle(article, collapsed);
      return;
    }

    if (collapsed) {
      if (article.classList) article.classList.add('sd-ext-article-collapsed');
      try { body.style.setProperty('display', 'none', 'important'); } catch (_e0) { body.style.display = 'none'; }
      try { article.dataset.sdCollapsed = '1'; } catch (_e0b) {}
    } else {
      if (article.classList) article.classList.remove('sd-ext-article-collapsed');
      try { body.style.removeProperty('display'); } catch (_e1) { body.style.display = ''; }
      try { article.dataset.sdCollapsed = '0'; } catch (_e1b) {}
    }

    if (state) {
      state.collapsed = collapsed;
      if (userAction) {
        state.userOverride = true;
      }
      state.generation = settingsGeneration;
    }

    if (article.dataset) {
      try { article.dataset.sdUserOverride = state && state.userOverride ? '1' : '0'; } catch (_e3) {}
    }

    updateArticleToggle(article, collapsed);
    logDebug('setArticleCollapsed:done', { collapsed: collapsed, userOverride: state && state.userOverride });
  }

  function updateArticleToggle(article, collapsed) {
    var toggle = article && article.querySelector ? article.querySelector(':scope > .sd-ext-article-toggle') : null;
    if (!toggle) return;
    toggle.textContent = collapsed ? '+' : '-';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? 'Expand dictionary entry' : 'Collapse dictionary entry');
  }

  function countApproxLines(element) {
    if (!element) return 0;
    var text = '';
    try {
      text = element.innerText || element.textContent || '';
    } catch (_err) {
      text = element.textContent || '';
    }
    if (!text) return 0;
    text = text.replace(/\r+/g, '');
    return text.split(/\n/).length;
  }

  function ensureResultStyles() {
    if (resultStylesInjected) return;
    var css = '' +
      '.sd-ext-article { position: relative; padding-left: 2.25rem; }' +
      '.sd-ext-article .sd-ext-article-toggle { position: absolute; left: 0.6rem; top: 0.6rem; width: 1.5rem; height: 1.5rem; border-radius: 999px; border: 1px solid rgba(0,0,0,0.15); background: #f5f5f5; color: #333; font-size: 1rem; line-height: 1.3rem; padding: 0; text-align: center; cursor: pointer; }' +
      '.sd-ext-article .sd-ext-article-toggle:focus { outline: 2px solid #4a90e2; outline-offset: 2px; }' +
      '.sd-ext-article .sd-ext-article-body { margin-top: 0.25rem; }' +
      '.sd-ext-article.sd-ext-article-collapsed .sd-ext-article-body { display: none !important; }' +
      '.sd-ext-merge-gap { margin: 1em 0; }';
    try {
      var style = document.createElement('style');
      style.setAttribute('data-sd-extension', 'result-styles');
      style.textContent = css;
      var head = document.head || document.documentElement;
      if (head && head.appendChild) head.appendChild(style);
      resultStylesInjected = true;
    } catch (_err) {}
  }

  function normalizeCode(code) {
    if (typeof code === 'string') return code.trim().toLowerCase();
    if (typeof code === 'number') return String(code).trim().toLowerCase();
    return '';
  }

  function createLookup(list) {
    if (!list || !list.length) return null;
    var lookup = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var key = normalizeCode(list[i]);
      if (!key) continue;
      lookup[key] = true;
    }
    return lookup;
  }

  function extractResultCode(id) {
    if (!id) return '';
    var idx = id.indexOf(':');
    if (idx === -1) {
      return id.replace(/^result-/, '');
    }
    return id.slice(idx + 1);
  }

  function logDebug(label, payload) {
    try {
      if (!window || !window.localStorage) return;
      var enabled = window.localStorage.getItem('sdExtDebug');
      if (enabled !== '1' && enabled !== 'true') return;
      if (window.console && typeof window.console.log === 'function') {
        window.console.log('[SanskritExt]', label, payload || {});
      }
    } catch (_err) {}
  }
})();
