// ReadHindi Context-Aware Grammar Engine & Vocabulary Teacher
// Provides accurate Part of Speech (POS) disambiguation from sentence context,
// beginner-friendly grammar explanations, Hinglish summaries, and example sentences.

// Standard Parts of Speech
export const PARTS_OF_SPEECH = {
  NOUN: "Noun",
  PRONOUN: "Pronoun",
  VERB: "Verb",
  ADJECTIVE: "Adjective",
  ADVERB: "Adverb",
  PREPOSITION: "Preposition",
  CONJUNCTION: "Conjunction",
  INTERJECTION: "Interjection",
  ARTICLE: "Article",
  UNCERTAIN: "Uncertain"
};

export const POS_HINDI_NAMES = {
  Noun: "संज्ञा (Noun)",
  Pronoun: "सर्वनाम (Pronoun)",
  Verb: "क्रिया (Verb)",
  Adjective: "विशेषण (Adjective)",
  Adverb: "क्रिया-विशेषण (Adverb)",
  Preposition: "संबंधबोधक (Preposition)",
  Conjunction: "समुच्चयबोधक (Conjunction)",
  Interjection: "विस्मयादिबोधक (Interjection)",
  Article: "उपपद (Definite/Indefinite Article)",
  Uncertain: "अस्पष्ट / संदर्भ आवश्यक (Context Needed)"
};

// Determiners & Articles
const DETERMINERS = new Set([
  "a", "an", "the", "this", "that", "these", "those",
  "my", "your", "his", "her", "its", "our", "their",
  "each", "every", "some", "any", "no", "all", "both",
  "neither", "either", "much", "many", "few", "several"
]);

// Modal & Auxiliary Verbs
const MODALS_AUX = new Set([
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "do", "does", "did", "have", "has", "had", "having",
  "is", "am", "are", "was", "were", "be", "been", "being"
]);

// Subject Pronouns
const SUBJECT_PRONOUNS = new Set([
  "i", "you", "he", "she", "it", "we", "they", "who", "whoever"
]);

// Common Prepositions
const PREPOSITIONS = new Set([
  "of", "in", "on", "at", "by", "for", "with", "about", "against", "between", "into",
  "through", "during", "before", "after", "above", "below", "to", "from", "up",
  "down", "in", "out", "over", "under", "again", "further", "then", "once",
  "across", "behind", "beyond", "without", "within", "towards", "upon", "among"
]);

// Common Conjunctions
const CONJUNCTIONS = new Set([
  "and", "but", "or", "nor", "for", "yet", "so", "although", "because",
  "since", "unless", "while", "whereas", "whether", "if", "though", "even"
]);

// Common Interjections
const INTERJECTIONS = new Set([
  "oh", "wow", "alas", "ouch", "hey", "hello", "ah", "oops", "bravo", "hurrah"
]);

// Action verbs that frequently take adverbs of manner/speed
const ACTION_VERBS = new Set([
  "run", "runs", "ran", "running",
  "drive", "drives", "drove", "driving",
  "walk", "walks", "walked", "walking",
  "speak", "speaks", "spoke", "speaking",
  "move", "moves", "moved", "moving",
  "grow", "grows", "grew", "growing",
  "work", "works", "worked", "working",
  "act", "acts", "acted", "acting"
]);

// Known Polysemous Words with Context-Specific Grammar & Definitions
export const POLYSEMOUS_WORDS = {
  present: {
    noun: {
      meaning: "उपहार / तोहफ़ा",
      alternatives: ["उपहार", "तोहफ़ा", "भेंट"],
      contextDistinction: "यहाँ 'present' का अर्थ 'उपहार' (Noun) है, न कि 'वर्तमान' (Adjective) या 'प्रस्तुत करना' (Verb)।",
      grammarExplanation: "वाक्य में 'present' एक Noun (संज्ञा) है, जो किसी वस्तु या उपहार को दर्शाता है और क्रिया के कर्म (object) के रूप में प्रयुक्त हुआ है।",
      hinglishExplanation: "Yahan 'present' ka matlab gift (tohfa) hai. Yeh sentence me ek Noun (cheez) ka kaam kar raha hai.",
      example: "She received a lovely birthday present. — उसे जन्मदिन पर एक प्यारा उपहार मिला।",
      ipa: "/ˈprez.ənt/",
      phonetic: "PREZ-uhnt"
    },
    adjective: {
      meaning: "वर्तमान / मौजूदा / उपस्थित",
      alternatives: ["वर्तमान", "मौजूदा", "उपस्थित", "हाज़िर"],
      contextDistinction: "यहाँ 'present' का अर्थ 'वर्तमान या मौजूदा' (Adjective) है, न कि 'उपहार' (Noun) या 'प्रस्तुत करना' (Verb)।",
      grammarExplanation: "वाक्य में 'present' एक Adjective (विशेषण) है, जो संज्ञा की वर्तमान स्थिति या समय को स्पष्ट कर रहा है।",
      hinglishExplanation: "Yahan 'present' ek Adjective hai, jiska matlab 'current' ya 'maujuda' sthiti hai.",
      example: "The present economic situation requires bold reforms. — मौजूदा आर्थिक स्थिति में साहसिक सुधारों की आवश्यकता है।",
      ipa: "/ˈprez.ənt/",
      phonetic: "PREZ-uhnt"
    },
    verb: {
      meaning: "प्रस्तुत करना / पेश करना",
      alternatives: ["प्रस्तुत करना", "पेश करना", "दिखाना", "हाज़िर करना"],
      contextDistinction: "यहाँ 'present' का अर्थ 'प्रस्तुत करना' (Verb) है, न कि 'उपहार' (Noun) या 'वर्तमान' (Adjective)।",
      grammarExplanation: "वाक्य में 'present' एक Verb (क्रिया) है, जो किसी चीज़ को पेश करने या दिखाने का कार्य दर्शा रहा है।",
      hinglishExplanation: "Yahan 'present' ek Verb (kriya) hai, jiska matlab report ya budget pesh/present karna hai.",
      example: "The Finance Minister will present the budget tomorrow. — वित्त मंत्री कल बजट पेश करेंगे।",
      ipa: "/prɪˈzent/",
      phonetic: "pri-ZENT"
    }
  },
  book: {
    noun: {
      meaning: "किताब",
      alternatives: ["किताब", "पुस्तक", "ग्रंथ"],
      contextDistinction: "यहाँ 'book' का अर्थ 'किताब' (Noun) है, न कि 'टिकट बुक करना' (Verb)।",
      grammarExplanation: "वाक्य में 'book' एक Noun (संज्ञा) है, जो पढ़ने की सामग्री या ग्रंथ को दर्शाता है।",
      hinglishExplanation: "Yahan 'book' ka matlab padhne wali kitaab (Noun) hai.",
      example: "He bought a new history book. — उसने इतिहास की एक नई किताब खरीदी।",
      ipa: "/bʊk/",
      phonetic: "buuk"
    },
    verb: {
      meaning: "आरक्षित करना / बुक करना / मामला दर्ज करना",
      alternatives: ["आरक्षित करना", "बुक करना", "दर्ज करना"],
      contextDistinction: "यहाँ 'book' का अर्थ 'आरक्षित करना / बुक करना' (Verb) है, न कि 'किताब' (Noun)।",
      grammarExplanation: "वाक्य में 'book' एक Verb (क्रिया) है, जो सीट, टिकट या कमरा आरक्षित करने की क्रिया को दर्शाता है।",
      hinglishExplanation: "Yahan 'book' ek Verb (kriya) hai, jiska matlab ticket ya hotel reserve karna hai.",
      example: "They decided to book flight tickets early. — उन्होंने जल्दी हवाई टिकट बुक करने का फैसला किया।",
      ipa: "/bʊk/",
      phonetic: "buuk"
    }
  },
  light: {
    noun: {
      meaning: "प्रकाश / रोशनी / बत्ती",
      alternatives: ["प्रकाश", "रोशनी", "बत्ती", "उजाला"],
      contextDistinction: "यहाँ 'light' का अर्थ 'प्रकाश या रोशनी' (Noun) है, न कि 'हल्का' (Adjective) या 'सुलगाना' (Verb)।",
      grammarExplanation: "वाक्य में 'light' एक Noun (संज्ञा) है, जो उजाले या प्रकाश के स्रोत को दर्शाता है।",
      hinglishExplanation: "Yahan 'light' ek Noun hai, jiska matlab roshni ya ujala hai.",
      example: "Sunlight is the main source of natural light. — सूर्य का प्रकाश प्राकृतिक रोशनी का मुख्य स्रोत है।",
      ipa: "/laɪt/",
      phonetic: "lyt"
    },
    adjective: {
      meaning: "हल्का / कम वज़नदार",
      alternatives: ["हल्का", "कम वज़न", "मद्धम"],
      contextDistinction: "यहाँ 'light' का अर्थ 'हल्का' (Adjective) है, न कि 'रोशनी' (Noun) या 'जलाना' (Verb)।",
      grammarExplanation: "वाक्य में 'light' एक Adjective (विशेषण) है, जो संज्ञा के कम वज़न या कम तीव्रता की विशेषता बता रहा है।",
      hinglishExplanation: "Yahan 'light' ek Adjective hai, jiska matlab kam vajan (halka) hai.",
      example: "She carried a light travel bag. — वह एक हल्का यात्रा बैग ले गई।",
      ipa: "/laɪt/",
      phonetic: "lyt"
    },
    verb: {
      meaning: "जलाना / प्रज्वलित करना / रोशनी करना",
      alternatives: ["जलाना", "प्रज्वलित करना", "सुलगाना"],
      contextDistinction: "यहाँ 'light' का अर्थ 'जलाना या रोशनी करना' (Verb) है, न कि 'किताब' या 'हल्का'।",
      grammarExplanation: "वाक्य में 'light' एक Verb (क्रिया) है, जो दिया, मोमबत्ती या आग जलाने की क्रिया को दर्शाता है।",
      hinglishExplanation: "Yahan 'light' ek Verb (kriya) hai, jiska matlab diya ya mombatti jalana hai.",
      example: "They will light candles for the ceremony. — वे समारोह के लिए मोमबत्तियाँ जलाएँगे।",
      ipa: "/laɪt/",
      phonetic: "lyt"
    }
  },
  run: {
    noun: {
      meaning: "दौड़ / चक्कर / अवधि",
      alternatives: ["दौड़", "चक्कर", "दौर", "सिलसिला"],
      contextDistinction: "यहाँ 'run' का अर्थ 'दौड़' (Noun) है, न कि 'दौड़ना' (Verb)।",
      grammarExplanation: "वाक्य में 'run' एक Noun (संज्ञा) है, जो दौड़ की गतिविधि या समय अवधि को दर्शाता है।",
      hinglishExplanation: "Yahan 'run' ek Noun hai, jaise 'morning run' ya 'cricket run'.",
      example: "He went for a quick morning run. — वह सुबह की छोटी दौड़ के लिए गया।",
      ipa: "/rʌn/",
      phonetic: "ruhn"
    },
    verb: {
      meaning: "दौड़ना / भागना / चलाना / संचालित करना",
      alternatives: ["दौड़ना", "भागना", "चलाना", "संचालित करना"],
      contextDistinction: "यहाँ 'run' का अर्थ 'दौड़ना या चलाना' (Verb) है, न कि 'दौड़' (Noun)।",
      grammarExplanation: "वाक्य में 'run' एक Verb (क्रिया) है, जो शारीरिक दौड़ या किसी संस्था/कंपनी को संचालित करने का कार्य बताता है।",
      hinglishExplanation: "Yahan 'run' ek Verb (kriya) hai, jiska matlab daudna ya business chalana hai.",
      example: "The athletes run with great speed. — एथलीट बहुत तेज़ी से दौड़ते हैं।",
      ipa: "/rʌn/",
      phonetic: "ruhn"
    }
  },
  fast: {
    noun: {
      meaning: "उपवास / व्रत",
      alternatives: ["उपवास", "व्रत", "रोज़ा"],
      contextDistinction: "यहाँ 'fast' का अर्थ 'उपवास / व्रत' (Noun) है, न कि 'तेज़' (Adjective/Adverb)।",
      grammarExplanation: "वाक्य में 'fast' एक Noun (संज्ञा) है, जो बिना भोजन के रहने के धार्मिक या स्वास्थ्य संकल्प को दर्शाता है।",
      hinglishExplanation: "Yahan 'fast' ek Noun hai, jiska matlab vrat ya upwaas hai.",
      example: "He broke his religious fast after sunset. — उसने सूर्यास्त के बाद अपना उपवास तोड़ा।",
      ipa: "/fæst/",
      phonetic: "fast"
    },
    adjective: {
      meaning: "तेज़ / तीव्र / द्रुत",
      alternatives: ["तेज़", "तीव्र", "तेज़तर्रार"],
      contextDistinction: "यहाँ 'fast' का अर्थ 'तेज़' (Adjective) है, जो संज्ञा की गति की विशेषता बता रहा है।",
      grammarExplanation: "वाक्य में 'fast' एक Adjective (विशेषण) है, जो किसी संज्ञा (जैसे ट्रेन, धावक) की उच्च गति का वर्णन करता है।",
      hinglishExplanation: "Yahan 'fast' ek Adjective hai, jo kisi cheez ki speed (tez) batata hai.",
      example: "India needs fast trains to connect major cities. — भारत को प्रमुख शहरों को जोड़ने के लिए तेज़ ट्रेनों की आवश्यकता है।",
      ipa: "/fæst/",
      phonetic: "fast"
    },
    adverb: {
      meaning: "तेज़ी से / द्रुत गति से",
      alternatives: ["तेज़ी से", "जल्दी से"],
      contextDistinction: "यहाँ 'fast' का अर्थ 'तेज़ी से' (Adverb) है, जो क्रिया (दौड़ना, बोलना, चलना) की गति बता रहा है।",
      grammarExplanation: "वाक्य में 'fast' एक Adverb (क्रिया-विशेषण) है, जो क्रिया के होने के तरीके (manner/speed) को संशोधित करता है।",
      hinglishExplanation: "Yahan 'fast' ek Adverb hai, jo batata hai ki koi kaam kitni tezi se ho raha hai.",
      example: "She typed fast to finish the assignment. — उसने काम पूरा करने के लिए तेज़ी से टाइप किया।",
      ipa: "/fæst/",
      phonetic: "fast"
    },
    verb: {
      meaning: "उपवास रखना / व्रत करना",
      alternatives: ["उपवास रखना", "व्रत करना"],
      contextDistinction: "यहाँ 'fast' का अर्थ 'उपवास रखना' (Verb) है।",
      grammarExplanation: "वाक्य में 'fast' एक Verb (क्रिया) है, जो उपवास रखने की क्रिया को दर्शाता है।",
      hinglishExplanation: "Yahan 'fast' ek Verb (kriya) hai, jiska matlab upwaas rakhna hai.",
      example: "Many devotees fast during the holy festival. — कई श्रद्धालु पवित्र त्योहार के दौरान उपवास रखते हैं।",
      ipa: "/fæst/",
      phonetic: "fast"
    }
  },
  reform: {
    noun: {
      meaning: "सुधार / बदलाव / संशोधन",
      alternatives: ["सुधार", "बदलाव", "संशोधन"],
      contextDistinction: "यहाँ 'reform' का अर्थ 'सुधार' (Noun) है।",
      grammarExplanation: "वाक्य में 'reform' एक Noun (संज्ञा) है, जो किसी व्यवस्था में बेहतरी लाने वाले बदलाव को दर्शाता है।",
      hinglishExplanation: "Yahan 'reform' ek Noun hai, jiska matlab kisi system me sudhar hai.",
      example: "Tax reform will boost compliance. — कर सुधार से नियमों का पालन बढ़ेगा।",
      ipa: "/rɪˈfɔːrm/",
      phonetic: "ri-FORM"
    },
    verb: {
      meaning: "सुधारना / बेहतर बनाना / पुनर्गठित करना",
      alternatives: ["सुधारना", "बेहतर बनाना"],
      contextDistinction: "यहाँ 'reform' का अर्थ 'सुधारना' (Verb) है।",
      grammarExplanation: "वाक्य में 'reform' एक Verb (क्रिया) है, जो सुधार करने का कार्य दर्शाता है।",
      hinglishExplanation: "Yahan 'reform' ek Verb (kriya) hai, jiska matlab kisi cheez ko sudharna hai.",
      example: "The government seeks to reform the electoral process. — सरकार चुनावी प्रक्रिया में सुधार करना चाहती है।",
      ipa: "/rɪˈfɔːrm/",
      phonetic: "ri-FORM"
    }
  },
  reforms: {
    noun: {
      meaning: "सुधार / सुधारात्मक कदम",
      alternatives: ["सुधार", "सुधारात्मक कदम", "परिवर्तन"],
      contextDistinction: "यहाँ 'reforms' बहुवचन Noun है, जिसका अर्थ 'सुधार' है।",
      grammarExplanation: "वाक्य में 'reforms' एक Plural Noun (बहुवचन संज्ञा) है।",
      hinglishExplanation: "Yahan 'reforms' Noun (sudhar) ke roop me prayukta hua hai.",
      example: "Economic reforms stimulated private investments. — आर्थिक सुधारों ने निजी निवेश को बढ़ावा दिया।",
      ipa: "/rɪˈfɔːrmz/",
      phonetic: "ri-FORMS"
    },
    verb: {
      meaning: "सुधार करता है / सुधारती है",
      alternatives: ["सुधार करता है", "बेहतर बनाता है"],
      contextDistinction: "यहाँ 'reforms' 3rd-person singular Verb है।",
      grammarExplanation: "वाक्य में 'reforms' एक Verb (क्रिया) है, जो एकवचन कर्ता के साथ प्रयुक्त हुआ है।",
      hinglishExplanation: "Yahan 'reforms' ek Verb (kriya) hai.",
      example: "The new bill reforms land acquisition rules. — नया विधेयक भूमि अधिग्रहण नियमों में सुधार करता है।",
      ipa: "/rɪˈfɔːrmz/",
      phonetic: "ri-FORMS"
    }
  },
  demand: {
    noun: {
      meaning: "मांग / आवश्यकता",
      alternatives: ["मांग", "आवश्यकता", "तकाज़ा"],
      contextDistinction: "यहाँ 'demand' का अर्थ 'मांग' (Noun) है, न कि 'मांग करना' (Verb)।",
      grammarExplanation: "वाक्य में 'demand' एक Noun (संज्ञा) है, जो बाज़ार या जनता की आवश्यकता को दर्शाता है।",
      hinglishExplanation: "Yahan 'demand' ek Noun hai, jaise market demand ya consumer demand.",
      example: "Domestic demand remains strong in India. — भारत में घरेलू मांग मजबूत बनी हुई है।",
      ipa: "/dɪˈmænd/",
      phonetic: "di-MAND"
    },
    verb: {
      meaning: "मांग करना / तकाज़ा करना",
      alternatives: ["मांग करना", "दावा करना"],
      contextDistinction: "यहाँ 'demand' का अर्थ 'मांग करना' (Verb) है।",
      grammarExplanation: "वाक्य में 'demand' एक Verb (क्रिया) है, जो अधिकारपूर्वक किसी चीज़ की मांग करने की क्रिया बताता है।",
      hinglishExplanation: "Yahan 'demand' ek Verb (kriya) hai, jiska matlab maang karna hai.",
      example: "Workers demand better safety conditions. — मज़दूर बेहतर सुरक्षा स्थितियों की मांग करते हैं।",
      ipa: "/dɪˈmænd/",
      phonetic: "di-MAND"
    }
  },
  record: {
    noun: {
      meaning: "कीर्तिमान / रिकॉर्ड / अभिलेख / दस्तावेज़",
      alternatives: ["कीर्तिमान", "रिकॉर्ड", "दस्तावेज़", "अभिलेख"],
      contextDistinction: "यहाँ 'record' का अर्थ 'कीर्तिमान या अभिलेख' (Noun) है, न कि 'दर्ज करना' (Verb)।",
      grammarExplanation: "वाक्य में 'record' एक Noun (संज्ञा) है।",
      hinglishExplanation: "Yahan 'record' ek Noun hai, jaise world record ya official record.",
      example: "The athlete set a new national record. — एथलीट ने एक नया राष्ट्रीय कीर्तिमान स्थापित किया।",
      ipa: "/ˈrek.ɚd/",
      phonetic: "REK-ord"
    },
    verb: {
      meaning: "दर्ज करना / रिकॉर्ड करना / लिख लेना",
      alternatives: ["दर्ज करना", "रिकॉर्ड करना", "अंकित करना"],
      contextDistinction: "यहाँ 'record' का अर्थ 'दर्ज करना' (Verb) है।",
      grammarExplanation: "वाक्य में 'record' एक Verb (क्रिया) है, जो जानकारी को दर्ज करने का कार्य दर्शाता है।",
      hinglishExplanation: "Yahan 'record' ek Verb (kriya) hai, jiska matlab darj karna hai.",
      example: "Cameras record all traffic violations. — कैमरे सभी ट्रैफ़िक उल्लंघनों को रिकॉर्ड करते हैं।",
      ipa: "/rɪˈkɔːrd/",
      phonetic: "ri-KORD"
    }
  },
  court: {
    noun: {
      meaning: "अदालत / न्यायालय / कोर्ट",
      alternatives: ["अदालत", "न्यायालय", "कोर्ट"],
      contextDistinction: "यहाँ 'court' का अर्थ 'न्यायालय / अदालत' (Noun) है।",
      grammarExplanation: "वाक्य में 'court' एक Noun (संज्ञा) है, जो न्याय करने वाले स्थान या संस्था को दर्शाता है।",
      hinglishExplanation: "Yahan 'court' ek Noun hai, jiska matlab adalat hai.",
      example: "The Supreme Court dismissed the appeal. — सर्वोच्च न्यायालय ने अपील खारिज कर दी।",
      ipa: "/kɔːrt/",
      phonetic: "kort"
    },
    verb: {
      meaning: "रिझाना / आकर्षित करना / ख़ास ध्यान देना",
      alternatives: ["रिझाना", "आकर्षित करना"],
      contextDistinction: "यहाँ 'court' का अर्थ 'रिझाना या आकर्षित करना' (Verb) है।",
      grammarExplanation: "वाक्य में 'court' एक Verb (क्रिया) है।",
      hinglishExplanation: "Yahan 'court' ek Verb (kriya) hai, jiska matlab voters ya investors ko rijhana hai.",
      example: "States actively court global technology companies. — राज्य वैश्विक प्रौद्योगिकी कंपनियों को आकर्षित करते हैं।",
      ipa: "/kɔːrt/",
      phonetic: "kort"
    }
  },
  state: {
    noun: {
      meaning: "राज्य / स्थिति / दशा",
      alternatives: ["राज्य", "स्थिति", "दशा"],
      contextDistinction: "यहाँ 'state' का अर्थ 'राज्य या स्थिति' (Noun) है।",
      grammarExplanation: "वाक्य में 'state' एक Noun (संज्ञा) है।",
      hinglishExplanation: "Yahan 'state' ek Noun hai, jiska matlab rajya ya halat hota hai.",
      example: "The state government approved the infrastructure budget. — राज्य सरकार ने बुनियादी ढांचा बजट को मंजूरी दी।",
      ipa: "/steɪt/",
      phonetic: "stayt"
    },
    verb: {
      meaning: "बयान करना / व्यक्त करना / कहना",
      alternatives: ["बयान करना", "व्यक्त करना", "कहना"],
      contextDistinction: "यहाँ 'state' का अर्थ 'बयान करना या स्पष्ट कहना' (Verb) है।",
      grammarExplanation: "वाक्य में 'state' एक Verb (क्रिया) है।",
      hinglishExplanation: "Yahan 'state' ek Verb (kriya) hai, jiska matlab spasht roop se kehna hai.",
      example: "Official documents state the guidelines clearly. — आधिकारिक दस्तावेज़ दिशा-निर्देशों को स्पष्ट रूप से बताते हैं।",
      ipa: "/steɪt/",
      phonetic: "stayt"
    }
  },
  following: {
    preposition: {
      meaning: "के बाद / के फलस्वरूप",
      alternatives: ["के बाद", "के फलस्वरूप", "के उपरांत", "के मद्देनज़र"],
      contextDistinction: "यहाँ 'following' एक Preposition (संबंधबोधक) है, जिसका अर्थ 'के बाद' या 'के उपरांत' (after) है, न कि क्रिया या 'अगला' (Adjective)।",
      grammarExplanation: "वाक्य में 'Following' एक Preposition (संबंधबोधक) के रूप में प्रयुक्त हुआ है, जो किसी घटना के उपरांत होने वाली कार्रवाई या परिणाम को दर्शाता है।",
      hinglishExplanation: "Yahan 'Following' ka matlab 'after' (ke baad) hai. Yeh Preposition ke roop me kisi event ke baad ki baat bata raha hai.",
      example: "Following protests against the decision, officials announced a delay. — फ़ैसले के ख़िलाफ़ प्रदर्शनों के बाद, अधिकारियों ने देरी की घोषणा की।",
      ipa: "/ˈfɑː.loʊ.ɪŋ/",
      phonetic: "FAH-loh-ing"
    },
    adjective: {
      meaning: "अगला / निम्नलिखित",
      alternatives: ["अगला", "निम्नलिखित", "आगामी"],
      contextDistinction: "यहाँ 'following' एक Adjective (विशेषण) है, जो अगले समय या आगामी सूची को दर्शाता है।",
      grammarExplanation: "वाक्य में 'following' एक Adjective है, जो संज्ञा से पहले आकर उसकी क्रमबद्ध स्थिति को स्पष्ट करता है।",
      hinglishExplanation: "Yahan 'following' ek Adjective hai, jiska matlab agla (next) ya nimnalikhit hai.",
      example: "The court will reconvene the following day. — अदालत अगले दिन पुनः बैठेगी।",
      ipa: "/ˈfɑː.loʊ.ɪŋ/",
      phonetic: "FAH-loh-ing"
    },
    verb: {
      meaning: "अनुसरण करना / पीछा करना / पालन करना",
      alternatives: ["अनुसरण करना", "पालन करना", "पीछा करना"],
      contextDistinction: "यहाँ 'following' क्रिया (Verb) के रूप में प्रयुक्त हुआ है।",
      grammarExplanation: "वाक्य में 'following' एक Verb (क्रिया) है, जो किसी नियम का पालन करने या किसी के पीछे जाने का कार्य दर्शा रहा है।",
      hinglishExplanation: "Yahan 'following' ek Verb (kriya) hai, jiska matlab follow karna ya rule manna hai.",
      example: "Citizens were following safety protocols. — नागरिक सुरक्षा नियमों का पालन कर रहे थे।",
      ipa: "/ˈfɑː.loʊ.ɪŋ/",
      phonetic: "FAH-loh-ing"
    }
  },
  the: {
    article: {
      meaning: "निश्चित उपपद (Definite Article)",
      alternatives: ["निश्चित उपपद (Definite Article)", "संज्ञा को विशिष्ट बनाने वाला शब्द"],
      contextDistinction: "अंग्रेज़ी में 'the' एक Definite Article (निश्चित उपपद) है, जो वाक्य में संज्ञा को विशिष्ट या निश्चित बनाता है।",
      grammarExplanation: "वाक्य में 'the' एक Definite Article है, जो संज्ञा के पहले लगकर उसे निश्चित बनाता है। हिंदी में इसका कोई स्वतंत्र सर्वनाम अनुवाद (जैसे 'वह') नहीं होता।",
      hinglishExplanation: "English me 'the' ek Definite Article hai jo kisi specific cheez ya vyakti ke liye use hota hai. Iska alag se 'vah' matlab nahi hota.",
      example: "The government announced a new policy. — सरकार ने एक नई नीति की घोषणा की।",
      ipa: "/ðə/",
      phonetic: "thuh"
    }
  }
};

// Tokenize sentence into clean word tokens while tracking original positions
function tokenizeSentence(sentence) {
  if (!sentence || typeof sentence !== "string") return [];
  const tokens = [];
  const re = /([A-Za-z0-9'-]+|[.,!?;:"'()[\]{}—–])/g;
  let m;
  while ((m = re.exec(sentence)) !== null) {
    tokens.push({
      text: m[1],
      lower: m[1].toLowerCase(),
      index: m.index,
      isPunctuation: /^[.,!?;:"'()[\]{}—–]$/.test(m[1])
    });
  }
  return tokens;
}

// Disambiguate Part of Speech based on sentence context
export function disambiguatePOS(targetWord, contextSentence) {
  const cleanWord = (targetWord || "").trim().toLowerCase();
  if (!cleanWord) {
    return { pos: PARTS_OF_SPEECH.UNCERTAIN, confidence: 0, reason: "No word provided" };
  }

  const cleanSentence = (contextSentence || "").replace(/\s+/g, " ").trim();
  const tokens = tokenizeSentence(cleanSentence);

  // If sentence has no substantial context (fewer than 3 tokens or sentence doesn't contain target word)
  if (!cleanSentence || tokens.length < 3) {
    if (POLYSEMOUS_WORDS[cleanWord]) {
      return {
        pos: PARTS_OF_SPEECH.UNCERTAIN,
        confidence: 0.3,
        reason: "Insufficient context for polysemous word"
      };
    }
    // Morphological fallbacks for single words
    return morphologicalPOS(cleanWord);
  }

  // Find target word token in tokens array
  let targetIdx = tokens.findIndex(t => t.lower === cleanWord);
  if (targetIdx === -1) {
    // Try matching without punctuation or matching root
    targetIdx = tokens.findIndex(t => t.lower.includes(cleanWord) || cleanWord.includes(t.lower));
  }

  if (targetIdx === -1) {
    if (POLYSEMOUS_WORDS[cleanWord]) {
      return { pos: PARTS_OF_SPEECH.UNCERTAIN, confidence: 0.3, reason: "Target word not found in sentence" };
    }
    return morphologicalPOS(cleanWord);
  }

  // Look at preceding and succeeding tokens
  const prev1 = targetIdx > 0 ? tokens[targetIdx - 1] : null;
  const prev2 = targetIdx > 1 ? tokens[targetIdx - 2] : null;
  const next1 = targetIdx < tokens.length - 1 ? tokens[targetIdx + 1] : null;
  const next2 = targetIdx < tokens.length - 2 ? tokens[targetIdx + 2] : null;

  const prev1Lower = prev1?.lower || "";
  const prev2Lower = prev2?.lower || "";
  const next1Lower = next1?.lower || "";
  const next2Lower = next2?.lower || "";

  // 0. Check closed-class words early
  if (cleanWord === "the" || cleanWord === "a" || cleanWord === "an") {
    return {
      pos: PARTS_OF_SPEECH.ARTICLE,
      confidence: 0.99,
      reason: cleanWord === "the" ? "Definite article" : "Indefinite article"
    };
  }

  // Special contextual rule for 'following' in newspaper reporting
  if (cleanWord === "following") {
    if (prev1 && ["is", "am", "are", "was", "were", "been", "be"].includes(prev1Lower)) {
      return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.95, reason: "Progressive verb following auxiliary 'be'" };
    }
    if (prev1 && ["the", "a", "this"].includes(prev1Lower) && next1 && !next1.isPunctuation) {
      return { pos: PARTS_OF_SPEECH.ADJECTIVE, confidence: 0.92, reason: "Adjective modifying noun (e.g. 'the following day')" };
    }
    if (next1 && ["day", "days", "week", "weeks", "month", "months", "year", "years", "page", "table", "chart", "examples", "questions", "paragraphs"].includes(next1Lower)) {
      return { pos: PARTS_OF_SPEECH.ADJECTIVE, confidence: 0.92, reason: "Adjective modifying time/reference noun" };
    }
    return { pos: PARTS_OF_SPEECH.PREPOSITION, confidence: 0.95, reason: "Preposition meaning 'after' / 'in the wake of'" };
  }

  if (PREPOSITIONS.has(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.PREPOSITION, confidence: 0.95, reason: "Standard preposition" };
  }
  if (CONJUNCTIONS.has(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.CONJUNCTION, confidence: 0.95, reason: "Standard conjunction" };
  }
  if (INTERJECTIONS.has(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.INTERJECTION, confidence: 0.95, reason: "Standard interjection" };
  }
  if (SUBJECT_PRONOUNS.has(cleanWord) || ["me", "him", "her", "us", "them", "my", "your", "its", "their", "our"].includes(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.PRONOUN, confidence: 0.95, reason: "Standard pronoun" };
  }

  // 1. Adverb between auxiliary/verb or ending in -ly takes priority over following auxiliary
  // e.g. "was judicially resolved", "will quickly present", "is actively working"
  if (cleanWord.endsWith("ly") && cleanWord.length > 3 && !["friendly", "lovely", "daily", "early", "silly"].includes(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.ADVERB, confidence: 0.94, reason: "Adverb suffix '-ly' in sentence context" };
  }

  // 1b. Check if preceded by infinitive "to" -> Verb
  // e.g. "to present", "to book", "to run", "to light", "to reform"
  if (prev1Lower === "to") {
    return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.95, reason: "Follows infinitive marker 'to'" };
  }

  // 1c. If preceded by Determiner + (Adjective) and followed by punctuation / end of sentence -> Noun
  // e.g. "He gave her a lovely birthday present.", "He kept a religious fast during Navratri."
  const prev3 = targetIdx > 2 ? tokens[targetIdx - 3] : null;
  const isPrecededByDeterminerPhrase = (
    DETERMINERS.has(prev1Lower) ||
    DETERMINERS.has(prev2Lower) ||
    (prev3 && DETERMINERS.has(prev3.lower))
  );
  if (isPrecededByDeterminerPhrase && (next1?.isPunctuation || !next1 || (next1Lower && PREPOSITIONS.has(next1Lower)))) {
    return { pos: PARTS_OF_SPEECH.NOUN, confidence: 0.92, reason: "Noun head of noun phrase" };
  }

  // 2. Check if preceded by modal auxiliary verbs -> Verb
  // e.g. "will present", "can run", "must book", "should light", "did demand"
  if (MODALS_AUX.has(prev1Lower)) {
    return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.95, reason: `Follows modal/auxiliary verb '${prev1Lower}'` };
  }

  // 3. Check if preceded by Subject Pronouns (I, you, he, she, we, they) -> Verb
  // e.g. "they present", "we booked", "they fast", "children run"
  if (SUBJECT_PRONOUNS.has(prev1Lower)) {
    return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.9, reason: `Follows subject pronoun '${prev1Lower}'` };
  }

  // 3b. Check Subject Noun + Verb clause pattern
  // e.g. "Devotees fast today", "The children run every morning", "Workers demand justice",
  // "Security cameras record all visitors", "The bill reforms banking oversight", "Political leaders court voters"
  const isPrevNounLike = (
    ["children", "people", "women", "men", "police", "staff", "cameras", "leaders", "bill", "checks", "investments"].includes(prev1Lower) ||
    (prev1Lower.endsWith("s") && prev1Lower.length > 3 && !["this", "thus", "his", "its", "news"].includes(prev1Lower)) ||
    (prev2Lower && DETERMINERS.has(prev2Lower))
  );

  if (isPrevNounLike && !DETERMINERS.has(prev1Lower) && !PREPOSITIONS.has(prev1Lower)) {
    const isFollowedByObjOrAdverb = next1Lower && (
      PREPOSITIONS.has(next1Lower) ||
      DETERMINERS.has(next1Lower) ||
      ["all", "better", "young", "new", "personal", "regional", "banking", "foreign", "higher", "more"].includes(next1Lower) ||
      ["today", "daily", "regularly", "often", "now", "well", "hard", "early", "late", "every", "fast", "away", "out"].includes(next1Lower)
    );
    if (isFollowedByObjOrAdverb) {
      return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.9, reason: `Predicate verb with subject '${prev1.text}'` };
    }
  }

  // Check if directly precedes another clear noun (acting as adjective/noun adjunct)
  // e.g. "the present crisis", "a fast train", "light rain", "book review", "network of fast trains"
  const isNextWordNounLike = next1 && !next1.isPunctuation && !PREPOSITIONS.has(next1Lower) &&
    !CONJUNCTIONS.has(next1Lower) && !MODALS_AUX.has(next1Lower);

  // 4. Check if preceded by action verbs of motion or past tense action verb
  if (ACTION_VERBS.has(prev1Lower) || (prev1Lower.endsWith("ed") && prev1Lower.length > 4)) {
    if (isNextWordNounLike) {
      return { pos: PARTS_OF_SPEECH.ADJECTIVE, confidence: 0.88, reason: `Adjective modifying '${next1.text}' after verb '${prev1Lower}'` };
    }
    return { pos: PARTS_OF_SPEECH.ADVERB, confidence: 0.9, reason: `Modifies action verb '${prev1Lower}'` };
  }

  // 5. Check if preceded by degree adverbs ("very", "too", "so")
  if (["very", "too", "so", "quite", "extremely"].includes(prev1Lower)) {
    if (prev2 && (ACTION_VERBS.has(prev2Lower) || prev2Lower.endsWith("ed"))) {
      // e.g. "runs very fast", "typed very fast" -> Adverb
      return { pos: PARTS_OF_SPEECH.ADVERB, confidence: 0.92, reason: "Modifies verb following degree adverb" };
    }
    // e.g. "is very light" -> Adjective
    return { pos: PARTS_OF_SPEECH.ADJECTIVE, confidence: 0.88, reason: "Complement following degree adverb" };
  }

  if ((DETERMINERS.has(prev1Lower) || PREPOSITIONS.has(prev1Lower)) && isNextWordNounLike) {
    return { pos: PARTS_OF_SPEECH.ADJECTIVE, confidence: 0.9, reason: `Modifies subsequent noun '${next1.text}'` };
  }

  // 7. Check if preceded by Determiner/Article ("the book", "a present", "a fast", "the light")
  // and followed by preposition, verb, or punctuation -> Noun
  if (DETERMINERS.has(prev1Lower)) {
    return { pos: PARTS_OF_SPEECH.NOUN, confidence: 0.92, reason: `Preceded by determiner '${prev1Lower}'` };
  }

  // 8. Check if preceded by Determiner + Adjective ("a birthday present", "a heavy book", "a morning run")
  if (DETERMINERS.has(prev2Lower) && prev1 && !prev1.isPunctuation) {
    if (!isNextWordNounLike || next1?.isPunctuation || PREPOSITIONS.has(next1Lower)) {
      return { pos: PARTS_OF_SPEECH.NOUN, confidence: 0.9, reason: "Noun head of noun phrase" };
    }
  }

  // Check if target word is followed by a relative pronoun ("that", "which", "who", "whom") + verb
  // e.g. "warnings that led to panic", "reforms that changed India", "officials who testified"
  if (next1 && ["that", "which", "who", "whom", "whose"].includes(next1Lower)) {
    if (next2 && (!DETERMINERS.has(next2Lower) || ["led", "caused", "were", "was", "resulted", "sparked", "emerged", "arose"].includes(next2Lower))) {
      return { pos: PARTS_OF_SPEECH.NOUN, confidence: 0.93, reason: "Noun antecedent of relative clause" };
    }
  }

  // 9. Imperative sentence start: Word at index 0 followed by determiner/noun
  // e.g. "Book your tickets", "Light the fire", "Present your evidence"
  // Imperatives in English are base-form verbs and never end with plural -s or -ings
  if (targetIdx === 0 && next1 && !cleanWord.endsWith("s") && (["the", "your", "a", "an", "this", "these", "those"].includes(next1Lower) || (next1Lower === "that" && next2 && !["led", "caused", "were", "was", "had", "did", "sparked", "resulted"].includes(next2Lower)))) {
    return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.88, reason: "Imperative sentence head verb" };
  }

  // 10. Check closed-class words
  if (PREPOSITIONS.has(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.PREPOSITION, confidence: 0.95, reason: "Standard preposition" };
  }
  if (CONJUNCTIONS.has(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.CONJUNCTION, confidence: 0.95, reason: "Standard conjunction" };
  }
  if (INTERJECTIONS.has(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.INTERJECTION, confidence: 0.95, reason: "Standard interjection" };
  }
  if (SUBJECT_PRONOUNS.has(cleanWord) || ["me", "him", "her", "us", "them", "my", "your", "its", "their", "our"].includes(cleanWord)) {
    return { pos: PARTS_OF_SPEECH.PRONOUN, confidence: 0.95, reason: "Standard pronoun" };
  }

  // Fallback to morphology
  return morphologicalPOS(cleanWord);
}

// Morphological analysis based on English suffixes & roots
export function morphologicalPOS(cleanWord) {
  const w = cleanWord.toLowerCase();

  // Adverbs: -ly (quickly, heavily, deliberately)
  if (w.endsWith("ly") && w.length > 3 && !["friendly", "lovely", "daily", "early", "silly"].includes(w)) {
    return { pos: PARTS_OF_SPEECH.ADVERB, confidence: 0.88, reason: "Adverb suffix '-ly'" };
  }

  // Noun suffixes
  if (w.endsWith("ings") && w.length > 5) {
    return { pos: PARTS_OF_SPEECH.NOUN, confidence: 0.92, reason: "Plural noun suffix '-ings'" };
  }
  if (/(?:tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ist|or|er)$/.test(w) && w.length > 4) {
    return { pos: PARTS_OF_SPEECH.NOUN, confidence: 0.85, reason: "Characteristic noun suffix" };
  }

  // Adjective suffixes
  if (/(?:able|ible|al|ful|ic|ive|less|ous|ish|ent|ant)$/.test(w) && w.length > 4) {
    return { pos: PARTS_OF_SPEECH.ADJECTIVE, confidence: 0.85, reason: "Characteristic adjective suffix" };
  }

  // Verb suffixes
  if (/(?:ize|ise|ify|ate|en)$/.test(w) && w.length > 4) {
    return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.85, reason: "Characteristic verb suffix" };
  }

  // Past tense / Participle
  if (w.endsWith("ed") && w.length > 4) {
    return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.75, reason: "Past participle / verb '-ed'" };
  }

  // Present participle
  if (w.endsWith("ing") && w.length > 4) {
    return { pos: PARTS_OF_SPEECH.VERB, confidence: 0.75, reason: "Continuous participle '-ing'" };
  }

  // Default fallback for general nouns
  return { pos: PARTS_OF_SPEECH.NOUN, confidence: 0.65, reason: "Default lexical category" };
}

// Comprehensive Teacher Analysis combining Context, POS, and Hindi pedagogical explanations
export function analyzeWordInContext(word, contextSentence = "") {
  const clean = (word || "").trim();
  const lower = clean.toLowerCase();

  const { pos, confidence, reason } = disambiguatePOS(clean, contextSentence);
  const isCertain = pos !== PARTS_OF_SPEECH.UNCERTAIN && confidence >= 0.5;

  const polyData = POLYSEMOUS_WORDS[lower];

  // If word is known polysemous word and we have context
  if (polyData) {
    const posKey = pos.toLowerCase();
    if (polyData[posKey]) {
      const entry = polyData[posKey];
      return {
        word: clean,
        meaning: entry.meaning,
        alternatives: entry.alternatives,
        pos,
        posHindi: POS_HINDI_NAMES[pos] || pos,
        posConfidence: confidence,
        contextMeaning: entry.meaning,
        contextDistinction: entry.contextDistinction,
        sentence: contextSentence || entry.example,
        grammarExplanation: entry.grammarExplanation,
        hinglishExplanation: entry.hinglishExplanation,
        exampleSentence: entry.example.split("—")[0].trim(),
        exampleHindi: entry.example.split("—")[1]?.trim() || "",
        ipa: entry.ipa,
        phonetic: entry.phonetic,
        isContextCertain: true,
        reason
      };
    }

    // Polysemous word without sufficient context
    const firstKey = Object.keys(polyData)[0];
    const defaultEntry = polyData[firstKey];
    return {
      word: clean,
      meaning: defaultEntry.meaning,
      alternatives: defaultEntry.alternatives,
      pos: PARTS_OF_SPEECH.UNCERTAIN,
      posHindi: POS_HINDI_NAMES[PARTS_OF_SPEECH.UNCERTAIN],
      posConfidence: 0.3,
      contextMeaning: defaultEntry.meaning,
      contextDistinction: `यह शब्द संदर्भ के अनुसार Noun, Verb या Adjective हो सकता है। सटीक भूमिका जानने के लिए इसे वाक्य में चुनें।`,
      sentence: contextSentence,
      grammarExplanation: "पर्याप्त वाक्य संदर्भ उपलब्ध नहीं है। शब्द की सटीक व्याकरण भूमिका जानने के लिए कृपया पूरे वाक्य में शब्द का चयन करें।",
      hinglishExplanation: "Poora context milne par POS aur grammatical role confirm ho sakega.",
      exampleSentence: defaultEntry.example.split("—")[0].trim(),
      exampleHindi: defaultEntry.example.split("—")[1]?.trim() || "",
      ipa: defaultEntry.ipa,
      phonetic: defaultEntry.phonetic,
      isContextCertain: false,
      reason: "Insufficient context"
    };
  }

  // General vocabulary analysis
  let grammarExp = "";
  let hinglishExp = "";

  switch (pos) {
    case PARTS_OF_SPEECH.NOUN:
      grammarExp = `वाक्य में '${clean}' एक Noun (संज्ञा) के रूप में कार्य कर रहा है, जो किसी व्यक्ति, स्थान, वस्तु, विचार या विषय को दर्शाता है।`;
      hinglishExp = `Yahan '${clean}' ek Noun (naam ya cheez) hai.`;
      break;
    case PARTS_OF_SPEECH.VERB:
      grammarExp = `वाक्य में '${clean}' एक Verb (क्रिया) है, जो वाक्य के कर्ता (subject) के कार्य, स्थिति या घटना को व्यक्त करता है।`;
      hinglishExp = `Yahan '${clean}' ek Verb (kriya / action) hai.`;
      break;
    case PARTS_OF_SPEECH.ADJECTIVE:
      grammarExp = `वाक्य में '${clean}' एक Adjective (विशेषण) है, जो संज्ञा की विशेषता, गुण या स्थिति का वर्णन कर रहा है।`;
      hinglishExp = `Yahan '${clean}' ek Adjective hai, jo kisi Noun ki quality batata hai.`;
      break;
    case PARTS_OF_SPEECH.ADVERB:
      grammarExp = `वाक्य में '${clean}' एक Adverb (क्रिया-विशेषण) है, जो क्रिया, विशेषण या अन्य क्रिया-विशेषण के ढंग, गति या तीव्रता को संशोधित करता है।`;
      hinglishExp = `Yahan '${clean}' ek Adverb hai, jo action kaise hua yeh batata hai.`;
      break;
    case PARTS_OF_SPEECH.PREPOSITION:
      grammarExp = `वाक्य में '${clean}' एक Preposition (संबंधबोधक) है, जो संज्ञा/सर्वनाम का वाक्य के अन्य शब्दों से संबंध जोड़ता है।`;
      hinglishExp = `Yahan '${clean}' ek Preposition hai jo location ya relation batata hai.`;
      break;
    case PARTS_OF_SPEECH.CONJUNCTION:
      grammarExp = `वाक्य में '${clean}' एक Conjunction (समुच्चयबोधक) है, जो दो शब्दों, वाक्यांशों या उपवाक्यों को आपस में जोड़ता है।`;
      hinglishExp = `Yahan '${clean}' do sentences ya words ko jodne wala Conjunction hai.`;
      break;
    case PARTS_OF_SPEECH.PRONOUN:
      grammarExp = `वाक्य में '${clean}' एक Pronoun (सर्वनाम) है, जो संज्ञा के स्थान पर दोहराव से बचने के लिए प्रयुक्त हुआ है।`;
      hinglishExp = `Yahan '${clean}' ek Pronoun (sarvanaam) hai.`;
      break;
    case PARTS_OF_SPEECH.ARTICLE:
      grammarExp = `अंग्रेज़ी में '${clean}' एक Article (उपपद) है, जो संज्ञा से पहले लगकर उसकी विशिष्टता (Definite) या सामान्यता (Indefinite) को दर्शाता है। हिंदी में इसका स्वतंत्र अनुवाद नहीं होता।`;
      hinglishExp = `English me '${clean}' ek Article hai jo Noun ko specific ya general banata hai. Iska alag se swatantra matlab nahi hota.`;
      break;
    default:
      grammarExp = `वाक्य में '${clean}' का व्याकरणिक उपयोग संदर्भ पर निर्भर करता है।`;
      hinglishExp = `Yahan '${clean}' ka role context ke anusar dekha jata hai.`;
      break;
  }

  return {
    word: clean,
    meaning: "", // Will be filled by dictionary lookup
    alternatives: [],
    pos,
    posHindi: POS_HINDI_NAMES[pos] || pos,
    posConfidence: confidence,
    contextMeaning: "",
    contextDistinction: `यहाँ '${clean}' ${pos} के रूप में प्रयुक्त हुआ है।`,
    sentence: contextSentence,
    grammarExplanation: grammarExp,
    hinglishExplanation: hinglishExp,
    exampleSentence: "",
    exampleHindi: "",
    ipa: `/${clean}/`,
    phonetic: clean,
    isContextCertain: isCertain,
    reason
  };
}
