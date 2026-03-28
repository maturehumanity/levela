export type LanguageCode = 'af' | 'sq' | 'am' | 'ar-SA' | 'ar' | 'hy' | 'az' | 'eu' | 'be' | 'bn-IN' | 'bn' | 'bs-Cyrl' | 'bs' | 'bg' | 'my' | 'ca' | 'zh-CN' | 'zh-HK' | 'zh-Hans' | 'zh-TW' | 'zh-Hant' | 'zh' | 'hr' | 'cs' | 'da' | 'nl-BE' | 'nl' | 'en-AU' | 'en-CA' | 'en-NZ' | 'en-PH' | 'en-ZA' | 'en-GB' | 'en-US' | 'en' | 'et' | 'fil' | 'fi' | 'fr-CA' | 'fr-CH' | 'fr' | 'fy' | 'gl' | 'ka' | 'de' | 'el' | 'gn' | 'gu' | 'ha' | 'he' | 'iw' | 'hi' | 'hu' | 'is' | 'ig' | 'id' | 'ga' | 'it' | 'ja' | 'kn' | 'km' | 'ko' | 'ky' | 'lo' | 'lv' | 'ln' | 'lt' | 'lb' | 'mk' | 'ms' | 'ml' | 'mt' | 'mr' | 'mn' | 'ne' | 'nb' | 'no' | 'or' | 'fa' | 'pl' | 'pt-BR' | 'pt-PT' | 'pt' | 'pa-PK' | 'pa' | 'ro' | 'ru' | 'gd' | 'sr' | 'sk' | 'sl' | 'so' | 'es-AR' | 'es-CL' | 'es-CO' | 'es-CR' | 'es-EC' | 'es-SV' | 'es-GT' | 'es-HT' | 'es-HN' | 'es-419' | 'es-MX' | 'es-NI' | 'es-PA' | 'es-PY' | 'es-PE' | 'es-PR' | 'es-ES' | 'es-US' | 'es-UY' | 'es-VE' | 'es' | 'sw' | 'sv' | 'tl' | 'tg' | 'ta' | 'te' | 'th' | 'tr' | 'uk' | 'ur' | 'uz' | 'vi' | 'cy' | 'zu' | 'ab' | 'ace' | 'ach' | 'alz' | 'as' | 'awa' | 'ay' | 'ban' | 'bm' | 'ba' | 'btx' | 'bts' | 'bbc' | 'bem' | 'bew' | 'bho' | 'bik' | 'br' | 'bua' | 'yue' | 'ceb' | 'ny' | 'cv' | 'co' | 'crh' | 'din' | 'dv' | 'doi' | 'dov' | 'dz' | 'eo' | 'ee' | 'fj' | 'fr-FR' | 'ff' | 'gaa' | 'lg' | 'ht' | 'cnh' | 'haw' | 'hil' | 'hmn' | 'hrx' | 'ilo' | 'pam' | 'kk' | 'cgg' | 'rw' | 'ktu' | 'gom' | 'kri' | 'ku' | 'ckb' | 'ltg' | 'la' | 'lij' | 'li' | 'lmo' | 'luo' | 'mai' | 'mak' | 'mg' | 'ms-Arab' | 'mi' | 'chm' | 'mni-Mtei' | 'min' | 'lus' | 'nr' | 'new' | 'nso' | 'nus' | 'oc' | 'om' | 'pag' | 'pap' | 'ps' | 'pa-Arab' | 'qu' | 'rom' | 'rn' | 'sm' | 'sg' | 'sa' | 'st' | 'crs' | 'shn' | 'sn' | 'scn' | 'szl' | 'sd' | 'si' | 'su' | 'ss' | 'tt' | 'tet' | 'ti' | 'ts' | 'tn' | 'tk' | 'ak' | 'ug' | 'xh' | 'yi' | 'yo' | 'yua';

export type LanguageOption = {
  code: LanguageCode;
  label: string;
};

export const supportedLanguageCodes = [
  "af",
  "sq",
  "am",
  "ar-SA",
  "ar",
  "hy",
  "az",
  "eu",
  "be",
  "bn-IN",
  "bn",
  "bs-Cyrl",
  "bs",
  "bg",
  "my",
  "ca",
  "zh-CN",
  "zh-HK",
  "zh-Hans",
  "zh-TW",
  "zh-Hant",
  "zh",
  "hr",
  "cs",
  "da",
  "nl-BE",
  "nl",
  "en-AU",
  "en-CA",
  "en-NZ",
  "en-PH",
  "en-ZA",
  "en-GB",
  "en-US",
  "en",
  "et",
  "fil",
  "fi",
  "fr-CA",
  "fr-CH",
  "fr",
  "fy",
  "gl",
  "ka",
  "de",
  "el",
  "gn",
  "gu",
  "ha",
  "he",
  "iw",
  "hi",
  "hu",
  "is",
  "ig",
  "id",
  "ga",
  "it",
  "ja",
  "kn",
  "km",
  "ko",
  "ky",
  "lo",
  "lv",
  "ln",
  "lt",
  "lb",
  "mk",
  "ms",
  "ml",
  "mt",
  "mr",
  "mn",
  "ne",
  "nb",
  "no",
  "or",
  "fa",
  "pl",
  "pt-BR",
  "pt-PT",
  "pt",
  "pa-PK",
  "pa",
  "ro",
  "ru",
  "gd",
  "sr",
  "sk",
  "sl",
  "so",
  "es-AR",
  "es-CL",
  "es-CO",
  "es-CR",
  "es-EC",
  "es-SV",
  "es-GT",
  "es-HT",
  "es-HN",
  "es-419",
  "es-MX",
  "es-NI",
  "es-PA",
  "es-PY",
  "es-PE",
  "es-PR",
  "es-ES",
  "es-US",
  "es-UY",
  "es-VE",
  "es",
  "sw",
  "sv",
  "tl",
  "tg",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "ur",
  "uz",
  "vi",
  "cy",
  "zu",
  "ab",
  "ace",
  "ach",
  "alz",
  "as",
  "awa",
  "ay",
  "ban",
  "bm",
  "ba",
  "btx",
  "bts",
  "bbc",
  "bem",
  "bew",
  "bho",
  "bik",
  "br",
  "bua",
  "yue",
  "ceb",
  "ny",
  "cv",
  "co",
  "crh",
  "din",
  "dv",
  "doi",
  "dov",
  "dz",
  "eo",
  "ee",
  "fj",
  "fr-FR",
  "ff",
  "gaa",
  "lg",
  "ht",
  "cnh",
  "haw",
  "hil",
  "hmn",
  "hrx",
  "ilo",
  "pam",
  "kk",
  "cgg",
  "rw",
  "ktu",
  "gom",
  "kri",
  "ku",
  "ckb",
  "ltg",
  "la",
  "lij",
  "li",
  "lmo",
  "luo",
  "mai",
  "mak",
  "mg",
  "ms-Arab",
  "mi",
  "chm",
  "mni-Mtei",
  "min",
  "lus",
  "nr",
  "new",
  "nso",
  "nus",
  "oc",
  "om",
  "pag",
  "pap",
  "ps",
  "pa-Arab",
  "qu",
  "rom",
  "rn",
  "sm",
  "sg",
  "sa",
  "st",
  "crs",
  "shn",
  "sn",
  "scn",
  "szl",
  "sd",
  "si",
  "su",
  "ss",
  "tt",
  "tet",
  "ti",
  "ts",
  "tn",
  "tk",
  "ak",
  "ug",
  "xh",
  "yi",
  "yo",
  "yua"
] as const;

export const languageOptions = [
  {
    "code": "af",
    "label": "Afrikaans"
  },
  {
    "code": "sq",
    "label": "shqip"
  },
  {
    "code": "am",
    "label": "አማርኛ"
  },
  {
    "code": "ar-SA",
    "label": "العربية (المملكة العربية السعودية)"
  },
  {
    "code": "ar",
    "label": "العربية"
  },
  {
    "code": "hy",
    "label": "հայերեն"
  },
  {
    "code": "az",
    "label": "azərbaycan"
  },
  {
    "code": "eu",
    "label": "euskara"
  },
  {
    "code": "be",
    "label": "беларуская"
  },
  {
    "code": "bn-IN",
    "label": "বাংলা (ভারত)"
  },
  {
    "code": "bn",
    "label": "বাংলা"
  },
  {
    "code": "bs-Cyrl",
    "label": "босански (ћирилица)"
  },
  {
    "code": "bs",
    "label": "bosanski"
  },
  {
    "code": "bg",
    "label": "български"
  },
  {
    "code": "my",
    "label": "မြန်မာ"
  },
  {
    "code": "ca",
    "label": "català"
  },
  {
    "code": "zh-CN",
    "label": "中文（中国）"
  },
  {
    "code": "zh-HK",
    "label": "中文（中國香港特別行政區）"
  },
  {
    "code": "zh-Hans",
    "label": "简体中文"
  },
  {
    "code": "zh-TW",
    "label": "中文（台灣）"
  },
  {
    "code": "zh-Hant",
    "label": "繁體中文"
  },
  {
    "code": "zh",
    "label": "中文"
  },
  {
    "code": "hr",
    "label": "hrvatski"
  },
  {
    "code": "cs",
    "label": "čeština"
  },
  {
    "code": "da",
    "label": "dansk"
  },
  {
    "code": "nl-BE",
    "label": "Vlaams"
  },
  {
    "code": "nl",
    "label": "Nederlands"
  },
  {
    "code": "en-AU",
    "label": "Australian English"
  },
  {
    "code": "en-CA",
    "label": "Canadian English"
  },
  {
    "code": "en-NZ",
    "label": "English (New Zealand)"
  },
  {
    "code": "en-PH",
    "label": "English (Philippines)"
  },
  {
    "code": "en-ZA",
    "label": "English (South Africa)"
  },
  {
    "code": "en-GB",
    "label": "British English"
  },
  {
    "code": "en-US",
    "label": "American English"
  },
  {
    "code": "en",
    "label": "English"
  },
  {
    "code": "et",
    "label": "eesti"
  },
  {
    "code": "fil",
    "label": "Filipino"
  },
  {
    "code": "fi",
    "label": "suomi"
  },
  {
    "code": "fr-CA",
    "label": "français canadien"
  },
  {
    "code": "fr-CH",
    "label": "français suisse"
  },
  {
    "code": "fr",
    "label": "français"
  },
  {
    "code": "fy",
    "label": "Frysk"
  },
  {
    "code": "gl",
    "label": "galego"
  },
  {
    "code": "ka",
    "label": "ქართული"
  },
  {
    "code": "de",
    "label": "Deutsch"
  },
  {
    "code": "el",
    "label": "Ελληνικά"
  },
  {
    "code": "gn",
    "label": "Guarani"
  },
  {
    "code": "gu",
    "label": "ગુજરાતી"
  },
  {
    "code": "ha",
    "label": "Hausa"
  },
  {
    "code": "he",
    "label": "עברית"
  },
  {
    "code": "iw",
    "label": "עברית"
  },
  {
    "code": "hi",
    "label": "हिन्दी"
  },
  {
    "code": "hu",
    "label": "magyar"
  },
  {
    "code": "is",
    "label": "íslenska"
  },
  {
    "code": "ig",
    "label": "Igbo"
  },
  {
    "code": "id",
    "label": "Indonesia"
  },
  {
    "code": "ga",
    "label": "Gaeilge"
  },
  {
    "code": "it",
    "label": "italiano"
  },
  {
    "code": "ja",
    "label": "日本語"
  },
  {
    "code": "kn",
    "label": "ಕನ್ನಡ"
  },
  {
    "code": "km",
    "label": "ខ្មែរ"
  },
  {
    "code": "ko",
    "label": "한국어"
  },
  {
    "code": "ky",
    "label": "кыргызча"
  },
  {
    "code": "lo",
    "label": "ລາວ"
  },
  {
    "code": "lv",
    "label": "latviešu"
  },
  {
    "code": "ln",
    "label": "lingála"
  },
  {
    "code": "lt",
    "label": "lietuvių"
  },
  {
    "code": "lb",
    "label": "Lëtzebuergesch"
  },
  {
    "code": "mk",
    "label": "македонски"
  },
  {
    "code": "ms",
    "label": "Melayu"
  },
  {
    "code": "ml",
    "label": "മലയാളം"
  },
  {
    "code": "mt",
    "label": "Malti"
  },
  {
    "code": "mr",
    "label": "मराठी"
  },
  {
    "code": "mn",
    "label": "монгол"
  },
  {
    "code": "ne",
    "label": "नेपाली"
  },
  {
    "code": "nb",
    "label": "norsk bokmål"
  },
  {
    "code": "no",
    "label": "norsk"
  },
  {
    "code": "or",
    "label": "ଓଡ଼ିଆ"
  },
  {
    "code": "fa",
    "label": "فارسی"
  },
  {
    "code": "pl",
    "label": "polski"
  },
  {
    "code": "pt-BR",
    "label": "português (Brasil)"
  },
  {
    "code": "pt-PT",
    "label": "português europeu"
  },
  {
    "code": "pt",
    "label": "português"
  },
  {
    "code": "pa-PK",
    "label": "پنجابی (پاکستان)"
  },
  {
    "code": "pa",
    "label": "ਪੰਜਾਬੀ"
  },
  {
    "code": "ro",
    "label": "română"
  },
  {
    "code": "ru",
    "label": "русский"
  },
  {
    "code": "gd",
    "label": "Gàidhlig"
  },
  {
    "code": "sr",
    "label": "српски"
  },
  {
    "code": "sk",
    "label": "slovenčina"
  },
  {
    "code": "sl",
    "label": "slovenščina"
  },
  {
    "code": "so",
    "label": "Soomaali"
  },
  {
    "code": "es-AR",
    "label": "español (Argentina)"
  },
  {
    "code": "es-CL",
    "label": "español (Chile)"
  },
  {
    "code": "es-CO",
    "label": "español (Colombia)"
  },
  {
    "code": "es-CR",
    "label": "español (Costa Rica)"
  },
  {
    "code": "es-EC",
    "label": "español (Ecuador)"
  },
  {
    "code": "es-SV",
    "label": "español (El Salvador)"
  },
  {
    "code": "es-GT",
    "label": "español (Guatemala)"
  },
  {
    "code": "es-HT",
    "label": "español (Haití)"
  },
  {
    "code": "es-HN",
    "label": "español (Honduras)"
  },
  {
    "code": "es-419",
    "label": "español latinoamericano"
  },
  {
    "code": "es-MX",
    "label": "español de México"
  },
  {
    "code": "es-NI",
    "label": "español (Nicaragua)"
  },
  {
    "code": "es-PA",
    "label": "español (Panamá)"
  },
  {
    "code": "es-PY",
    "label": "español (Paraguay)"
  },
  {
    "code": "es-PE",
    "label": "español (Perú)"
  },
  {
    "code": "es-PR",
    "label": "español (Puerto Rico)"
  },
  {
    "code": "es-ES",
    "label": "español de España"
  },
  {
    "code": "es-US",
    "label": "español (Estados Unidos)"
  },
  {
    "code": "es-UY",
    "label": "español (Uruguay)"
  },
  {
    "code": "es-VE",
    "label": "español (Venezuela)"
  },
  {
    "code": "es",
    "label": "español"
  },
  {
    "code": "sw",
    "label": "Kiswahili"
  },
  {
    "code": "sv",
    "label": "svenska"
  },
  {
    "code": "tl",
    "label": "Filipino"
  },
  {
    "code": "tg",
    "label": "тоҷикӣ"
  },
  {
    "code": "ta",
    "label": "தமிழ்"
  },
  {
    "code": "te",
    "label": "తెలుగు"
  },
  {
    "code": "th",
    "label": "ไทย"
  },
  {
    "code": "tr",
    "label": "Türkçe"
  },
  {
    "code": "uk",
    "label": "українська"
  },
  {
    "code": "ur",
    "label": "اردو"
  },
  {
    "code": "uz",
    "label": "o‘zbek"
  },
  {
    "code": "vi",
    "label": "Tiếng Việt"
  },
  {
    "code": "cy",
    "label": "Cymraeg"
  },
  {
    "code": "zu",
    "label": "isiZulu"
  },
  {
    "code": "ab",
    "label": "Abkhazian"
  },
  {
    "code": "ace",
    "label": "Acehnese"
  },
  {
    "code": "ach",
    "label": "Acoli"
  },
  {
    "code": "alz",
    "label": "Alur"
  },
  {
    "code": "as",
    "label": "অসমীয়া"
  },
  {
    "code": "awa",
    "label": "Awadhi"
  },
  {
    "code": "ay",
    "label": "Aymara"
  },
  {
    "code": "ban",
    "label": "Balinese"
  },
  {
    "code": "bm",
    "label": "bamanakan"
  },
  {
    "code": "ba",
    "label": "Bashkir"
  },
  {
    "code": "btx",
    "label": "Batak Karo"
  },
  {
    "code": "bts",
    "label": "Batak Simalungun"
  },
  {
    "code": "bbc",
    "label": "Batak Toba"
  },
  {
    "code": "bem",
    "label": "Ichibemba"
  },
  {
    "code": "bew",
    "label": "Betawi"
  },
  {
    "code": "bho",
    "label": "भोजपुरी"
  },
  {
    "code": "bik",
    "label": "Bikol"
  },
  {
    "code": "br",
    "label": "brezhoneg"
  },
  {
    "code": "bua",
    "label": "Buriat"
  },
  {
    "code": "yue",
    "label": "粵語"
  },
  {
    "code": "ceb",
    "label": "Cebuano"
  },
  {
    "code": "ny",
    "label": "Nyanja"
  },
  {
    "code": "cv",
    "label": "чӑваш"
  },
  {
    "code": "co",
    "label": "Corsican"
  },
  {
    "code": "crh",
    "label": "Crimean Tatar"
  },
  {
    "code": "din",
    "label": "Dinka"
  },
  {
    "code": "dv",
    "label": "Divehi"
  },
  {
    "code": "doi",
    "label": "डोगरी"
  },
  {
    "code": "dov",
    "label": "Dombe"
  },
  {
    "code": "dz",
    "label": "རྫོང་ཁ"
  },
  {
    "code": "eo",
    "label": "Esperanto"
  },
  {
    "code": "ee",
    "label": "eʋegbe"
  },
  {
    "code": "fj",
    "label": "Fijian"
  },
  {
    "code": "fr-FR",
    "label": "français (France)"
  },
  {
    "code": "ff",
    "label": "Pulaar"
  },
  {
    "code": "gaa",
    "label": "Gã"
  },
  {
    "code": "lg",
    "label": "Luganda"
  },
  {
    "code": "ht",
    "label": "Haitian Creole"
  },
  {
    "code": "cnh",
    "label": "Hakha Chin"
  },
  {
    "code": "haw",
    "label": "ʻŌlelo Hawaiʻi"
  },
  {
    "code": "hil",
    "label": "Hiligaynon"
  },
  {
    "code": "hmn",
    "label": "Hmong"
  },
  {
    "code": "hrx",
    "label": "Hunsrik"
  },
  {
    "code": "ilo",
    "label": "Iloko"
  },
  {
    "code": "pam",
    "label": "Pampanga"
  },
  {
    "code": "kk",
    "label": "қазақ тілі"
  },
  {
    "code": "cgg",
    "label": "Rukiga"
  },
  {
    "code": "rw",
    "label": "Ikinyarwanda"
  },
  {
    "code": "ktu",
    "label": "Kituba"
  },
  {
    "code": "gom",
    "label": "कोंकणी"
  },
  {
    "code": "kri",
    "label": "Krio"
  },
  {
    "code": "ku",
    "label": "kurdî (kurmancî)"
  },
  {
    "code": "ckb",
    "label": "کوردیی ناوەندی"
  },
  {
    "code": "ltg",
    "label": "Latgalian"
  },
  {
    "code": "la",
    "label": "Latin"
  },
  {
    "code": "lij",
    "label": "ligure"
  },
  {
    "code": "li",
    "label": "Limburgish"
  },
  {
    "code": "lmo",
    "label": "Lombard"
  },
  {
    "code": "luo",
    "label": "Dholuo"
  },
  {
    "code": "mai",
    "label": "मैथिली"
  },
  {
    "code": "mak",
    "label": "Makasar"
  },
  {
    "code": "mg",
    "label": "Malagasy"
  },
  {
    "code": "ms-Arab",
    "label": "Melayu (Arab)"
  },
  {
    "code": "mi",
    "label": "Māori"
  },
  {
    "code": "chm",
    "label": "Mari"
  },
  {
    "code": "mni-Mtei",
    "label": "মৈতৈলোন্ (মীতৈ ময়েক)"
  },
  {
    "code": "min",
    "label": "Minangkabau"
  },
  {
    "code": "lus",
    "label": "Mizo"
  },
  {
    "code": "nr",
    "label": "South Ndebele"
  },
  {
    "code": "new",
    "label": "Newari"
  },
  {
    "code": "nso",
    "label": "Sesotho sa Leboa"
  },
  {
    "code": "nus",
    "label": "Thok Nath"
  },
  {
    "code": "oc",
    "label": "occitan"
  },
  {
    "code": "om",
    "label": "Oromoo"
  },
  {
    "code": "pag",
    "label": "Pangasinan"
  },
  {
    "code": "pap",
    "label": "Papiamento"
  },
  {
    "code": "ps",
    "label": "پښتو"
  },
  {
    "code": "pa-Arab",
    "label": "پنجابی (عربی)"
  },
  {
    "code": "qu",
    "label": "Runasimi"
  },
  {
    "code": "rom",
    "label": "Romany"
  },
  {
    "code": "rn",
    "label": "Ikirundi"
  },
  {
    "code": "sm",
    "label": "Samoan"
  },
  {
    "code": "sg",
    "label": "Sängö"
  },
  {
    "code": "sa",
    "label": "संस्कृत भाषा"
  },
  {
    "code": "st",
    "label": "Sesotho"
  },
  {
    "code": "crs",
    "label": "Seselwa Creole French"
  },
  {
    "code": "shn",
    "label": "Shan"
  },
  {
    "code": "sn",
    "label": "chiShona"
  },
  {
    "code": "scn",
    "label": "Sicilian"
  },
  {
    "code": "szl",
    "label": "ślōnski"
  },
  {
    "code": "sd",
    "label": "سنڌي"
  },
  {
    "code": "si",
    "label": "සිංහල"
  },
  {
    "code": "su",
    "label": "Basa Sunda"
  },
  {
    "code": "ss",
    "label": "Swati"
  },
  {
    "code": "tt",
    "label": "татар"
  },
  {
    "code": "tet",
    "label": "Tetum"
  },
  {
    "code": "ti",
    "label": "ትግርኛ"
  },
  {
    "code": "ts",
    "label": "Tsonga"
  },
  {
    "code": "tn",
    "label": "Setswana"
  },
  {
    "code": "tk",
    "label": "türkmen dili"
  },
  {
    "code": "ak",
    "label": "Akan"
  },
  {
    "code": "ug",
    "label": "ئۇيغۇرچە"
  },
  {
    "code": "xh",
    "label": "IsiXhosa"
  },
  {
    "code": "yi",
    "label": "ייִדיש"
  },
  {
    "code": "yo",
    "label": "Èdè Yorùbá"
  },
  {
    "code": "yua",
    "label": "Yucatec Maya"
  }
] as const satisfies readonly LanguageOption[];

export const supportedLanguageCodeSet = new Set<string>(supportedLanguageCodes.map((code) => code.toLowerCase()));

export const primaryLanguageCodes: Record<string, LanguageCode> = Object.fromEntries(
  supportedLanguageCodes.reduce<Array<[string, LanguageCode]>>((entries, code) => {
    const normalized = code.toLowerCase();
    const base = normalized.split('-')[0];
    if (!entries.some(([key]) => key === normalized)) entries.push([normalized, code]);
    if (!entries.some(([key]) => key === base)) entries.push([base, code]);
    return entries;
  }, [])
);
