// ReadHindi Dictionary & Translation Service
// Multi-tier: Context-Aware Grammar Engine -> Built-in editorial vocabulary -> LocalStorage Cache -> Free Translation Fallbacks

import { analyzeWordInContext, POLYSEMOUS_WORDS } from "./grammarEngine.js";

export const BUILTIN_DICTIONARY = {
  growth: {
    word: "growth",
    ipa: "/ɡroʊθ/",
    meaning: "विकास",
    alternatives: ["विकास", "वृद्धि", "उन्नति", "विस्तार"],
    sentence: "India's growth story remains strong. — भारत की विकास यात्रा मज़बूत बनी हुई है।"
  },
  resilient: {
    word: "resilient",
    ipa: "/rɪˈzɪl.jənt/",
    meaning: "लचीला",
    alternatives: ["लचीला", "मजबूत", "सहनशील", "टिकाऊ"],
    sentence: "The banking system is resilient against shocks. — बैंकिंग प्रणाली झटकों को सहने में सक्षम और मजबूत है।"
  },
  reforms: {
    word: "reforms",
    ipa: "/rɪˈfɔːrmz/",
    meaning: "सुधार",
    alternatives: ["सुधार", "परिवर्तन", "सुधारात्मक कदम"],
    sentence: "The government announced economic reforms. — सरकार ने आर्थिक सुधारों की घोषणा की।"
  },
  reform: {
    word: "reform",
    ipa: "/rɪˈfɔːrm/",
    meaning: "सुधार",
    alternatives: ["सुधार", "संशोधन", "बेहतरी"],
    sentence: "Tax reform is essential for growth. — विकास के लिए कर सुधार आवश्यक है।"
  },
  demand: {
    word: "demand",
    ipa: "/dɪˈmænd/",
    meaning: "मांग",
    alternatives: ["मांग", "आवश्यकता", "इच्छा", "तकाज़ा"],
    sentence: "Domestic demand continues to drive output. — घरेलू मांग उत्पादन को आगे बढ़ा रही है।"
  },
  the: {
    word: "the",
    ipa: "/ðə/",
    meaning: "निश्चित उपपद (Definite Article)",
    alternatives: ["निश्चित उपपद (Definite Article)", "संज्ञा को विशिष्ट बनाने वाला शब्द"],
    sentence: "The government announced a new policy. — सरकार ने एक नई नीति की घोषणा की।"
  },
  following: {
    word: "following",
    ipa: "/ˈfɑː.loʊ.ɪŋ/",
    meaning: "के बाद / के फलस्वरूप",
    alternatives: ["के बाद", "के फलस्वरूप", "के उपरांत", "के मद्देनज़र"],
    sentence: "Following protests against the decision, officials announced a delay. — फ़ैसले के ख़िलाफ़ प्रदर्शनों के बाद, अधिकारियों ने देरी की घोषणा की।"
  },
  when: {
    word: "when",
    ipa: "/wen/",
    meaning: "जब / जिस समय",
    alternatives: ["जब", "जिस समय", "उस समय", "कब", "जब कि"],
    sentence: "They were walking towards the exit when chaos broke out. — वे निकास की ओर बढ़ रहे थे जब अचानक भगदड़ मच गई।"
  },
  uttarakhand: {
    word: "Uttarakhand",
    ipa: "/ˌʊt.ər.ɑːˈkʌnd/",
    meaning: "उत्तराखंड (भारतीय राज्य)",
    alternatives: ["उत्तराखंड", "उत्तरांचल"],
    sentence: "Special summary revision was announced for Uttarakhand and Punjab. — उत्तराखंड और पंजाब के लिए विशेष संक्षिप्त पुनरीक्षण की घोषणा की गई।"
  },
  uttar: {
    word: "Uttar",
    ipa: "/ˈʊt.ər/",
    meaning: "उत्तर (दिशा या उत्तर प्रदेश का भाग)",
    alternatives: ["उत्तर", "उत्तरी"],
    sentence: "Uttar Pradesh announced summary revisions. — उत्तर प्रदेश ने संक्षिप्त पुनरीक्षण की घोषणा की।"
  },
  economy: {
    word: "economy",
    ipa: "/ɪˈkɑː.nə.mi/",
    meaning: "अर्थव्यवस्था",
    alternatives: ["अर्थव्यवस्था", "आर्थिक स्थिति", "किफ़ायत"],
    sentence: "The national economy showed solid progress. — राष्ट्रीय अर्थव्यवस्था ने ठोस प्रगति दिखाई।"
  },
  economic: {
    word: "economic",
    ipa: "/ˌek.əˈnɑː.mɪk/",
    meaning: "आर्थिक",
    alternatives: ["आर्थिक", "वित्तीय", "अर्थशास्त्र संबंधी"],
    sentence: "Economic stability attracts foreign investment. — आर्थिक स्थिरता विदेशी निवेश को आकर्षित करती है।"
  },
  strong: {
    word: "strong",
    ipa: "/strɔːŋ/",
    meaning: "मजबूत",
    alternatives: ["मजबूत", "शक्तिशाली", "दृढ़", "ठोस"],
    sentence: "Consumer confidence remains strong. — उपभोक्ताओं का विश्वास मजबूत बना हुआ है।"
  },
  positive: {
    word: "positive",
    ipa: "/ˈpɑː.zə.tɪv/",
    meaning: "सकारात्मक",
    alternatives: ["सकारात्मक", "अनुकूल", "आशावादी"],
    sentence: "The quarterly report showed positive results. — त्रैमासिक रिपोर्ट में सकारात्मक परिणाम दिखे।"
  },
  focus: {
    word: "focus",
    ipa: "/ˈfoʊ.kəs/",
    meaning: "ध्यान केंद्रित करना",
    alternatives: ["ध्यान केंद्रित करना", "मुख्य विषय", "केंद्र बिंदु", "लक्ष्य"],
    sentence: "The policy focuses on clean energy transition. — नीति का मुख्य ध्यान स्वच्छ ऊर्जा बदलाव पर है।"
  },
  inflation: {
    word: "inflation",
    ipa: "/ɪnˈfleɪ.ʃən/",
    meaning: "महँगाई",
    alternatives: ["महँगाई", "मुद्रास्फीति", "मूल्य वृद्धि"],
    sentence: "The central bank acted quickly to cool inflation. — केंद्रीय बैंक ने महंगाई घटाने के लिए त्वरित कदम उठाए।"
  },
  employment: {
    word: "employment",
    ipa: "/ɪmˈplɔɪ.mənt/",
    meaning: "रोज़गार",
    alternatives: ["रोज़गार", "नियोजन", "नौकरी", "काम"],
    sentence: "New factories are boosting local employment. — नए कारखाने स्थानीय रोज़गार को बढ़ावा दे रहे हैं।"
  },
  unemployment: {
    word: "unemployment",
    ipa: "/ˌʌn.ɪmˈplɔɪ.mənt/",
    meaning: "बेरोज़गारी",
    alternatives: ["बेरोज़गारी", "काम की कमी"],
    sentence: "Youth unemployment declined this year. — इस वर्ष युवा बेरोज़गारी में कमी आई।"
  },
  policy: {
    word: "policy",
    ipa: "/ˈpɑː.lə.si/",
    meaning: "नीति",
    alternatives: ["नीति", "कार्यनीति", "नियम", "रणनीति"],
    sentence: "The industrial policy was revised. — औद्योगिक नीति में संशोधन किया गया।"
  },
  structural: {
    word: "structural",
    ipa: "/ˈstrʌk.tʃɚ.əl/",
    meaning: "संरचनात्मक",
    alternatives: ["संरचनात्मक", "ढाँचागत", "मूलभूत"],
    sentence: "Structural changes improved production efficiency. — ढांचागत बदलावों ने उत्पादन क्षमता बढ़ाई।"
  },
  assessment: {
    word: "assessment",
    ipa: "/əˈses.mənt/",
    meaning: "आकलन",
    alternatives: ["आकलन", "मूल्यांकन", "जाँच", "समीक्षा"],
    sentence: "The assessment highlighted key market risks. — मूल्यांकन ने बाज़ार के मुख्य जोखिमों को रेखांकित किया।"
  },
  commitment: {
    word: "commitment",
    ipa: "/kəˈmɪt.mənt/",
    meaning: "प्रतिबद्धता",
    alternatives: ["प्रतिबद्धता", "वचनबद्धता", "संकल्प"],
    sentence: "India reiterated its commitment to peace. — भारत ने शांति के प्रति अपनी प्रतिबद्धता दोहराई।"
  },
  recovery: {
    word: "recovery",
    ipa: "/rɪˈkʌv.ɚ.i/",
    meaning: "सुधार",
    alternatives: ["सुधार", "वसूली", "पुनरुद्धार", "स्वास्थ्य लाभ"],
    sentence: "A steady economic recovery is underway. — एक स्थिर आर्थिक सुधार जारी है।"
  },
  banking: {
    word: "banking",
    ipa: "/ˈbæŋ.kɪŋ/",
    meaning: "बैंकिंग",
    alternatives: ["बैंकिंग", "बैंक का काम", "महाजनी"],
    sentence: "Digital banking adoption has surged nationwide. — डिजिटल बैंकिंग का उपयोग देश भर में बढ़ा है।"
  },
  system: {
    word: "system",
    ipa: "/ˈsɪs.təm/",
    meaning: "प्रणाली",
    alternatives: ["प्रणाली", "व्यवस्था", "तंत्र", "पद्धति"],
    sentence: "The electoral system ensures fair voting. — चुनावी प्रणाली निष्पक्ष मतदान सुनिश्चित करती है।"
  },
  domestic: {
    word: "domestic",
    ipa: "/dəˈmes.tɪk/",
    meaning: "घरेलू",
    alternatives: ["घरेलू", "देशीय", "आंतरिक"],
    sentence: "Domestic airlines expanded passenger capacity. — घरेलू एयरलाइनों ने यात्री क्षमता का विस्तार किया।"
  },
  market: {
    word: "market",
    ipa: "/ˈmɑːr.kɪt/",
    meaning: "बाज़ार",
    alternatives: ["बाज़ार", "मंडी", "क्रय-विक्रय स्थल"],
    sentence: "Stock markets reached new all-time highs. — शेयर बाज़ारों ने नए ऐतिहासिक स्तर छुए।"
  },
  bank: {
    word: "bank",
    ipa: "/bæŋk/",
    meaning: "बैंक",
    alternatives: ["बैंक", "तट", "किनारा"],
    sentence: "The Reserve Bank kept interest rates unchanged. — रिज़र्व बैंक ने ब्याज दरों को अपरिवर्तित रखा।"
  },
  development: {
    word: "development",
    ipa: "/dɪˈvel.əp.mənt/",
    meaning: "विकास",
    alternatives: ["विकास", "प्रगति", "उन्नति", "विस्तार"],
    sentence: "Sustainable development is a national priority. — सतत विकास एक राष्ट्रीय प्राथमिकता है।"
  },
  substantial: {
    word: "substantial",
    ipa: "/səbˈstæn.ʃəl/",
    meaning: "पर्याप्त",
    alternatives: ["पर्याप्त", "महत्वपूर्ण", "ठोस", "काफी बड़ा"],
    sentence: "The sector received substantial investment. — इस क्षेत्र को पर्याप्त निवेश मिला।"
  },
  significant: {
    word: "significant",
    ipa: "/sɪɡˈnɪf.ə.kənt/",
    meaning: "महत्वपूर्ण",
    alternatives: ["महत्वपूर्ण", "उल्लेखनीय", "सार्थक", "काफी"],
    sentence: "The summit achieved significant breakthroughs. — शिखर सम्मेलन ने महत्वपूर्ण सफलताएँ हासिल कीं।"
  },
  challenge: {
    word: "challenge",
    ipa: "/ˈtʃæl.ɪndʒ/",
    meaning: "चुनौती",
    alternatives: ["चुनौती", "कठिनाई", "मुश्किल"],
    sentence: "Rising global energy costs remain a challenge. — बढ़ती वैश्विक ऊर्जा लागत एक चुनौती बनी हुई है।"
  },
  approach: {
    word: "approach",
    ipa: "/əˈproʊtʃ/",
    meaning: "दृष्टिकोण",
    alternatives: ["दृष्टिकोण", "पहुंच", "तरीका", "समीप आना"],
    sentence: "A balanced approach is needed to tackle deficits. — घाटे से निपटने के लिए एक संतुलित दृष्टिकोण की आवश्यकता है।"
  },
  evidence: {
    word: "evidence",
    ipa: "/ˈev.ə.dəns/",
    meaning: "सबूत",
    alternatives: ["सबूत", "प्रमाण", "गवाही"],
    sentence: "There is clear evidence of export recovery. — निर्यात में सुधार के स्पष्ट प्रमाण हैं।"
  },
  analysis: {
    word: "analysis",
    ipa: "/əˈnæl.ə.sɪs/",
    meaning: "विश्लेषण",
    alternatives: ["विश्लेषण", "बारीक जाँच", "परीक्षण"],
    sentence: "The fiscal analysis was published yesterday. — वित्तीय विश्लेषण कल प्रकाशित हुआ था।"
  },
  impact: {
    word: "impact",
    ipa: "/ˈɪm.pækt/",
    meaning: "प्रभाव",
    alternatives: ["प्रभाव", "असर", "टक्कर"],
    sentence: "The new tax policy will have a positive impact. — नई कर नीति का सकारात्मक प्रभाव पड़ेगा।"
  },
  government: {
    word: "government",
    ipa: "/ˈɡʌv.ɚn.mənt/",
    meaning: "सरकार",
    alternatives: ["सरकार", "शासन", "हुकूमत"],
    sentence: "The government announced relief packages. — सरकार ने राहत पैकेजों की घोषणा की।"
  },
  president: {
    word: "president",
    ipa: "/ˈprez.ɪ.dənt/",
    meaning: "राष्ट्रपति",
    alternatives: ["राष्ट्रपति", "अध्यक्ष", "सभापति"],
    sentence: "The President addressed the joint session. — राष्ट्रपति ने संयुक्त सत्र को संबोधित किया।"
  },
  minister: {
    word: "minister",
    ipa: "/ˈmɪn.ə.stɚ/",
    meaning: "मंत्री",
    alternatives: ["मंत्री", "वज़ीर", "कार्यकारी अधिकारी"],
    sentence: "The finance minister presented the annual budget. — वित्त मंत्री ने वार्षिक बजट पेश किया।"
  },
  parliament: {
    word: "parliament",
    ipa: "/ˈpɑːr.lə.mənt/",
    meaning: "संसद",
    alternatives: ["संसद", "व्यवस्थापिका सभा"],
    sentence: "Parliament passed the landmark infrastructure bill. — संसद ने ऐतिहासिक बुनियादी ढांचा विधेयक पारित किया।"
  },
  judiciary: {
    word: "judiciary",
    ipa: "/dʒuːˈdɪʃ.i.er.i/",
    meaning: "न्यायपालिका",
    alternatives: ["न्यायपालिका", "अदालती व्यवस्था", "न्यायालय"],
    sentence: "An independent judiciary upholds the constitution. — एक स्वतंत्र न्यायपालिका संविधान की रक्षा करती है।"
  },
  court: {
    word: "court",
    ipa: "/kɔːrt/",
    meaning: "अदालत",
    alternatives: ["अदालत", "न्यायालय", "कचहरी"],
    sentence: "The Supreme Court delivered its verdict today. — सुप्रीम कोर्ट ने आज अपना फैसला सुनाया।"
  },
  justice: {
    word: "justice",
    ipa: "/ˈdʒʌs.tɪs/",
    meaning: "न्याय",
    alternatives: ["न्याय", "इंसाफ", "न्यायाधीश"],
    sentence: "Every citizen is entitled to equal justice. — प्रत्येक नागरिक समान न्याय का हकदार है।"
  },
  security: {
    word: "security",
    ipa: "/səˈkjʊr.ə.t̬i/",
    meaning: "सुरक्षा",
    alternatives: ["सुरक्षा", "बचाव", "ज़मानत", "प्रतिभूति"],
    sentence: "Border security measures have been strengthened. — सीमा सुरक्षा उपायों को सुदृढ़ किया गया है।"
  },
  technology: {
    word: "technology",
    ipa: "/tekˈnɑː.lə.dʒi/",
    meaning: "तकनीक",
    alternatives: ["तकनीक", "प्रौद्योगिकी", "शिल्प-विज्ञान"],
    sentence: "Modern technology drives industrial innovation. — आधुनिक तकनीक औद्योगिक नवाचार को गति देती है।"
  },
  innovation: {
    word: "innovation",
    ipa: "/ˌɪn.əˈveɪ.ʃən/",
    meaning: "नवाचार",
    alternatives: ["नवाचार", "नई खोज", "नवीनता"],
    sentence: "Technological innovation fuels startup ecosystems. — तकनीकी नवाचार स्टार्टअप परिवेश को मजबूत करता है।"
  },
  infrastructure: {
    word: "infrastructure",
    ipa: "/ˈɪn.frəˌstrʌk.tʃɚ/",
    meaning: "बुनियादी ढाँचा",
    alternatives: ["बुनियादी ढाँचा", "आधारभूत संरचना"],
    sentence: "Highway and rail infrastructure saw record spending. — हाईवे और रेल बुनियादी ढांचे में रिकॉर्ड खर्च देखा गया।"
  },
  agriculture: {
    word: "agriculture",
    ipa: "/ˈæɡ.rə.kʌl.tʃɚ/",
    meaning: "कृषि",
    alternatives: ["कृषि", "खेतीबाड़ी", "काश्तकारी"],
    sentence: "Agriculture remains the backbone of rural livelihoods. — कृषि ग्रामीण आजीविका की रीढ़ बनी हुई है।"
  },
  budget: {
    word: "budget",
    ipa: "/ˈbʌdʒ.ɪt/",
    meaning: "बजट",
    alternatives: ["बजट", "आय-व्यय का विवरण"],
    sentence: "The budget prioritized healthcare and public schools. — बजट ने स्वास्थ्य सेवा और सरकारी स्कूलों को प्राथमिकता दी।"
  },
  investment: {
    word: "investment",
    ipa: "/ɪnˈvest.mənt/",
    meaning: "निवेश",
    alternatives: ["निवेश", "पूंजी लगाना"],
    sentence: "Foreign direct investment rose sharply this quarter. — इस तिमाही में प्रत्यक्ष विदेशी निवेश तेजी से बढ़ा।"
  },
  global: {
    word: "global",
    ipa: "/ˈɡloʊ.bəl/",
    meaning: "वैश्विक",
    alternatives: ["वैश्विक", "विश्वव्यापी", "सार्वभौमिक"],
    sentence: "Global trade negotiations resumed in Geneva. — जिनेवा में वैश्विक व्यापार वार्ता फिर से शुरू हुई।"
  },
  international: {
    word: "international",
    ipa: "/ˌɪn.t̬ɚˈnæʃ.ən.əl/",
    meaning: "अंतर्राष्ट्रीय",
    alternatives: ["अंतर्राष्ट्रीय", "अंतरदेशीय"],
    sentence: "International cooperation is vital for climate action. — जलवायु कार्रवाई के लिए अंतर्राष्ट्रीय सहयोग अत्यंत आवश्यक है।"
  },
  treaty: {
    word: "treaty",
    ipa: "/ˈtriː.t̬i/",
    meaning: "संधि",
    alternatives: ["संधि", "समझौता", "करार"],
    sentence: "Both nations signed a historic peace treaty. — दोनों देशों ने एक ऐतिहासिक शांति संधि पर हस्ताक्षर किए।"
  },
  crisis: {
    word: "crisis",
    ipa: "/ˈkraɪ.sɪs/",
    meaning: "संकट",
    alternatives: ["संकट", "मुसीबत", "विपत्ति"],
    sentence: "Diplomats worked tirelessly to defuse the border crisis. — राजनयिकों ने सीमा संकट को टालने के लिए अथक प्रयास किया।"
  },
  education: {
    word: "education",
    ipa: "/ˌedʒ.ʊˈkeɪ.ʃən/",
    meaning: "शिक्षा",
    alternatives: ["शिक्षा", "तालीम", "विद्या"],
    sentence: "Quality education empowers every young person. — गुणवत्तापूर्ण शिक्षा हर युवा को सशक्त बनाती है।"
  },
  health: {
    word: "health",
    ipa: "/helθ/",
    meaning: "स्वास्थ्य",
    alternatives: ["स्वास्थ्य", "तंदुरुस्ती", "आरोग्य"],
    sentence: "Universal health coverage remains an urgent goal. — सार्वभौमिक स्वास्थ्य सेवा एक अत्यंत महत्वपूर्ण लक्ष्य बना हुआ है।"
  },
  discovery: {
    word: "discovery",
    ipa: "/dɪˈskʌv.ɚ.i/",
    meaning: "खोज",
    alternatives: ["खोज", "अन्वेषण", "पता लगाना"],
    sentence: "The scientific discovery opened new medical avenues. — इस वैज्ञानिक खोज ने चिकित्सा के नए रास्ते खोले।"
  },
  trade: {
    word: "trade",
    ipa: "/treɪd/",
    meaning: "व्यापार",
    alternatives: ["व्यापार", "वाणिज्य", "लेन-देन"],
    sentence: "Bilateral trade reached ninety billion dollars. — द्विपक्षीय व्यापार नब्बे अरब डॉलर तक पहुँच गया।"
  },
  revenue: {
    word: "revenue",
    ipa: "/ˈrev.ə.nuː/",
    meaning: "राजस्व",
    alternatives: ["राजस्व", "आय", "कमाई"],
    sentence: "GST revenue collections broke previous records. — जीएसटी राजस्व संग्रह ने पिछले रिकॉर्ड तोड़ दिए।"
  },
  sustainable: {
    word: "sustainable",
    ipa: "/səˈsteɪ.nə.bəl/",
    meaning: "सतत",
    alternatives: ["सतत", "टिकाऊ", "पर्यावरण-अनुकूल"],
    sentence: "Sustainable agriculture protects water tables. — सतत कृषि भूजल स्तर की रक्षा करती है।"
  },
  environment: {
    word: "environment",
    ipa: "/ɪnˈvaɪ.rən.mənt/",
    meaning: "पर्यावरण",
    alternatives: ["पर्यावरण", "वातावरण", "माहौल"],
    sentence: "Protecting the forest environment preserves biodiversity. — वन पर्यावरण की रक्षा जैव विविधता को बनाए रखती है।"
  },
  climate: {
    word: "climate",
    ipa: "/ˈklaɪ.mət/",
    meaning: "जलवायु",
    alternatives: ["जलवायु", "मौसम", "आबोहवा"],
    sentence: "Climate commitments will be reviewed at COP. — जलवायु प्रतिबद्धताओं की समीक्षा सीओपी में की जाएगी।"
  },
  india: {
    word: "india",
    ipa: "/ˈɪn.di.ə/",
    meaning: "भारत",
    alternatives: ["भारत", "हिन्दुस्तान"],
    sentence: "India's technological leap inspires the world. — भारत की तकनीकी छलांग दुनिया को प्रेरित करती है।"
  },
  newspaper: {
    word: "newspaper",
    ipa: "/ˈnuːzˌpeɪ.pɚ/",
    meaning: "अख़बार",
    alternatives: ["अख़बार", "समाचार पत्र"],
    sentence: "Morning newspapers reported the election outcome. — सुबह के अखबारों ने चुनाव परिणामों की खबर दी।"
  },
  important: {
    word: "important",
    ipa: "/ɪmˈpɔːr.tənt/",
    meaning: "महत्वपूर्ण",
    alternatives: ["महत्वपूर्ण", "ज़रूरी", "प्रमुख", "अहम"],
    sentence: "Vocational training is an important pillar. — व्यावसायिक प्रशिक्षण एक महत्वपूर्ण स्तंभ है।"
  },
  rapidly: {
    word: "rapidly",
    ipa: "/ˈræp.ɪd.li/",
    meaning: "तेज़ी से",
    alternatives: ["तेज़ी से", "शीघ्रता से", "तीव्र गति से"],
    sentence: "Renewable capacity is expanding rapidly. — नवीकरणीय क्षमता तेजी से बढ़ रही है।"
  },
  effective: {
    word: "effective",
    ipa: "/əˈfek.tɪv/",
    meaning: "प्रभावी",
    alternatives: ["प्रभावी", "असरदार", "कारगर"],
    sentence: "The measures proved highly effective. — ये उपाय अत्यधिक प्रभावी साबित हुए।"
  },
  improve: {
    word: "improve",
    ipa: "/ɪmˈpruːv/",
    meaning: "सुधारना",
    alternatives: ["सुधारना", "बेहतर बनाना", "सुधरना"],
    sentence: "Digital tools improve bureaucratic transparency. — डिजिटल उपकरण प्रशासनिक पारदर्शिता को बेहतर बनाते हैं।"
  },
  achieve: {
    word: "achieve",
    ipa: "/əˈtʃiːv/",
    meaning: "हासिल करना",
    alternatives: ["हासिल करना", "प्राप्त करना", "सफल होना"],
    sentence: "The nation strives to achieve zero emissions. — देश शून्य कार्बन उत्सर्जन प्राप्त करने का प्रयास कर रहा है।"
  },
  issue: {
    word: "issue",
    ipa: "/ˈɪʃ.uː/",
    meaning: "मुद्दा",
    alternatives: ["मुद्दा", "समस्या", "जारी करना", "अंक"],
    sentence: "Water scarcity is an urgent civic issue. — पानी की कमी एक अत्यंत गंभीर नागरिक मुद्दा है।"
  },
  remains: {
    word: "remains",
    ipa: "/rɪˈmeɪnz/",
    meaning: "बना रहता है",
    alternatives: ["बना रहता है", "शेष रहता है", "अवशेष"],
    sentence: "The fiscal stance remains prudent and supportive. — वित्तीय रुख सतर्क और विकास-समर्थक बना हुआ है।"
  },
  story: {
    word: "story",
    ipa: "/ˈstɔːr.i/",
    meaning: "कहानी",
    alternatives: ["कहानी", "विवरण", "कथा", "वृत्तांत"],
    sentence: "India's growth story attracts global attention. — भारत की विकास गाथा वैश्विक ध्यान आकर्षित करती है।"
  },
  optimistic: {
    word: "optimistic",
    ipa: "/ˌɑːp.təˈmɪs.tɪk/",
    meaning: "आशावादी",
    alternatives: ["आशावादी", "सकारात्मक"],
    sentence: "Analysts are optimistic about the upcoming festival quarter. — विश्लेषक आगामी त्योहारी तिमाही को लेकर आशावादी हैं।"
  },
  interest: {
    word: "interest",
    ipa: "/ˈɪn.trɪst/",
    meaning: "ब्याज",
    alternatives: ["ब्याज", "रुचि", "हित", "दिलचस्पी"],
    sentence: "Lower interest rates encourage home buying. — कम ब्याज दरें घर खरीदने को प्रोत्साहित करती हैं।"
  },
  current: {
    word: "current",
    ipa: "/ˈkɝː.ənt/",
    meaning: "वर्तमान",
    alternatives: ["वर्तमान", "मौजूदा", "धारा", "प्रवाह"],
    sentence: "The current account deficit narrowed significantly. — चालू खाता घाटा उल्लेखनीय रूप से कम हुआ।"
  },
  backed: {
    word: "backed",
    ipa: "/bækt/",
    meaning: "समर्थित",
    alternatives: ["समर्थित", "सहारा मिला हुआ", "समर्थन प्राप्त"],
    sentence: "The project was backed by state guarantee. — इस परियोजना को सरकारी गारंटी का समर्थन प्राप्त था।"
  },
  continuing: {
    word: "continuing",
    ipa: "/kənˈtɪn.juː.ɪŋ/",
    meaning: "जारी",
    alternatives: ["जारी", "लगातार", "निरंतर"],
    sentence: "Continuing dialogue eases regional friction. — निरंतर संवाद क्षेत्रीय तनाव को कम करता है।"
  },
  constitution: {
    word: "constitution",
    ipa: "/ˌkɑːn.stəˈtuː.ʃən/",
    meaning: "संविधान",
    alternatives: ["संविधान", "विधान", "शासन-प्रणाली", "संरचना"],
    sentence: "The Constitution of India is the supreme law of the land. — भारत का संविधान देश का सर्वोच्च कानून है।"
  },
  democratic: {
    word: "democratic",
    ipa: "/ˌdem.əˈkræt̬.ɪk/",
    meaning: "लोकतांत्रिक",
    alternatives: ["लोकतांत्रिक", "प्रजातांत्रिक"],
    sentence: "Democratic institutions ensure public accountability. — लोकतांत्रिक संस्थाएं जन जवाबदेही सुनिश्चित करती हैं।"
  },
  democracy: {
    word: "democracy",
    ipa: "/dɪˈmɑː.krə.si/",
    meaning: "लोकतंत्र",
    alternatives: ["लोकतंत्र", "प्रजातंत्र", "जनतंत्र"],
    sentence: "A free press is the bedrock of democracy. — स्वतंत्र प्रेस लोकतंत्र की आधारशिला है।"
  },
  present: {
    word: "present",
    ipa: "/ˈprez.ənt/",
    meaning: "उपहार / वर्तमान / प्रस्तुत करना",
    alternatives: ["उपहार", "वर्तमान", "प्रस्तुत करना", "मौजूदा"],
    sentence: "The present economic situation requires bold reforms. — मौजूदा आर्थिक स्थिति में साहसिक सुधारों की आवश्यकता है।"
  },
  book: {
    word: "book",
    ipa: "/bʊk/",
    meaning: "किताब",
    alternatives: ["किताब", "पुस्तक", "ग्रंथ", "आरक्षित करना"],
    sentence: "He bought a new book on Indian history. — उसने भारतीय इतिहास पर एक नई किताब खरीदी।"
  },
  special: {
    word: "special",
    ipa: "/ˈspeʃ.əl/",
    meaning: "विशेष",
    alternatives: ["विशेष", "ख़ास", "विशिष्ट", "असाधारण"],
    sentence: "The committee submitted a special report on legal reforms. — समिति ने कानूनी सुधारों पर एक विशेष रिपोर्ट प्रस्तुत की।"
  },
  light: {
    word: "light",
    ipa: "/laɪt/",
    meaning: "प्रकाश / रोशनी / हल्का",
    alternatives: ["प्रकाश", "रोशनी", "हल्का", "प्रज्वलित करना"],
    sentence: "Sunlight is a natural source of light. — सूर्य का प्रकाश रोशनी का एक प्राकृतिक स्रोत है।"
  },
  run: {
    word: "run",
    ipa: "/rʌn/",
    meaning: "दौड़ना / चलाना / दौड़",
    alternatives: ["दौड़ना", "चलाना", "दौड़", "संचालित करना"],
    sentence: "Domestic industries run at high capacity. — घरेलू उद्योग उच्च क्षमता पर चलते हैं।"
  },
  fast: {
    word: "fast",
    ipa: "/fæst/",
    meaning: "तेज़ / तेज़ी से / उपवास",
    alternatives: ["तेज़", "तेज़ी से", "उपवास", "व्रत"],
    sentence: "India's digital economy is growing fast. — भारत की डिजिटल अर्थव्यवस्था तेज़ी से बढ़ रही है।"
  },
  record: {
    word: "record",
    ipa: "/ˈrek.ɚd/",
    meaning: "कीर्तिमान / रिकॉर्ड / दर्ज करना",
    alternatives: ["कीर्तिमान", "रिकॉर्ड", "अभिलेख", "दर्ज करना"],
    sentence: "Agricultural exports reached a record high. — कृषि निर्यात रिकॉर्ड ऊंचाई पर पहुंच गया।"
  },
  court: {
    word: "court",
    ipa: "/kɔːrt/",
    meaning: "अदालत / न्यायालय",
    alternatives: ["अदालत", "न्यायालय", "कोर्ट", "रिझाना"],
    sentence: "The Supreme Court delivered its verdict. — सर्वोच्च न्यायालय ने अपना फैसला सुनाया।"
  },
  state: {
    word: "state",
    ipa: "/steɪt/",
    meaning: "राज्य / स्थिति / बयान करना",
    alternatives: ["राज्य", "स्थिति", "दशा", "बयान करना"],
    sentence: "The state government approved the development plan. — राज्य सरकार ने विकास योजना को मंजूरी दी।"
  },
  patna: {
    word: "Patna",
    ipa: "/ˈpæt.nə/",
    pos: "Noun",
    meaning: "पटना",
    alternatives: ["पटना", "बिहार की राजधानी"],
    sentence: "Patna is a historic city on the banks of the Ganges. — पटना गंगा नदी के किनारे बसा एक ऐतिहासिक शहर है।"
  },
  reddy: {
    word: "Reddy",
    ipa: "/ˈred.i/",
    pos: "Noun",
    meaning: "रेड्डी",
    alternatives: ["रेड्डी"],
    sentence: "Mr. Reddy addressed the gathering yesterday. — श्री रेड्डी ने कल सभा को संबोधित किया।"
  },
  delhi: {
    word: "Delhi",
    ipa: "/ˈdel.i/",
    pos: "Noun",
    meaning: "दिल्ली",
    alternatives: ["दिल्ली", "राष्ट्रीय राजधानी"],
    sentence: "New Delhi is the national capital of India. — नई दिल्ली भारत की राष्ट्रीय राजधानी है।"
  },
  mumbai: {
    word: "Mumbai",
    ipa: "/mʊmˈbaɪ/",
    pos: "Noun",
    meaning: "मुंबई",
    alternatives: ["मुंबई", "महाराष्ट्र की राजधानी"],
    sentence: "Mumbai is the financial hub of the country. — मुंबई देश का वित्तीय केंद्र है।"
  },
  bihar: {
    word: "Bihar",
    ipa: "/bɪˈhɑːr/",
    pos: "Noun",
    meaning: "बिहार",
    alternatives: ["बिहार", "बिहार राज्य"],
    sentence: "Bihar has a rich cultural and historical heritage. — बिहार की सांस्कृतिक और ऐतिहासिक विरासत समृद्ध है।"
  },
  actor: {
    word: "actor",
    ipa: "/ˈæk.tɚ/",
    pos: "Noun",
    meaning: "अभिनेता",
    alternatives: ["अभिनेता", "नायक", "कलाकार", "पात्र"],
    sentence: "The popular actor announced a new movie project. — लोकप्रिय अभिनेता ने एक नई फिल्म परियोजना की घोषणा की।"
  },
  tiger: {
    word: "tiger",
    ipa: "/ˈtaɪ.ɡɚ/",
    pos: "Noun",
    meaning: "बाघ",
    alternatives: ["बाघ", "शेर", "चीता", "ताकतवर व्यक्ति"],
    sentence: "Project Tiger protects wildlife habitats across India. — प्रोजेक्ट टाइगर पूरे भारत में वन्यजीव आवासों की रक्षा करता है।"
  },
  shroff: {
    word: "Shroff",
    ipa: "/ʃrɒf/",
    pos: "Noun",
    meaning: "श्रॉफ",
    alternatives: ["श्रॉफ", "सर्राफ", "मुद्रा परिवर्तक"],
    sentence: "Tiger Shroff is a well-known Indian actor. — टाइगर श्रॉफ एक प्रसिद्ध भारतीय अभिनेता हैं।"
  },
  warnings: {
    word: "warnings",
    ipa: "/ˈwɔːr.nɪŋz/",
    pos: "Noun",
    meaning: "चेतावनियाँ",
    alternatives: ["चेतावनियाँ", "चेतावनी", "सावधानी के संकेत"],
    sentence: "Weather warnings were issued before the severe storm. — भीषण तूफान से पहले मौसम की चेतावनियाँ जारी की गई थीं।"
  },
  warning: {
    word: "warning",
    ipa: "/ˈwɔːr.nɪŋ/",
    pos: "Noun",
    meaning: "चेतावनी",
    alternatives: ["चेतावनी", "पूर्वसूचना", "सावधानी संकेत"],
    sentence: "The meteorological department issued a flood warning. — मौसम विभाग ने बाढ़ की चेतावनी जारी की।"
  }
};

// Memory and LocalStorage Cache
const memoryCache = new Map();

function getCached(key) {
  const clean = key.toLowerCase().trim();
  if (memoryCache.has(clean)) return memoryCache.get(clean);
  try {
    const stored = localStorage.getItem(`readhindi_entry_${clean}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      memoryCache.set(clean, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

function setCache(key, data) {
  const clean = key.toLowerCase().trim();
  memoryCache.set(clean, data);
  try {
    localStorage.setItem(`readhindi_entry_${clean}`, JSON.stringify(data));
  } catch {}
}

// Reliable fetch with timeout to prevent hung/stuck network calls
export async function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  const { signal, ...rest } = options;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  let combinedSignal = timeoutController.signal;
  if (signal && typeof signal.addEventListener === "function") {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      timeoutController.abort();
    });
  }

  try {
    const res = await fetch(url, { ...rest, signal: combinedSignal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function cleanLookupWord(rawWord) {
  if (!rawWord) return "";
  let w = rawWord.trim();
  // Strip quotes, brackets, punctuations
  w = w.replace(/^[“"‘'(\[{<\s]+|[”"’')\]}>\s,.:;!?]+$/g, "");
  // Keep only word characters, hyphens, and apostrophes
  w = w.replace(/[^A-Za-z'-]/g, "");
  return w;
}

export function normalizeLookupText(rawText) {
  if (!rawText) return "";
  let text = rawText.trim();
  // Heals hyphenated line breaks
  text = text.replace(/([A-Za-z]+)-\s*[\r\n]+\s*([A-Za-z]+)/g, "$1$2");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^[“"‘'(\[{<«»—–\s]+|[”"’')\]}>«»—–\s]+$/g, "");
  return text;
}

// Master lookup function: handles both individual words AND complete phrases/sentences
export async function lookupText(rawText, signalOrContext = null, maybeContext = "") {
  let signal = null;
  let contextSentence = "";

  if (typeof signalOrContext === "string") {
    contextSentence = signalOrContext;
    signal = null;
  } else {
    signal = signalOrContext;
    contextSentence = typeof maybeContext === "string" ? maybeContext : "";
  }

  const normalized = normalizeLookupText(rawText);
  if (!normalized) {
    return null;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  // Strict guard: Reject whole-document dumps or selections exceeding phrase/sentence bounds
  if (words.length === 0 || words.length > 35 || normalized.length > 300) {
    return null;
  }

  const isMultiWord = words.length > 1;

  // ---------------------------------------------------------
  // CASE 1: MULTI-WORD PHRASE OR SENTENCE TRANSLATION
  // ---------------------------------------------------------
  if (isMultiWord) {
    const isSentence = /[.?!]$/.test(normalized) || words.length >= 6;
    const type = isSentence ? "sentence" : "phrase";
    const cacheKey = `phrase_${normalized.toLowerCase()}`;

    // 1. Check Cache
    const cached = getCached(cacheKey);
    if (cached) {
      return {
        ...cached,
        text: normalized,
        sentence: cached.sentence || contextSentence,
        pos: isSentence ? "Sentence" : "Phrase",
        posHindi: isSentence ? "पूर्ण वाक्य (Sentence)" : "वाक्यांश (Phrase)",
        contextDistinction: cached.contextDistinction || (isSentence ? "पूर्ण वाक्य अनुवाद (Sentence Translation)" : "वाक्यांश अनुवाद (Phrase Translation)"),
        grammarExplanation: cached.grammarExplanation || (isSentence ? "यह एक पूर्ण वाक्य है जिसमें कर्ता और क्रिया शामिल हैं।" : "यह दो या अधिक शब्दों का एक संयुक्त वाक्यांश (Phrase) है।"),
        hinglishExplanation: cached.hinglishExplanation || (isSentence ? "Yeh ek complete sentence translation hai." : "Yeh ek multi-word phrase hai."),
        exampleSentence: cached.exampleSentence || normalized,
        exampleHindi: cached.exampleHindi || cached.meaning
      };
    }

    // 2. Online Translation Tier 1: Google Translate public API (handles long phrases & sentences)
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(normalized)}`;
      const res = await fetchWithTimeout(url, { signal }, 3500);
      if (res.ok) {
        const data = await res.json();
        // Google translate splits sentences into chunks: data[0] = [ [translatedChunk, originalChunk], ... ]
        if (Array.isArray(data?.[0])) {
          const translation = data[0]
            .map(chunk => chunk?.[0] || "")
            .filter(Boolean)
            .join(" ")
            .trim();

          if (translation && translation.toLowerCase() !== normalized.toLowerCase()) {
            const result = {
              type,
              text: normalized,
              word: normalized,
              ipa: "", // Phrases do not need single-word IPA
              meaning: translation,
              alternatives: [translation],
              sentence: contextSentence || normalized,
              pos: isSentence ? "Sentence" : "Phrase",
              posHindi: isSentence ? "पूर्ण वाक्य (Sentence)" : "वाक्यांश (Phrase)",
              posConfidence: 1.0,
              contextMeaning: translation,
              contextDistinction: isSentence ? "पूर्ण वाक्य अनुवाद (Sentence Translation)" : "वाक्यांश अनुवाद (Phrase Translation)",
              grammarExplanation: isSentence ? "यह एक पूर्ण वाक्य है जिसमें कर्ता (subject) और क्रिया (predicate) शामिल हैं।" : "यह दो या अधिक शब्दों का एक संयुक्त वाक्यांश (Phrase) है।",
              hinglishExplanation: isSentence ? "Yeh ek complete sentence translation hai." : "Yeh ek multi-word phrase hai.",
              exampleSentence: normalized,
              exampleHindi: translation,
              phonetic: "",
              isContextCertain: true,
              source: "Google Translate"
            };
            setCache(cacheKey, result);
            return result;
          }
        }
      }
    } catch (e) {
      if (e.name === "AbortError") throw e;
      console.warn("Phrase Tier 1 failed:", e);
    }

    // 3. Online Translation Tier 2: MyMemory API
    try {
      const r = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=en|hi`, { signal }, 3500);
      if (r.ok) {
        const data = await r.json();
        const translated = data?.responseData?.translatedText?.trim();
        if (translated && translated.toLowerCase() !== normalized.toLowerCase() && !translated.includes("MYMEMORY WARNING")) {
          const result = {
            type,
            text: normalized,
            word: normalized,
            ipa: "",
            meaning: translated,
            alternatives: [translated],
            sentence: contextSentence || normalized,
            pos: isSentence ? "Sentence" : "Phrase",
            posHindi: isSentence ? "पूर्ण वाक्य (Sentence)" : "वाक्यांश (Phrase)",
            posConfidence: 0.9,
            contextMeaning: translated,
            contextDistinction: isSentence ? "पूर्ण वाक्य अनुवाद (Sentence Translation)" : "वाक्यांश अनुवाद (Phrase Translation)",
            grammarExplanation: isSentence ? "यह एक पूर्ण वाक्य है जिसमें कर्ता और क्रिया शामिल हैं।" : "यह दो या अधिक शब्दों का एक संयुक्त वाक्यांश (Phrase) है।",
            hinglishExplanation: isSentence ? "Yeh ek complete sentence translation hai." : "Yeh ek multi-word phrase hai.",
            exampleSentence: normalized,
            exampleHindi: translated,
            phonetic: "",
            isContextCertain: true,
            source: "MyMemory Translation"
          };
          setCache(cacheKey, result);
          return result;
        }
      }
    } catch (e) {
      if (e.name === "AbortError") throw e;
      console.warn("Phrase Tier 2 failed:", e);
    }

    return {
      type,
      text: normalized,
      word: normalized,
      ipa: "",
      meaning: "अनुवाद उपलब्ध नहीं है (कृपया इंटरनेट कनेक्शन जाँचें)",
      alternatives: ["अनुवाद उपलब्ध नहीं है (कृपया इंटरनेट कनेक्शन जाँचें)"],
      sentence: contextSentence || normalized,
      pos: isSentence ? "Sentence" : "Phrase",
      posHindi: isSentence ? "पूर्ण वाक्य (Sentence)" : "वाक्यांश (Phrase)",
      posConfidence: 0.5,
      contextMeaning: "अनुवाद सेवा अनुपलब्ध",
      contextDistinction: "अनुवाद सेवा अनुपलब्ध",
      grammarExplanation: "",
      hinglishExplanation: "",
      exampleSentence: normalized,
      exampleHindi: "",
      phonetic: "",
      isContextCertain: false,
      source: "Offline Fallback"
    };
  }

  // ---------------------------------------------------------
  // CASE 2: SINGLE WORD LOOKUP WITH CONTEXT-AWARE GRAMMAR
  // ---------------------------------------------------------
  const word = cleanLookupWord(normalized);
  if (!word) {
    return {
      type: "word",
      text: normalized,
      word: normalized,
      meaning: "मान्य शब्द चुनें",
      alternatives: ["मान्य शब्द चुनें"],
      ipa: "",
      pos: "Uncertain",
      posHindi: "अस्पष्ट (Context Needed)",
      posConfidence: 0,
      contextMeaning: "",
      contextDistinction: "",
      sentence: contextSentence,
      grammarExplanation: "",
      hinglishExplanation: "",
      exampleSentence: "",
      exampleHindi: "",
      phonetic: "",
      isContextCertain: false,
      source: "Validation"
    };
  }

  const lower = word.toLowerCase();

  // Run Context-Aware Grammar & Teacher Analysis
  const teacherAnalysis = analyzeWordInContext(word, contextSentence);

  // If word is known polysemous word and we have confident context-specific analysis
  if (POLYSEMOUS_WORDS[lower] && teacherAnalysis.isContextCertain) {
    return {
      type: "word",
      text: word,
      word,
      ipa: teacherAnalysis.ipa || `/${word}/`,
      meaning: teacherAnalysis.meaning,
      alternatives: teacherAnalysis.alternatives,
      pos: teacherAnalysis.pos,
      posHindi: teacherAnalysis.posHindi,
      posConfidence: teacherAnalysis.posConfidence,
      contextMeaning: teacherAnalysis.contextMeaning,
      contextDistinction: teacherAnalysis.contextDistinction,
      sentence: contextSentence || teacherAnalysis.sentence,
      grammarExplanation: teacherAnalysis.grammarExplanation,
      hinglishExplanation: teacherAnalysis.hinglishExplanation,
      exampleSentence: teacherAnalysis.exampleSentence,
      exampleHindi: teacherAnalysis.exampleHindi,
      phonetic: teacherAnalysis.phonetic || word,
      isContextCertain: true,
      source: "Context Grammar Engine"
    };
  }

  // 1. Built-in editorial dictionary lookup
  let builtinEntry = BUILTIN_DICTIONARY[lower];
  if (!builtinEntry) {
    if (lower.endsWith("s") && BUILTIN_DICTIONARY[lower.slice(0, -1)]) {
      builtinEntry = BUILTIN_DICTIONARY[lower.slice(0, -1)];
    } else if (lower.endsWith("ed") && BUILTIN_DICTIONARY[lower.slice(0, -2)]) {
      builtinEntry = BUILTIN_DICTIONARY[lower.slice(0, -2)];
    } else if (lower.endsWith("ing") && BUILTIN_DICTIONARY[lower.slice(0, -3)]) {
      builtinEntry = BUILTIN_DICTIONARY[lower.slice(0, -3)];
    }
  }

  if (builtinEntry) {
    const exParts = (builtinEntry.sentence || "").split("—");
    return {
      type: "word",
      text: word,
      word,
      ipa: builtinEntry.ipa || teacherAnalysis.ipa || `/${word}/`,
      meaning: builtinEntry.meaning,
      alternatives: builtinEntry.alternatives || [builtinEntry.meaning],
      pos: teacherAnalysis.pos,
      posHindi: teacherAnalysis.posHindi,
      posConfidence: teacherAnalysis.posConfidence,
      contextMeaning: teacherAnalysis.contextMeaning || builtinEntry.meaning,
      contextDistinction: teacherAnalysis.contextDistinction,
      sentence: contextSentence || builtinEntry.sentence,
      grammarExplanation: teacherAnalysis.grammarExplanation,
      hinglishExplanation: teacherAnalysis.hinglishExplanation,
      exampleSentence: teacherAnalysis.exampleSentence || exParts[0]?.trim() || "",
      exampleHindi: teacherAnalysis.exampleHindi || exParts[1]?.trim() || "",
      phonetic: teacherAnalysis.phonetic || word,
      isContextCertain: teacherAnalysis.isContextCertain,
      source: "Built-in dictionary"
    };
  }

  // 2. Local cache lookup
  const sentenceSig = contextSentence ? contextSentence.slice(0, 35).replace(/[^a-zA-Z]/g, "") : "none";
  const cacheKey = `word_${lower}_${sentenceSig}`;
  const cached = getCached(cacheKey) || getCached(`word_${lower}`);
  if (cached) {
    return {
      ...cached,
      type: "word",
      text: word,
      word,
      pos: teacherAnalysis.pos || cached.pos,
      posHindi: teacherAnalysis.posHindi || cached.posHindi,
      posConfidence: teacherAnalysis.posConfidence || cached.posConfidence || 0.7,
      sentence: contextSentence || cached.sentence,
      grammarExplanation: teacherAnalysis.grammarExplanation || cached.grammarExplanation,
      hinglishExplanation: teacherAnalysis.hinglishExplanation || cached.hinglishExplanation,
      contextDistinction: teacherAnalysis.contextDistinction || cached.contextDistinction,
      exampleSentence: teacherAnalysis.exampleSentence || cached.exampleSentence,
      exampleHindi: teacherAnalysis.exampleHindi || cached.exampleHindi,
      phonetic: teacherAnalysis.phonetic || cached.phonetic || word,
      isContextCertain: teacherAnalysis.isContextCertain
    };
  }

  // 3. Online Fallback Tier 1: Google Translate public single client
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(word)}`;
    const res = await fetchWithTimeout(url, { signal }, 3500);
    if (res.ok) {
      const data = await res.json();
      const primary = data?.[0]?.[0]?.[0]?.trim();
      const alternatives = [];
      if (primary) alternatives.push(primary);

      // Extract dictionary table synonyms if present
      if (Array.isArray(data?.[1])) {
        for (const item of data[1]) {
          const terms = item?.[1];
          if (Array.isArray(terms)) {
            for (const t of terms) {
              if (t && !alternatives.includes(t)) alternatives.push(t);
            }
          }
        }
      }

      if (primary && (primary.toLowerCase() !== lower || /[\u0900-\u097F]/.test(primary))) {
        const result = {
          type: "word",
          text: word,
          word,
          ipa: teacherAnalysis.ipa || `/${word}/`,
          meaning: primary,
          alternatives: alternatives.slice(0, 6),
          pos: teacherAnalysis.pos,
          posHindi: teacherAnalysis.posHindi,
          posConfidence: teacherAnalysis.posConfidence,
          contextMeaning: primary,
          contextDistinction: teacherAnalysis.contextDistinction,
          sentence: contextSentence,
          grammarExplanation: teacherAnalysis.grammarExplanation,
          hinglishExplanation: teacherAnalysis.hinglishExplanation,
          exampleSentence: teacherAnalysis.exampleSentence,
          exampleHindi: teacherAnalysis.exampleHindi,
          phonetic: teacherAnalysis.phonetic || word,
          isContextCertain: teacherAnalysis.isContextCertain,
          source: "Online translation"
        };
        setCache(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    if (e.name === "AbortError") throw e;
    console.warn("Word Tier 1 failed:", e);
  }

  // 4. Online Fallback Tier 2: MyMemory API
  try {
    const r = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|hi`, { signal }, 3500);
    if (r.ok) {
      const data = await r.json();
      const translated = data?.responseData?.translatedText?.trim();
      if (translated && (translated.toLowerCase() !== lower || /[\u0900-\u097F]/.test(translated)) && !translated.includes("MYMEMORY WARNING")) {
        const result = {
          type: "word",
          text: word,
          word,
          ipa: teacherAnalysis.ipa || `/${word}/`,
          meaning: translated,
          alternatives: [translated],
          pos: teacherAnalysis.pos,
          posHindi: teacherAnalysis.posHindi,
          posConfidence: teacherAnalysis.posConfidence,
          contextMeaning: translated,
          contextDistinction: teacherAnalysis.contextDistinction,
          sentence: contextSentence,
          grammarExplanation: teacherAnalysis.grammarExplanation,
          hinglishExplanation: teacherAnalysis.hinglishExplanation,
          exampleSentence: teacherAnalysis.exampleSentence,
          exampleHindi: teacherAnalysis.exampleHindi,
          phonetic: teacherAnalysis.phonetic || word,
          isContextCertain: teacherAnalysis.isContextCertain,
          source: "Online translation"
        };
        setCache(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    if (e.name === "AbortError") throw e;
    console.warn("Word Tier 2 failed:", e);
  }

  // 5. English Dictionary API (gives IPA & definition if Hindi API fails)
  try {
    const r = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal }, 3000);
    if (r.ok) {
      const data = await r.json();
      const phonetic = data?.[0]?.phonetic || data?.[0]?.phonetics?.find(p => p.text)?.text || `/${word}/`;
      const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition || "";
      return {
        type: "word",
        text: word,
        word,
        ipa: phonetic,
        meaning: "हिन्दी अर्थ खोजने के लिए पुनः प्रयास करें",
        alternatives: ["हिन्दी अर्थ खोजने के लिए पुनः प्रयास करें"],
        pos: teacherAnalysis.pos,
        posHindi: teacherAnalysis.posHindi,
        posConfidence: teacherAnalysis.posConfidence,
        contextMeaning: "हिन्दी अर्थ खोजने के लिए पुनः प्रयास करें",
        contextDistinction: teacherAnalysis.contextDistinction,
        definition: def ? `English definition: ${def}` : "",
        sentence: contextSentence,
        grammarExplanation: teacherAnalysis.grammarExplanation,
        hinglishExplanation: teacherAnalysis.hinglishExplanation,
        exampleSentence: teacherAnalysis.exampleSentence,
        exampleHindi: teacherAnalysis.exampleHindi,
        phonetic: teacherAnalysis.phonetic || word,
        isContextCertain: teacherAnalysis.isContextCertain,
        source: "English dictionary (offline fallback)"
      };
    }
  } catch (e) {
    if (e.name === "AbortError") throw e;
  }

  // 6. Intelligent Fallback for Proper Nouns / Untranslated Words
  const lowerWord = word.toLowerCase();
  const isKnownCommon = !!BUILTIN_DICTIONARY[lowerWord] || !!POLYSEMOUS_WORDS[lowerWord] || ["the", "a", "an", "following", "in", "after", "before", "during", "constitution", "special"].includes(lowerWord);
  const isSentenceStart = contextSentence && contextSentence.trim().toLowerCase().startsWith(word.toLowerCase());
  const isProperNoun = /^[A-Z][a-z]+/.test(word) && !isKnownCommon && !isSentenceStart;
  return {
    type: "word",
    text: word,
    word,
    ipa: teacherAnalysis.ipa || `/${word}/`,
    meaning: isProperNoun ? word : (teacherAnalysis.meaning || "इस शब्द का हिन्दी अर्थ अभी उपलब्ध नहीं है।"),
    alternatives: isProperNoun ? [word] : (teacherAnalysis.alternatives?.length > 0 ? teacherAnalysis.alternatives : ["इस शब्द का हिन्दी अर्थ अभी उपलब्ध नहीं है।"]),
    pos: isProperNoun ? "Noun" : teacherAnalysis.pos,
    posHindi: isProperNoun ? "संज्ञा (Proper Noun)" : teacherAnalysis.posHindi,
    posConfidence: isProperNoun ? 0.9 : teacherAnalysis.posConfidence,
    contextMeaning: isProperNoun ? word : (teacherAnalysis.contextMeaning || "इस शब्द का हिन्दी अर्थ अभी उपलब्ध नहीं है।"),
    contextDistinction: teacherAnalysis.contextDistinction,
    sentence: contextSentence,
    grammarExplanation: teacherAnalysis.grammarExplanation,
    hinglishExplanation: teacherAnalysis.hinglishExplanation,
    exampleSentence: teacherAnalysis.exampleSentence,
    exampleHindi: teacherAnalysis.exampleHindi,
    phonetic: teacherAnalysis.phonetic || word,
    isContextCertain: isProperNoun ? true : false,
    source: isProperNoun ? "Proper Noun" : "Offline"
  };
}

// Backward compatibility alias
export async function lookupWord(rawWord, contextSentence = "") {
  return lookupText(rawWord, null, contextSentence);
}
