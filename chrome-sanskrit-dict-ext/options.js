(function () {
  'use strict';

  var TERM_PATTERN = /dictionary|wörterbuch/i;
  var dictionaries = Array.isArray(typeof SANSKRIT_DICTIONARIES !== 'undefined' ? SANSKRIT_DICTIONARIES : [])
    ? SANSKRIT_DICTIONARIES.map(function (item) {
        return {
          code: normalizeCode(item && (item.code || item.id)),
          label: item && item.label ? String(item.label) : '',
          category: item && item.category ? String(item.category) : 'Other'
        };
      }).filter(function (item) { return !!item.code; })
    : [];
  var dictionaryInfo = createDictionaryInfo(dictionaries);
  var categoryOrder = deriveCategoryOrder(dictionaries);

  var state = {
    order: [],
    preselected: new Set(),
    disableAutosearch: true,
    mergeResults: true,
    minimizeLongArticles: true,
    showToggles: true
  };

  var els = {};
  var statusTimer = null;
  var pendingStorageEvents = 0;

  document.addEventListener('DOMContentLoaded', init);

  function hasSyncStorage() {
    return typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.sync;
  }

  function init() {
    els.orderList = document.getElementById('dictionary-order');
    els.moveUp = document.getElementById('move-up');
    els.moveDown = document.getElementById('move-down');
    els.moveTop = document.getElementById('move-top');
    els.moveBottom = document.getElementById('move-bottom');
    els.resetOrder = document.getElementById('reset-order');
    els.preselectList = document.getElementById('preselect-list');
    els.selectAll = document.getElementById('select-all');
    els.clearAll = document.getElementById('clear-all');
    els.autosearch = document.getElementById('disable-autosearch');
    els.mergeResults = document.getElementById('merge-results');
    els.minimizeLong = document.getElementById('minimize-long');
    els.showToggles = document.getElementById('show-toggles');
    els.status = document.getElementById('status');

    attachEventHandlers();
    loadSettings();

    if (hasSyncStorage()) {
      try {
        chrome.storage.onChanged.addListener(handleExternalChange);
      } catch (_err) {}
    }
  }

  function attachEventHandlers() {
    if (els.moveUp) els.moveUp.addEventListener('click', function () { moveSelected(-1); });
    if (els.moveDown) els.moveDown.addEventListener('click', function () { moveSelected(1); });
    if (els.moveTop) els.moveTop.addEventListener('click', moveToTop);
    if (els.moveBottom) els.moveBottom.addEventListener('click', moveToBottom);
    if (els.resetOrder) els.resetOrder.addEventListener('click', resetOrder);
    if (els.selectAll) els.selectAll.addEventListener('click', function () { setAllPreselected(true); });
    if (els.clearAll) els.clearAll.addEventListener('click', function () { setAllPreselected(false); });
    if (els.autosearch) {
      els.autosearch.addEventListener('change', function () {
        state.disableAutosearch = !!els.autosearch.checked;
        saveSettings();
      });
    }
    if (els.mergeResults) {
      els.mergeResults.addEventListener('change', function () {
        state.mergeResults = !!els.mergeResults.checked;
        saveSettings();
      });
    }
    if (els.minimizeLong) {
      els.minimizeLong.addEventListener('change', function () {
        state.minimizeLongArticles = !!els.minimizeLong.checked;
        // When minimize is enabled, force show toggles to be checked
        if (state.minimizeLongArticles) {
          state.showToggles = true;
          if (els.showToggles) {
            els.showToggles.checked = true;
            els.showToggles.disabled = true;
          }
        } else {
          // When minimize is disabled, allow show toggles to be toggled
          if (els.showToggles) {
            els.showToggles.disabled = false;
          }
        }
        saveSettings();
      });
    }
    if (els.showToggles) {
      els.showToggles.addEventListener('change', function () {
        // Only allow change if minimize is not checked
        if (!state.minimizeLongArticles) {
          state.showToggles = !!els.showToggles.checked;
          saveSettings();
        }
      });
    }
  }

  function loadSettings() {
    var defaults = getDefaultSettings();

    if (!hasSyncStorage()) {
      applySettings(defaults);
      showStatus('Running without Chrome storage; defaults applied.', true);
      return;
    }

    try {
      chrome.storage.sync.get(defaults, function (stored) {
        var data = stored || defaults;
        if (chrome.runtime && chrome.runtime.lastError) {
          showStatus('Unable to load saved settings. Using defaults.', true);
          data = defaults;
        }
        applySettings(sanitizeSettings(data));
      });
    } catch (_err) {
      applySettings(defaults);
      showStatus('Unable to access saved settings. Using defaults.', true);
    }
  }

  function handleExternalChange(changes, areaName) {
    if (areaName !== 'sync') return;
    if (pendingStorageEvents > 0) {
      pendingStorageEvents -= 1;
      return;
    }
    var updated = false;
    var current = {
      dictionaryOrder: state.order.slice(),
      preselectedDictionaries: Array.from(state.preselected),
      disableAutosearch: state.disableAutosearch,
      mergeResults: state.mergeResults,
      minimizeLongArticles: state.minimizeLongArticles,
      showToggles: state.showToggles
    };

    if (Object.prototype.hasOwnProperty.call(changes, 'dictionaryOrder')) {
      current.dictionaryOrder = asArray(changes.dictionaryOrder && changes.dictionaryOrder.newValue);
      updated = true;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'preselectedDictionaries')) {
      current.preselectedDictionaries = asArray(changes.preselectedDictionaries && changes.preselectedDictionaries.newValue);
      updated = true;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'disableAutosearch')) {
      current.disableAutosearch = !!(changes.disableAutosearch && changes.disableAutosearch.newValue);
      updated = true;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'mergeResults')) {
      current.mergeResults = !!(changes.mergeResults && changes.mergeResults.newValue);
      updated = true;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'minimizeLongArticles')) {
      current.minimizeLongArticles = !!(changes.minimizeLongArticles && changes.minimizeLongArticles.newValue);
      updated = true;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'showToggles')) {
      current.showToggles = !!(changes.showToggles && changes.showToggles.newValue);
      updated = true;
    }

    if (updated) {
      applySettings(sanitizeSettings(current), { silent: true });
    }
  }

  function applySettings(settings, options) {
    var opts = options || {};
    state.order = ensureOrderIncludesAll(asArray(settings.dictionaryOrder));
    state.preselected = new Set(sanitizeCodes(asArray(settings.preselectedDictionaries)));
    state.disableAutosearch = typeof settings.disableAutosearch === 'boolean'
      ? settings.disableAutosearch
      : true;
    state.mergeResults = typeof settings.mergeResults === 'boolean'
      ? settings.mergeResults
      : true;
    state.minimizeLongArticles = typeof settings.minimizeLongArticles === 'boolean'
      ? settings.minimizeLongArticles
      : true;
    state.showToggles = typeof settings.showToggles === 'boolean'
      ? settings.showToggles
      : true;

    renderOrderList();
    renderPreselectList();
    if (els.autosearch) els.autosearch.checked = state.disableAutosearch;
    if (els.mergeResults) els.mergeResults.checked = state.mergeResults;
    if (els.minimizeLong) els.minimizeLong.checked = state.minimizeLongArticles;
    if (els.showToggles) {
      els.showToggles.checked = state.showToggles;
      // Disable the checkbox if minimize is enabled
      els.showToggles.disabled = state.minimizeLongArticles;
    }

    if (!opts.silent) {
      showStatus('Settings loaded.');
    }
  }

  function renderOrderList(selectedCode, selectedIndex) {
    if (!els.orderList) return;
    while (els.orderList.firstChild) {
      els.orderList.removeChild(els.orderList.firstChild);
    }

    for (var i = 0; i < state.order.length; i++) {
      var code = state.order[i];
      var option = document.createElement('option');
      option.value = code;
      option.textContent = getDictionaryLabel(code) + ' (' + code + ')';
      if (selectedCode && selectedCode === code) option.selected = true;
      els.orderList.appendChild(option);
    }

    var indexToSelect = typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < state.order.length
      ? selectedIndex
      : -1;

    if (indexToSelect === -1 && selectedCode) {
      for (var j = 0; j < state.order.length; j++) {
        if (state.order[j] === selectedCode) {
          indexToSelect = j;
          break;
        }
      }
    }

    if (indexToSelect === -1 && state.order.length && els.orderList.options.length) {
      indexToSelect = 0;
    }

    if (indexToSelect !== -1 && els.orderList.options[indexToSelect]) {
      els.orderList.options[indexToSelect].selected = true;
      els.orderList.selectedIndex = indexToSelect;
    } else {
      els.orderList.selectedIndex = -1;
    }
  }

  function renderPreselectList() {
    if (!els.preselectList) return;
    els.preselectList.innerHTML = '';

    var categories = getCategoryOrder();
    for (var i = 0; i < categories.length; i++) {
      var category = categories[i];
      var codes = filterCodesByCategory(state.order, category);
      if (!codes.length) codes = filterCodesByCategory(getDefaultOrder(), category);
      if (!codes.length) continue;

      var heading = document.createElement('h3');
      heading.textContent = category;
      els.preselectList.appendChild(heading);

      var grid = document.createElement('div');
      grid.className = 'checkbox-grid';

      for (var j = 0; j < codes.length; j++) {
        var code = codes[j];
        var label = document.createElement('label');
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = code;
        checkbox.checked = state.preselected.has(code);
        checkbox.addEventListener('change', function (ev) {
          var value = normalizeCode(ev.target.value);
          if (!value) return;
          if (ev.target.checked) {
            state.preselected.add(value);
          } else {
            state.preselected.delete(value);
          }
          saveSettings();
        });
        var span = document.createElement('span');
        span.textContent = getDictionaryLabel(code);

        label.appendChild(checkbox);
        label.appendChild(span);
        grid.appendChild(label);
      }

      els.preselectList.appendChild(grid);
    }
  }

  function moveSelected(delta) {
    if (!els.orderList) return;
    var index = els.orderList.selectedIndex;
    if (index < 0) return;
    var newIndex = index + delta;
    if (newIndex < 0 || newIndex >= state.order.length) return;

    var code = state.order[index];
    state.order.splice(index, 1);
    state.order.splice(newIndex, 0, code);
    renderOrderList(code, newIndex);
    renderPreselectList();
    saveSettings();
    if (els.orderList) els.orderList.focus();
  }

  function moveToTop() {
    if (!els.orderList) return;
    var index = els.orderList.selectedIndex;
    if (index <= 0) return;
    var code = state.order[index];
    state.order.splice(index, 1);
    state.order.unshift(code);
    renderOrderList(code, 0);
    renderPreselectList();
    saveSettings();
    if (els.orderList) els.orderList.focus();
  }

  function moveToBottom() {
    if (!els.orderList) return;
    var index = els.orderList.selectedIndex;
    if (index === -1 || index === state.order.length - 1) return;
    var code = state.order[index];
    state.order.splice(index, 1);
    state.order.push(code);
    renderOrderList(code, state.order.length - 1);
    renderPreselectList();
    saveSettings();
    if (els.orderList) els.orderList.focus();
  }

  function resetOrder() {
    state.order = ensureOrderIncludesAll(getDefaultOrder());
    renderOrderList(null, 0);
    renderPreselectList();
    saveSettings();
    if (els.orderList) els.orderList.focus();
  }

  function setAllPreselected(enabled) {
    if (enabled) {
      state.preselected = new Set(state.order);
    } else {
      state.preselected.clear();
    }
    renderPreselectList();
    saveSettings();
  }

  function saveSettings() {
    if (!hasSyncStorage()) {
      showStatus('Cannot save settings in this environment.', true);
      return;
    }

    var payload = {
      dictionaryOrder: state.order.slice(),
      preselectedDictionaries: Array.from(state.preselected),
      disableAutosearch: state.disableAutosearch,
      mergeResults: state.mergeResults,
      minimizeLongArticles: state.minimizeLongArticles,
      showToggles: state.showToggles
    };

    pendingStorageEvents += 1;

    try {
      chrome.storage.sync.set(payload, function () {
        if (pendingStorageEvents > 0) pendingStorageEvents -= 1;
        if (chrome.runtime && chrome.runtime.lastError) {
          showStatus('Unable to save settings: ' + chrome.runtime.lastError.message, true);
        } else {
          showStatus('Settings saved.');
        }
      });
    } catch (_err) {
      showStatus('Unable to save settings.', true);
      if (pendingStorageEvents > 0) pendingStorageEvents -= 1;
    }
  }

  function getDefaultSettings() {
    return {
      dictionaryOrder: ensureOrderIncludesAll(getDefaultOrder()),
      preselectedDictionaries: sanitizeCodes(getDefaultPreselected()),
      disableAutosearch: true,
      mergeResults: true,
      minimizeLongArticles: true,
      showToggles: true
    };
  }

  function sanitizeSettings(raw) {
    var defaults = getDefaultSettings();
    return {
      dictionaryOrder: ensureOrderIncludesAll(asArray(raw.dictionaryOrder || defaults.dictionaryOrder)),
      preselectedDictionaries: sanitizeCodes(asArray(raw.preselectedDictionaries || defaults.preselectedDictionaries)),
      disableAutosearch: typeof raw.disableAutosearch === 'boolean' ? raw.disableAutosearch : defaults.disableAutosearch,
      mergeResults: typeof raw.mergeResults === 'boolean' ? raw.mergeResults : defaults.mergeResults,
      minimizeLongArticles: typeof raw.minimizeLongArticles === 'boolean' ? raw.minimizeLongArticles : defaults.minimizeLongArticles,
      showToggles: typeof raw.showToggles === 'boolean' ? raw.showToggles : defaults.showToggles
    };
  }

  function getDefaultOrder() {
    if (dictionaries.length) {
      return dictionaries.map(function (item) { return item.code; });
    }
    return [];
  }

  function getDefaultPreselected() {
    var defaults = [];
    for (var i = 0; i < dictionaries.length; i++) {
      if (TERM_PATTERN.test(dictionaries[i].label || '')) defaults.push(dictionaries[i].code);
    }
    return defaults;
  }

  function ensureOrderIncludesAll(order) {
    var normalized = [];
    var seen = Object.create(null);

    function push(code) {
      var key = normalizeCode(code);
      if (!key || seen[key]) return;
      seen[key] = true;
      normalized.push(key);
    }

    for (var i = 0; i < order.length; i++) push(order[i]);

    var defaults = getDefaultOrder();
    for (var j = 0; j < defaults.length; j++) push(defaults[j]);

    return normalized;
  }

  function sanitizeCodes(list) {
    var result = [];
    var seen = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var key = normalizeCode(list[i]);
      if (!key || seen[key]) continue;
      seen[key] = true;
      result.push(key);
    }
    return result;
  }

  function getDictionaryLabel(code) {
    var key = normalizeCode(code);
    var info = dictionaryInfo[key];
    if (!info) return key ? 'Unknown dictionary (' + key + ')' : 'Unknown dictionary';
    return info.label || (key ? 'Unknown dictionary (' + key + ')' : 'Unknown dictionary');
  }

  function getDictionaryCategory(code) {
    var info = dictionaryInfo[normalizeCode(code)];
    return info && info.category ? info.category : 'Other';
  }

  function filterCodesByCategory(list, category) {
    var codes = [];
    var seen = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var code = normalizeCode(list[i]);
      if (!code || seen[code]) continue;
      if (getDictionaryCategory(code) === category) {
        seen[code] = true;
        codes.push(code);
      }
    }
    return codes;
  }

  function getCategoryOrder() {
    return categoryOrder.slice();
  }

  function createDictionaryInfo(list) {
    var map = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || !item.code) continue;
      map[item.code] = {
        label: item.label || '',
        category: item.category || 'Other'
      };
    }
    return map;
  }

  function deriveCategoryOrder(list) {
    var order = [];
    var seen = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var category = list[i] && list[i].category ? list[i].category : 'Other';
      if (!seen[category]) {
        seen[category] = true;
        order.push(category);
      }
    }
    return order;
  }

  function asArray(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.slice();
    return [value];
  }

  function normalizeCode(code) {
    if (typeof code === 'string') return code.trim().toLowerCase();
    if (typeof code === 'number') return String(code).trim().toLowerCase();
    return '';
  }

  function showStatus(message, isError) {
    if (!els.status) return;
    clearTimeout(statusTimer);
    els.status.textContent = message || '';
    els.status.className = isError ? 'error' : message ? 'success' : '';
    if (message && !isError) {
      statusTimer = setTimeout(function () {
        els.status.textContent = '';
        els.status.className = '';
      }, 2500);
    }
  }
})();
