(function (global) {
  var dictionaries = [
    { code: 'ap90', label: 'Apte Practical Sanskrit-English Dictionary - 1890', category: 'SA -> EN' },
    { code: 'acc', label: "Aufrecht's Catalogus Catalogorum - 1962", category: 'SA -> EN' },
    { code: 'ben', label: 'Benfey Sanskrit-English Dictionary - 1866', category: 'SA -> EN' },
    { code: 'cae', label: 'Cappeller Sanskrit-English Dictionary - 1891', category: 'SA -> EN' },
    { code: 'bhs', label: 'Edgerton Buddhist Hybrid Sanskrit Dictionary - 1953', category: 'SA -> EN' },
    { code: 'gst', label: 'Goldstücker Sanskrit-English Dictionary - 1856', category: 'SA -> EN' },
    { code: 'inm', label: 'Index to the Names in the Mahabharata - 1904', category: 'SA -> EN' },
    { code: 'ieg', label: 'Indian Epigraphical Glossary - 1966', category: 'SA -> EN' },
    { code: 'lan', label: "Lanman's Sanskrit Reader Vocabulary - 1884", category: 'SA -> EN' },
    { code: 'md', label: 'Macdonell Sanskrit-English Dictionary - 1893', category: 'SA -> EN' },
    { code: 'mci', label: 'Mahabharata Cultural Index - 1993', category: 'SA -> EN' },
    { code: 'mw72', label: 'Monier-Williams Sanskrit-English Dictionary - 1872', category: 'SA -> EN' },
    { code: 'mw', label: 'Monier-Williams Sanskrit-English Dictionary - 1899', category: 'SA -> EN' },
    { code: 'pgn', label: 'Personal and Geographical Names in the Gupta Inscriptions - 1978', category: 'SA -> EN' },
    { code: 'pe', label: 'Puranic Encyclopedia - 1975', category: 'SA -> EN' },
    { code: 'shs', label: 'Shabda-Sagara Sanskrit-English Dictionary - 1900', category: 'SA -> EN' },
    { code: 'pui', label: 'The Purana Index - 1951', category: 'SA -> EN' },
    { code: 'vei', label: 'The Vedic Index of Names and Subjects - 1912', category: 'SA -> EN' },
    { code: 'wil', label: 'Wilson Sanskrit-English Dictionary - 1832', category: 'SA -> EN' },
    { code: 'yat', label: 'Yates Sanskrit-English Dictionary - 1846', category: 'SA -> EN' },

    { code: 'bur', label: 'Burnouf Dictionnaire Sanscrit-Français - 1866', category: 'SA -> FR' },
    { code: 'stc', label: 'Stchoupak Dictionnaire Sanscrit-Français - 1932', category: 'SA -> FR' },

    { code: 'armh', label: 'Abhidhānaratnamālā of Halāyudha - 1861', category: 'SA -> SA' },
    { code: 'krm', label: 'Kṛdantarūpamālā - 1965', category: 'SA -> SA' },
    { code: 'skd', label: 'Sabda-kalpadruma - 1886', category: 'SA -> SA' },
    { code: 'vcp', label: 'Vacaspatyam', category: 'SA -> SA' },

    { code: 'pw', label: 'Böhtlingk Sanskrit-Wörterbuch in kürzerer Fassung - 1879', category: 'SA -> DE' },
    { code: 'pwg', label: 'Böhtlingk and Roth Grosses Petersburger Wörterbuch - 1855', category: 'SA -> DE' },
    { code: 'ccs', label: 'Cappeller Sanskrit Wörterbuch - 1887', category: 'SA -> DE' },
    { code: 'gra', label: 'Grassmann Wörterbuch zum Rig Veda', category: 'SA -> DE' },
    { code: 'sch', label: 'Schmidt Nachträge zum Sanskrit-Wörterbuch - 1928', category: 'SA -> DE' },

    { code: 'ae', label: "Apte Student's English-Sanskrit Dictionary - 1920", category: 'EN -> SA' },
    { code: 'bor', label: 'Borooah English-Sanskrit Dictionary - 1877', category: 'EN -> SA' },
    { code: 'mwe', label: 'Monier-Williams English-Sanskrit Dictionary - 1851', category: 'EN -> SA' },

    { code: 'bop', label: 'Bopp Glossarium Sanscritum - 1847', category: 'SA -> LA' },
    { code: 'snp', label: "Meulenbeld's Sanskrit Names of Plants - 1974", category: 'SA -> LA' }
  ];

  try {
    Object.freeze(dictionaries);
  } catch (_err) {}

  if (global) {
    global.SANSKRIT_DICTIONARIES = dictionaries;
  }
})(typeof self !== 'undefined' ? self : this);
