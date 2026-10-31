import express from "express";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
const socketRoles = {};
let lastReachableAddress = null;

const PORT = process.env.PORT || 3001;
const JOIN_CODE = "QUIZ";
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", ".data");
const STATE_FILE = path.join(DATA_DIR, "quiz-state.json");
const STATE_TMP_FILE = path.join(DATA_DIR, "quiz-state.tmp.json");
const QUIZ_FILE = path.join(DATA_DIR, "quiz.json");
const QUIZ_TMP_FILE = path.join(DATA_DIR, "quiz.tmp.json");
const WIFI_FILE = path.join(DATA_DIR, "wifi.json");
const USER_ASSET_DIR = path.join(DATA_DIR, "assets");
const userAssetUrlPrefix = "/user-assets";
const allowedQuestionTypes = new Set(["open", "multiple-choice", "estimate", "month", "location"]);
const allowedAvatarFaces = new Set(["smile", "grin", "laugh", "cool", "wink"]);
const allowedAvatarAccessories = new Set(["none", "cap", "crown", "partyhat", "headphones", "beanie", "flower"]);
const allowedAvatarSkinTones = new Set(["#fbdfc4", "#f2c7a1", "#d9a06f", "#b8744f", "#8d5524", "#5c3422"]);
const allowedAvatarEyes = new Set(["normal", "happy", "sleepy", "hearts"]);
const allowedAvatarGlasses = new Set(["none", "round", "square", "sunglasses"]);
const allowedAvatarFacialHair = new Set(["none", "mustache", "goatee", "beard", "combo"]);
const allowedAvatarHairStyles = new Set(["short", "curly", "afro", "long", "ponytail", "bun", "mohawk", "bald"]);
const allowedAvatarHairColors = new Set(["#2f1b12", "#6b3f22", "#c65f1a", "#d9a441", "#111827", "#9ca3af", "#f8fafc"]);
const allowedAvatarBodyTypes = new Set(["slim", "normal", "muscular"]);
const allowedAvatarGenderStyles = new Set(["neutral", "man", "woman"]);
const allowedAvatarShirtColors = new Set(["#14b8a6", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#22c55e", "#f97316", "#f8fafc", "#111827"]);
const allowedAvatarShirtStyles = new Set(["tshirt", "hoodie", "suit", "stripes"]);
const shirtColorPalette = [...allowedAvatarShirtColors];

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "90mb" }));

const seenRemoteAddresses = new Set();
app.use((req, _res, next) => {
  const localAddress = req.socket?.localAddress?.replace(/^::ffff:/, "");
  if (localAddress && localAddress !== "127.0.0.1" && localAddress !== "::1") {
    lastReachableAddress = localAddress;
  }
  const remoteAddress = req.socket?.remoteAddress?.replace(/^::ffff:/, "");
  if (
    remoteAddress &&
    remoteAddress !== "127.0.0.1" &&
    remoteAddress !== "::1" &&
    !seenRemoteAddresses.has(remoteAddress)
  ) {
    seenRemoteAddresses.add(remoteAddress);
    if (remoteAddress === localAddress) {
      // De laptop bezocht zijn eigen netwerkadres; dat gaat buiten de
      // firewall om en bewijst dus niets over telefoons.
      console.log(`[INFO] Deze laptop opende zelf http://${remoteAddress}:${PORT} - dat zegt nog niets over telefoons.`);
    } else {
      console.log(`[OK] Apparaat verbonden vanaf ${remoteAddress} - de verbinding telefoon->laptop werkt!`);
    }
  }
  next();
});

const defaultQuiz = [
  {
    id: "geo_01",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-colosseum.jpg",
    correctLocation: { lat: 41.8902, lng: 12.4922, label: "Colosseum, Rome" },
    scoringRadiusKm: 3000,
    perfectRadiusMeters: 20000,
    points: 15,
  },
  {
    id: "hit_01",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/gangnam-style.mp3",
    audioStartSeconds: 71,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2012,
    answerImageUrl: "/quiz-assets/q2-hit-psy.jpg",
    points: 10,
  },
  {
    id: "ken_01",
    round: "Algemene kennis",
    type: "multiple-choice",
    title: "Welke kleur heeft de 'zwarte doos' in een vliegtuig?",
    options: ["Zwart", "Feloranje", "Geel", "Donkerblauw"],
    correctAnswer: "Feloranje",
    answerImageUrl: "/quiz-assets/q2-ken-blackbox.jpg",
    points: 10,
  },
  {
    id: "sch_01",
    round: "Schatten maar",
    type: "estimate",
    title: "Hoe hoog is de Eiffeltoren (met antenne)?",
    imageUrl: "/quiz-assets/q2-sch-eiffel.jpg",
    min: 100,
    max: 500,
    step: 5,
    unit: "meter",
    correctValue: 330,
    points: 10,
  },
  {
    id: "hit_02",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/axel-f.mp3",
    audioStartSeconds: 14,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2005,
    answerImageUrl: "/quiz-assets/q2-hit-crazy-frog.jpg",
    points: 10,
  },
  {
    id: "geo_02",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-sydney.jpg",
    correctLocation: { lat: -33.8568, lng: 151.2153, label: "Sydney Opera House, Australië" },
    scoringRadiusKm: 3000,
    perfectRadiusMeters: 20000,
    points: 15,
  },
  {
    id: "ken_02",
    round: "Algemene kennis",
    type: "multiple-choice",
    title: "Hoeveel harten heeft een octopus?",
    imageUrl: "/quiz-assets/q2-ken-octopus.jpg",
    options: ["1", "2", "3", "8"],
    correctAnswer: "3",
    points: 10,
  },
  {
    id: "hit_03",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/uptown-funk.mp3",
    audioStartSeconds: 56,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2014,
    answerImageUrl: "/quiz-assets/q2-hit-bruno-mars.jpg",
    points: 10,
  },
  {
    id: "sch_02",
    round: "Schatten maar",
    type: "estimate",
    title: "In welk jaar werd YouTube opgericht?",
    imageUrl: "/quiz-assets/q2-sch-youtube.png",
    min: 1994,
    max: 2021,
    step: 1,
    correctValue: 2005,
    yearScoring: true,
    points: 10,
  },
  {
    id: "geo_03",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-machu-picchu.jpg",
    correctLocation: { lat: -13.1631, lng: -72.545, label: "Machu Picchu, Peru" },
    scoringRadiusKm: 3000,
    perfectRadiusMeters: 20000,
    points: 15,
  },
  {
    id: "hit_04",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/waka-waka.mp3",
    audioStartSeconds: 47,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2010,
    answerImageUrl: "/quiz-assets/q2-hit-shakira.jpg",
    points: 10,
  },
  {
    id: "ken_03",
    round: "Algemene kennis",
    type: "multiple-choice",
    title: "Welke planeet is het heetst?",
    options: ["Mercurius", "Venus", "Mars", "Jupiter"],
    correctAnswer: "Venus",
    answerImageUrl: "/quiz-assets/q2-ken-venus.jpg",
    points: 10,
  },
  {
    id: "geo_04",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-kinderdijk.jpg",
    correctLocation: { lat: 51.8838, lng: 4.6389, label: "Kinderdijk, Zuid-Holland" },
    scoringRadiusKm: 150,
    perfectRadiusMeters: 5000,
    points: 15,
  },
  {
    id: "hit_05",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/despacito.mp3",
    audioStartSeconds: 82,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2017,
    answerImageUrl: "/quiz-assets/q2-hit-luis-fonsi.jpg",
    points: 10,
  },
  {
    id: "sch_03",
    round: "Schatten maar",
    type: "estimate",
    title: "Hoeveel mensen wonen er in Nederland?",
    min: 8,
    max: 35,
    step: 0.5,
    unit: "miljoen",
    correctValue: 18,
    points: 10,
  },
  {
    id: "geo_05",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-gizeh.jpg",
    correctLocation: { lat: 29.9792, lng: 31.1342, label: "Piramides van Gizeh, Egypte" },
    scoringRadiusKm: 3000,
    perfectRadiusMeters: 20000,
    points: 15,
  },
  {
    id: "hit_06",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/low.mp3",
    audioStartSeconds: 14,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2007,
    answerImageUrl: "/quiz-assets/q2-hit-flo-rida.jpg",
    points: 10,
  },
  {
    id: "ken_04",
    round: "Algemene kennis",
    type: "multiple-choice",
    title: "Welk land heeft de meeste tijdzones?",
    imageUrl: "/quiz-assets/q2-ken-tijdzones.png",
    options: ["Rusland", "Verenigde Staten", "Frankrijk", "China"],
    correctAnswer: "Frankrijk",
    points: 10,
  },
  {
    id: "sch_04",
    round: "Schatten maar",
    type: "estimate",
    title: "Hoe lang is de Chinese Muur (alle delen samen)?",
    imageUrl: "/quiz-assets/q2-sch-muur.jpg",
    min: 2000,
    max: 45000,
    step: 500,
    unit: "km",
    correctValue: 21196,
    points: 10,
  },
  {
    id: "hit_07",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/party-rock-anthem.mp3",
    audioStartSeconds: 60,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2011,
    answerImageUrl: "/quiz-assets/q2-hit-lmfao.jpg",
    points: 10,
  },
  {
    id: "geo_06",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-golden-gate.jpg",
    correctLocation: { lat: 37.8199, lng: -122.4783, label: "Golden Gate Bridge, San Francisco" },
    scoringRadiusKm: 3000,
    perfectRadiusMeters: 20000,
    points: 15,
  },
  {
    id: "ken_05",
    round: "Algemene kennis",
    type: "multiple-choice",
    title: "Welke app bestond het eerst?",
    options: ["Instagram", "Snapchat", "TikTok", "Tinder"],
    correctAnswer: "Instagram",
    points: 10,
  },
  {
    id: "hit_08",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/old-town-road.mp3",
    audioStartSeconds: 25,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2018,
    answerImageUrl: "/quiz-assets/q2-hit-lil-nas-x.jpg",
    points: 10,
  },
  {
    id: "sch_05",
    round: "Schatten maar",
    type: "estimate",
    title: "Hoeveel botten heeft een volwassen mens?",
    imageUrl: "/quiz-assets/q2-sch-skelet.jpg",
    min: 90,
    max: 420,
    step: 1,
    correctValue: 206,
    points: 10,
  },
  {
    id: "geo_07",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-giethoorn.jpg",
    correctLocation: { lat: 52.7286, lng: 6.0777, label: "Giethoorn, Overijssel" },
    scoringRadiusKm: 150,
    perfectRadiusMeters: 5000,
    points: 15,
  },
  {
    id: "hit_09",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/wake-me-up.mp3",
    audioStartSeconds: 90,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2013,
    answerImageUrl: "/quiz-assets/q2-hit-avicii.jpg",
    points: 10,
  },
  {
    id: "ken_06",
    round: "Algemene kennis",
    type: "multiple-choice",
    title: "Wat is het kleinste land ter wereld?",
    options: ["Monaco", "Vaticaanstad", "Malta", "San Marino"],
    correctAnswer: "Vaticaanstad",
    answerImageUrl: "/quiz-assets/q2-ken-vaticaan.jpg",
    points: 10,
  },
  {
    id: "geo_08",
    round: "Wereld Geo",
    type: "location",
    title: "Waar is deze foto gemaakt?",
    imageUrl: "/quiz-assets/q2-geo-taj-mahal.jpeg",
    correctLocation: { lat: 27.1751, lng: 78.0421, label: "Taj Mahal, India" },
    scoringRadiusKm: 3000,
    perfectRadiusMeters: 20000,
    points: 15,
  },
  {
    id: "hit_10",
    round: "Hitster",
    type: "estimate",
    title: "Uit welk jaar komt dit nummer?",
    audioUrl: "/audio/i-gotta-feeling.mp3",
    audioStartSeconds: 87,
    min: 1960,
    max: 2026,
    step: 1,
    correctValue: 2009,
    answerImageUrl: "/quiz-assets/q2-hit-black-eyed-peas.jpg",
    points: 10,
  },
  {
    id: "sch_06",
    round: "Schatten maar",
    type: "estimate",
    title: "Hoeveel liter water gaat er in een olympisch zwembad?",
    imageUrl: "/quiz-assets/q2-sch-zwembad.jpg",
    min: 200000,
    max: 6000000,
    step: 50000,
    unit: "liter",
    correctValue: 2500000,
    points: 10,
  },
];

function safeText(value, fallback = "", maxLength = 500) {
  const text = String(value ?? "").trim();
  // Ook een lege of spaties-only waarde valt terug op de fallback, anders kan
  // een handbewerkt vragenbestand met een lege titel de validatie laten klappen.
  return (text || String(fallback).trim()).slice(0, maxLength);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeAssetUrl(value) {
  const text = safeText(value, "", 500);
  if (!text) return undefined;
  if (
    text.startsWith("/quiz-assets/") ||
    text.startsWith("/audio/") ||
    text.startsWith(`${userAssetUrlPrefix}/`)
  ) {
    return text;
  }
  return undefined;
}

function normalizeQuestion(rawQuestion, index) {
  const type = allowedQuestionTypes.has(rawQuestion?.type) ? rawQuestion.type : "open";
  const id = safeText(rawQuestion?.id, `q_${Date.now()}_${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, "_");
  const question = {
    id: id || `q_${Date.now()}_${index + 1}`,
    round: safeText(rawQuestion?.round, "Eigen ronde", 80),
    type,
    title: safeText(rawQuestion?.title, "Nieuwe vraag", 240),
    points: Math.max(0, Math.round(safeNumber(rawQuestion?.points, type === "location" ? 15 : 10))),
  };

  const imageUrl = normalizeAssetUrl(rawQuestion?.imageUrl);
  const answerImageUrl = normalizeAssetUrl(rawQuestion?.answerImageUrl);
  const answerVideoUrl = normalizeAssetUrl(rawQuestion?.answerVideoUrl);
  const audioUrl = normalizeAssetUrl(rawQuestion?.audioUrl);
  if (imageUrl) question.imageUrl = imageUrl;
  if (answerImageUrl) question.answerImageUrl = answerImageUrl;
  if (answerVideoUrl) question.answerVideoUrl = answerVideoUrl;
  if (audioUrl) question.audioUrl = audioUrl;

  // Fotogrootte op de beamer: 0.6 = klein, 1 = normaal (weggelaten), 1.25 = groot.
  const imageScale = safeNumber(rawQuestion?.imageScale, 0);
  if (imageScale >= 0.4 && imageScale <= 1.4 && imageScale !== 1) {
    question.imageScale = Math.round(imageScale * 100) / 100;
  }

  if (type === "multiple-choice") {
    const options = Array.isArray(rawQuestion?.options)
      ? rawQuestion.options.map((option) => safeText(option, "", 120)).filter(Boolean)
      : [];
    question.options = [...new Set(options)].slice(0, 8);
    while (question.options.length < 2) {
      question.options.push(`Optie ${question.options.length + 1}`);
    }
    question.correctAnswer = question.options.includes(rawQuestion?.correctAnswer)
      ? rawQuestion.correctAnswer
      : question.options[0];
  }

  if (type === "open") {
    question.correctAnswer = safeText(rawQuestion?.correctAnswer, "", 240);
  }

  if (type === "estimate") {
    question.min = safeNumber(rawQuestion?.min, 0);
    question.max = safeNumber(rawQuestion?.max, 100);
    if (question.min >= question.max) {
      question.max = question.min + 100;
    }
    question.step = Math.max(0.01, safeNumber(rawQuestion?.step, 1));
    question.correctValue = Math.max(question.min, Math.min(question.max, safeNumber(rawQuestion?.correctValue, question.min)));
    const unit = safeText(rawQuestion?.unit, "", 24);
    if (unit) question.unit = unit;
    const audioStartSeconds = Math.max(0, safeNumber(rawQuestion?.audioStartSeconds, 0));
    if (audioStartSeconds) question.audioStartSeconds = audioStartSeconds;
    // Jaartal-telling (zoals Hitster): exact=100%, 1 jaar ernaast=70%, 2=50%, 3=30%, 4=10%.
    if (rawQuestion?.yearScoring === true) question.yearScoring = true;
  }

  if (type === "month") {
    question.min = /^\d{4}-\d{2}$/.test(String(rawQuestion?.min ?? "")) ? rawQuestion.min : "2018-01";
    question.max = /^\d{4}-\d{2}$/.test(String(rawQuestion?.max ?? "")) ? rawQuestion.max : "2030-12";
    question.correctValue = /^\d{4}-\d{2}$/.test(String(rawQuestion?.correctValue ?? ""))
      ? rawQuestion.correctValue
      : question.min;
  }

  if (type === "location") {
    const lat = safeNumber(rawQuestion?.correctLocation?.lat, 52.0907);
    const lng = safeNumber(rawQuestion?.correctLocation?.lng, 5.1214);
    question.correctLocation = {
      lat: Math.max(-90, Math.min(90, lat)),
      lng: Math.max(-180, Math.min(180, lng)),
      label: safeText(rawQuestion?.correctLocation?.label, "Juiste plek", 120),
    };
    question.scoringRadiusKm = Math.max(0.001, safeNumber(rawQuestion?.scoringRadiusKm, 0.15));
    question.perfectRadiusMeters = Math.max(1, Math.round(safeNumber(rawQuestion?.perfectRadiusMeters, 20)));
  }

  return question;
}

function normalizeQuiz(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Quiz moet minimaal 1 vraag hebben.");
  }

  const usedIds = new Map();
  return questions.map((rawQuestion, index) => {
    const question = normalizeQuestion(rawQuestion, index);
    const count = usedIds.get(question.id) ?? 0;
    usedIds.set(question.id, count + 1);
    if (count > 0) {
      question.id = `${question.id}_${count + 1}`;
    }
    return question;
  });
}

// In een gedeeld pakket (STARTER_QUIZ env) is de "default" een meegeleverde
// voorbeeldquiz in plaats van de ingebouwde quiz van de maker.
const STARTER_QUIZ_FILE = process.env.STARTER_QUIZ ? path.resolve(process.env.STARTER_QUIZ) : null;

function starterQuiz() {
  if (STARTER_QUIZ_FILE && fs.existsSync(STARTER_QUIZ_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(STARTER_QUIZ_FILE, "utf8"));
      return saved.questions ?? saved.quiz ?? saved;
    } catch (error) {
      console.warn("Kon starterquiz niet laden, ingebouwde quiz wordt gebruikt:", error.message);
    }
  }
  return defaultQuiz;
}

function loadQuiz() {
  try {
    if (!fs.existsSync(QUIZ_FILE)) return normalizeQuiz(starterQuiz());
    const saved = JSON.parse(fs.readFileSync(QUIZ_FILE, "utf8"));
    return normalizeQuiz(saved.questions ?? saved.quiz ?? saved);
  } catch (error) {
    console.warn("Kon opgeslagen quiz niet laden, default quiz wordt gebruikt:", error.message);
    try {
      return normalizeQuiz(starterQuiz());
    } catch (starterError) {
      // Starterquiz zelf kapot (bijv. verkeerd bewerkte voorbeeld-quiz.json):
      // val terug op de ingebouwde quiz zodat de app altijd opstart.
      console.warn("Starterquiz ook ongeldig, ingebouwde quiz wordt gebruikt:", starterError.message);
      return normalizeQuiz(defaultQuiz);
    }
  }
}

function saveQuiz(questions) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = JSON.stringify({ questions, savedAt: new Date().toISOString() }, null, 2);
  fs.writeFileSync(QUIZ_TMP_FILE, payload);
  fs.renameSync(QUIZ_TMP_FILE, QUIZ_FILE);
}

function validateQuiz(questions) {
  const ids = new Set();
  const issues = [];

  questions.forEach((question, index) => {
    const label = question?.id || `vraag op positie ${index + 1}`;
    if (!question?.id) issues.push(`${label}: mist id`);
    if (ids.has(question.id)) issues.push(`${label}: dubbele id`);
    ids.add(question.id);
    if (!question?.type) issues.push(`${label}: mist type`);
    if (!question?.title) issues.push(`${label}: mist title`);
    if (!Number.isFinite(question?.points)) issues.push(`${label}: points moet een getal zijn`);

    if (question?.type === "location") {
      if (!Number.isFinite(question.correctLocation?.lat) || !Number.isFinite(question.correctLocation?.lng)) {
        issues.push(`${label}: correctLocation.lat/lng mist of is ongeldig`);
      }
      if (!Number.isFinite(question.scoringRadiusKm) || question.scoringRadiusKm <= 0) {
        issues.push(`${label}: scoringRadiusKm moet groter dan 0 zijn`);
      }
    }

    if (question?.type === "estimate") {
      if (!Number.isFinite(question.min) || !Number.isFinite(question.max) || question.min >= question.max) {
        issues.push(`${label}: min/max zijn ongeldig`);
      }
      if (!Number.isFinite(question.correctValue)) {
        issues.push(`${label}: correctValue mist of is ongeldig`);
      }
      if (
        question.audioUrl &&
        !question.audioUrl.startsWith("/audio/") &&
        !question.audioUrl.startsWith(`${userAssetUrlPrefix}/`)
      ) {
        issues.push(`${label}: audioUrl moet naar /audio/... of ${userAssetUrlPrefix}/... wijzen`);
      }
    }

    if (question?.type === "month") {
      if (!/^\d{4}-\d{2}$/.test(String(question.correctValue ?? ""))) {
        issues.push(`${label}: correctValue moet YYYY-MM zijn`);
      }
    }

    if (question?.type === "multiple-choice") {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        issues.push(`${label}: multiple-choice heeft minimaal twee opties nodig`);
      }
      if (!question.correctAnswer) issues.push(`${label}: correctAnswer mist`);
    }
  });

  if (issues.length) {
    throw new Error(`Quizconfig heeft fouten:\n- ${issues.join("\n- ")}`);
  }
}

// De app moet ALTIJD opstarten, ook met een kapot bewerkt vragenbestand:
// dan liever de ingebouwde quiz dan een crash bij dubbelklik.
let quiz;
try {
  quiz = loadQuiz();
  validateQuiz(quiz);
} catch (error) {
  console.warn("Geladen quiz ongeldig, ingebouwde quiz wordt gebruikt:", error.message);
  quiz = normalizeQuiz(defaultQuiz);
  validateQuiz(quiz);
}

// Wifi-gegevens voor de QR op het beamerscherm (scan = telefoon verbindt zelf).
let wifiConfig = { ssid: "", password: "" };
try {
  if (fs.existsSync(WIFI_FILE)) {
    const saved = JSON.parse(fs.readFileSync(WIFI_FILE, "utf8"));
    wifiConfig = {
      ssid: safeText(saved?.ssid, "", 64),
      password: safeText(saved?.password, "", 64),
    };
  }
} catch (error) {
  console.warn("Kon wifi-gegevens niet laden:", error.message);
}

function saveWifiConfig() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(WIFI_FILE, JSON.stringify(wifiConfig, null, 2));
  } catch (error) {
    console.warn("Kon wifi-gegevens niet opslaan:", error.message);
  }
}

const state = {
  quiz,
  currentQuestionIndex: 0,
  phase: "lobby",
  players: {},
  socketToPlayer: {},
  answers: {},
  sessionVersion: 1,
};

function resetQuizRuntime({ clearPlayers = false } = {}) {
  state.currentQuestionIndex = 0;
  state.phase = "lobby";
  state.answers = {};
  state.sessionVersion += 1;

  if (clearPlayers) {
    state.players = {};
    state.socketToPlayer = {};
    return;
  }

  Object.values(state.players).forEach((player) => {
    player.score = 0;
  });
}

function loadSavedState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (!saved || typeof saved !== "object") return;

    state.currentQuestionIndex = Math.max(
      0,
      Math.min(Number(saved.currentQuestionIndex) || 0, state.quiz.length - 1),
    );
    state.phase = ["lobby", "answering", "review", "results", "scores"].includes(saved.phase)
      ? saved.phase
      : "lobby";
    state.players = saved.players && typeof saved.players === "object" ? saved.players : {};
    state.answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
    state.sessionVersion = Number(saved.sessionVersion) || 1;
    Object.values(state.players).forEach((player) => {
      player.connected = false;
    });
  } catch (error) {
    console.warn("Kon opgeslagen quiz-state niet laden:", error.message);
  }
}

function saveState() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = JSON.stringify(
      {
        currentQuestionIndex: state.currentQuestionIndex,
        phase: state.phase,
        players: state.players,
        answers: state.answers,
        sessionVersion: state.sessionVersion,
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    fs.writeFileSync(STATE_TMP_FILE, payload);
    fs.renameSync(STATE_TMP_FILE, STATE_FILE);
  } catch (error) {
    console.warn("Kon quiz-state niet opslaan:", error.message);
  }
}

let saveStateTimer = null;

function scheduleSaveState() {
  if (saveStateTimer) return;

  saveStateTimer = setTimeout(() => {
    saveStateTimer = null;
    saveState();
  }, 100);
}

loadSavedState();

function currentQuestion() {
  return state.quiz[state.currentQuestionIndex] ?? null;
}

function privatePriority(ipAddress) {
  if (ipAddress.startsWith("172.20.")) return 0;
  if (ipAddress.startsWith("192.168.")) return 1;
  if (ipAddress.startsWith("10.")) return 2;
  if (ipAddress.startsWith("172.")) return 3;
  return 4;
}

function adapterPriority(name) {
  const lowerName = name.toLowerCase();
  const virtualAdapterHints = [
    "virtual",
    "vethernet",
    "hyper-v",
    "wsl",
    "docker",
    "vmware",
    "virtualbox",
    "bluetooth",
    "tailscale",
    "zerotier",
    "vpn",
    "loopback",
  ];

  if (virtualAdapterHints.some((hint) => lowerName.includes(hint))) return 100;
  if (lowerName.includes("wi-fi") || lowerName.includes("wifi") || lowerName.includes("wireless")) return -20;
  if (lowerName.includes("ethernet") || lowerName.includes("lan")) return -10;
  return 0;
}

function networkAddresses() {
  const addresses = Object.entries(os.networkInterfaces())
    .flatMap(([name, addresses]) =>
      addresses
        .filter((address) => address.family === "IPv4" && !address.internal)
        .filter((address) => !address.address.startsWith("169.254."))
        .map((address) => ({
          name,
          address: address.address,
          priority:
            adapterPriority(name) + privatePriority(address.address),
        })),
    )
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  if (!lastReachableAddress) return addresses;

  return addresses.slice().sort((a, b) => {
    if (a.address === lastReachableAddress) return -1;
    if (b.address === lastReachableAddress) return 1;
    return 0;
  });
}

function isRevealPhase() {
  return ["results", "scores"].includes(state.phase);
}

function sanitizedQuestion(question) {
  if (!question) return null;
  const safeQuestion = { ...question };
  delete safeQuestion.correctAnswer;
  delete safeQuestion.correctValue;
  delete safeQuestion.correctLocation;
  delete safeQuestion.answerImageUrl;
  delete safeQuestion.answerVideoUrl;
  return safeQuestion;
}

function visibleQuestion(question, role, reveal) {
  if (!reveal) return sanitizedQuestion(question);
  if (role !== "player") return question;

  const playerQuestion = { ...question };
  delete playerQuestion.answerImageUrl;
  delete playerQuestion.answerVideoUrl;
  return playerQuestion;
}

function sanitizedAnswer(answer) {
  const safeAnswer = { ...answer };
  delete safeAnswer.isCorrect;
  delete safeAnswer.points;
  delete safeAnswer.distance;
  delete safeAnswer.distancePercent;
  delete safeAnswer.distanceMeters;
  return safeAnswer;
}

function sanitizedAnswers(answers) {
  return Object.fromEntries(
    Object.entries(answers).map(([questionId, questionAnswers]) => [
      questionId,
      Object.fromEntries(
        Object.entries(questionAnswers).map(([playerId, answer]) => {
          return [playerId, sanitizedAnswer(answer)];
        }),
      ),
    ]),
  );
}

function sanitizedPlayerAnswers(socketId) {
  const playerId = state.socketToPlayer[socketId];
  if (!playerId) return {};

  return Object.fromEntries(
    Object.entries(state.answers)
      .map(([questionId, questionAnswers]) => {
        const answer = questionAnswers[playerId];
        return answer ? [questionId, { [playerId]: sanitizedAnswer(answer) }] : null;
      })
      .filter(Boolean),
  );
}

function visiblePlayers(revealScores) {
  if (revealScores) return Object.values(state.players);
  const question = currentQuestion();
  const currentAnswers = question ? state.answers[question.id] ?? {} : {};

  return Object.values(state.players).map((player) => ({
    ...player,
    score: Math.max(0, player.score - (currentAnswers[player.id]?.points ?? 0)),
  }));
}

function publicState(role = "player", addresses = networkAddresses(), socketId = null) {
  const hostView = role === "host";
  const reveal = hostView || isRevealPhase();
  const players = visiblePlayers(reveal);
  const answers = reveal
    ? state.answers
    : role === "player"
      ? sanitizedPlayerAnswers(socketId)
      : sanitizedAnswers(state.answers);

  return {
    joinCode: JOIN_CODE,
    phase: state.phase,
    currentQuestionIndex: state.currentQuestionIndex,
    currentQuestion: visibleQuestion(currentQuestion(), role, reveal),
    quiz: hostView ? state.quiz.map((question) => visibleQuestion(question, role, true)) : undefined,
    totalQuestions: state.quiz.length,
    players,
    answers,
    sessionVersion: state.sessionVersion,
    leaderboard: players.slice().sort((a, b) => b.score - a.score),
    wifi: wifiConfig.ssid ? { ssid: wifiConfig.ssid, password: wifiConfig.password } : null,
    network: {
      preferredAddress: addresses[0]?.address ?? null,
      addresses,
    },
  };
}

function broadcastState() {
  const addresses = networkAddresses();
  const snapshots = new Map();

  io.sockets.sockets.forEach((clientSocket, socketId) => {
    const role = socketRoles[socketId] ?? "player";
    const cacheKey = role === "player" && !isRevealPhase()
      ? `player:${state.socketToPlayer[socketId] ?? socketId}`
      : role;

    if (!snapshots.has(cacheKey)) {
      snapshots.set(cacheKey, publicState(role, addresses, socketId));
    }
    clientSocket.emit("state", snapshots.get(cacheKey));
  });
}

let emitStateTimer = null;

function emitState() {
  scheduleSaveState();
  if (emitStateTimer) return;

  emitStateTimer = setTimeout(() => {
    emitStateTimer = null;
    broadcastState();
  }, 25);
}

function normalizeAnswer(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeAvatar(avatar, existingAvatar) {
  const face = String(avatar?.face ?? existingAvatar?.face ?? "smile").slice(0, 24);
  const accessory = String(avatar?.accessory ?? existingAvatar?.accessory ?? "none").slice(0, 24);
  const skinTone = String(avatar?.skinTone ?? existingAvatar?.skinTone ?? "#d9a06f").slice(0, 16);
  const eyes = String(avatar?.eyes ?? existingAvatar?.eyes ?? "normal").slice(0, 24);
  const glasses = String(avatar?.glasses ?? existingAvatar?.glasses ?? "none").slice(0, 24);
  const facialHair = String(avatar?.facialHair ?? existingAvatar?.facialHair ?? "none").slice(0, 24);
  const hairStyle = String(avatar?.hairStyle ?? existingAvatar?.hairStyle ?? "short").slice(0, 24);
  const hairColor = String(avatar?.hairColor ?? existingAvatar?.hairColor ?? "#2f1b12").slice(0, 16);
  const bodyType = String(avatar?.bodyType ?? existingAvatar?.bodyType ?? "normal").slice(0, 24);
  const genderStyle = String(avatar?.genderStyle ?? existingAvatar?.genderStyle ?? "neutral").slice(0, 24);
  const shirtColor = String(
    avatar?.shirtColor ?? existingAvatar?.shirtColor ?? shirtColorPalette[Math.floor(Math.random() * shirtColorPalette.length)]
  ).slice(0, 16);
  const shirtStyle = String(avatar?.shirtStyle ?? existingAvatar?.shirtStyle ?? "tshirt").slice(0, 24);

  return {
    face: allowedAvatarFaces.has(face) ? face : "smile",
    accessory: allowedAvatarAccessories.has(accessory) ? accessory : "none",
    skinTone: allowedAvatarSkinTones.has(skinTone) ? skinTone : "#d9a06f",
    eyes: allowedAvatarEyes.has(eyes) ? eyes : "normal",
    glasses: allowedAvatarGlasses.has(glasses) ? glasses : "none",
    facialHair: allowedAvatarFacialHair.has(facialHair) ? facialHair : "none",
    hairStyle: allowedAvatarHairStyles.has(hairStyle) ? hairStyle : "short",
    hairColor: allowedAvatarHairColors.has(hairColor) ? hairColor : "#2f1b12",
    bodyType: allowedAvatarBodyTypes.has(bodyType) ? bodyType : "normal",
    genderStyle: allowedAvatarGenderStyles.has(genderStyle) ? genderStyle : "neutral",
    shirtColor: allowedAvatarShirtColors.has(shirtColor) ? shirtColor : "#14b8a6",
    shirtStyle: allowedAvatarShirtStyles.has(shirtStyle) ? shirtStyle : "tshirt",
  };
}

function distanceInKm(first, second) {
  const earthRadiusKm = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(second.lat - first.lat);
  const dLng = toRad(second.lng - first.lng);
  const lat1 = toRad(first.lat);
  const lat2 = toRad(second.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreEstimate(question, playerId, value) {
  const player = state.players[playerId];
  const answer = state.answers[question.id]?.[playerId];
  if (!player || !answer) return;

  player.score -= answer.points ?? 0;
  const guess = Number(value);
  if (!Number.isFinite(guess)) return;
  const distance = Math.abs(guess - question.correctValue);
  delete answer.distancePercent;
  let points = 0;

  if (question.round === "Hitster" || question.yearScoring) {
    const yearDistance = Math.round(distance);
    const multipliers = [1, 0.7, 0.5, 0.3, 0.1];
    points = yearDistance < multipliers.length
      ? Math.round(question.points * multipliers[yearDistance])
      : 0;
  } else {
    const percentageDistance = Math.abs(distance / Math.max(Math.abs(question.correctValue), 1));
    answer.distancePercent = percentageDistance;

    if (percentageDistance <= 0.02) {
      points = question.points;
    } else if (percentageDistance <= 0.1) {
      const ratio = 1 - ((percentageDistance - 0.02) / 0.08) * 0.2;
      points = Math.round(question.points * ratio);
    } else if (percentageDistance <= 0.2) {
      const ratio = 0.8 * (1 - (percentageDistance - 0.1) / 0.1);
      points = Math.round(question.points * ratio);
    }
  }

  answer.isCorrect = points === question.points;
  answer.points = points;
  answer.distance = distance;
  player.score += points;
}

function scoreLocation(question) {
  const answers = Object.values(state.answers[question.id] ?? {});
  const scoredAnswers = [];
  const perfectRadiusMeters = question.perfectRadiusMeters ?? 20;
  const scoringRadiusKm = question.scoringRadiusKm ?? 2500;

  for (const answer of answers) {
    const player = state.players[answer.playerId];
    if (!player) continue;

    player.score -= answer.points ?? 0;
    answer.points = 0;
    answer.isCorrect = false;

    const value = answer.value;
    if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)) {
      delete answer.distanceMeters;
      delete answer.distance;
      continue;
    }

    const distance = distanceInKm(question.correctLocation, value);
    const distanceMeters = Math.round(distance * 1000);
    answer.distanceMeters = distanceMeters;
    answer.distance = distanceMeters;
    scoredAnswers.push({ answer, player, distance, distanceMeters });
  }

  const perfectAnswers = scoredAnswers
    .filter(({ distanceMeters }) => distanceMeters <= perfectRadiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  const bestPerfectDistanceMeters = perfectAnswers[0]?.distanceMeters ?? null;
  const perfectWinnerIds = new Set(
    perfectAnswers
      .filter(({ distanceMeters }) => distanceMeters === bestPerfectDistanceMeters)
      .map(({ answer }) => answer.playerId),
  );

  for (const scored of scoredAnswers) {
    const { answer, player, distance, distanceMeters } = scored;
    let points = 0;

    if (distanceMeters <= perfectRadiusMeters) {
      points = perfectAnswers.length >= 2 && !perfectWinnerIds.has(answer.playerId)
        ? Math.max(0, question.points - 1)
        : question.points;
    } else {
      const ratio = Math.max(0, 1 - distance / scoringRadiusKm);
      points = ratio > 0 ? Math.max(1, Math.round(question.points * ratio)) : 0;
    }

    answer.points = points;
    answer.isCorrect = points === question.points;
    player.score += points;
  }
}

function scoreMultipleChoice(question, playerId, value) {
  const player = state.players[playerId];
  if (!player) return;
  const isCorrect = normalizeAnswer(value) === normalizeAnswer(question.correctAnswer);
  const existing = state.answers[question.id]?.[playerId];
  player.score -= existing?.points ?? 0;

  state.answers[question.id][playerId].isCorrect = isCorrect;
  state.answers[question.id][playerId].points = 0;
  if (isCorrect) {
    player.score += question.points;
    state.answers[question.id][playerId].points = question.points;
  }
}

function monthIndex(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
}

function scoreMonth(question, playerId, value) {
  const player = state.players[playerId];
  const answer = state.answers[question.id]?.[playerId];
  if (!player || !answer) return;

  player.score -= answer.points ?? 0;
  const guess = monthIndex(value);
  const correct = monthIndex(question.correctValue);
  let points = 0;

  if (guess !== null && correct !== null) {
    const monthsOff = Math.abs(guess - correct);
    const multipliers = [1, 0.7, 0.5, 0.3, 0.1];
    points = monthsOff < multipliers.length
      ? Math.round(question.points * multipliers[monthsOff])
      : 0;
  }

  answer.isCorrect = points === question.points;
  answer.points = points;
  player.score += points;
}

function recomputeScoresFromAnswers() {
  Object.values(state.players).forEach((player) => {
    player.score = 0;
  });

  for (const question of state.quiz) {
    const questionAnswers = state.answers[question.id];
    if (!questionAnswers) continue;

    Object.values(questionAnswers).forEach((answer) => {
      answer.points = 0;
      if (question.type !== "open") {
        answer.isCorrect = null;
      }
    });

    if (question.type === "location") {
      scoreLocation(question);
      continue;
    }

    for (const answer of Object.values(questionAnswers)) {
      if (question.type === "multiple-choice") {
        scoreMultipleChoice(question, answer.playerId, answer.value);
      } else if (question.type === "estimate") {
        scoreEstimate(question, answer.playerId, answer.value);
      } else if (question.type === "month") {
        scoreMonth(question, answer.playerId, answer.value);
      } else if (question.type === "open" && answer.isCorrect === true) {
        const player = state.players[answer.playerId];
        if (!player) continue;
        answer.points = question.points;
        player.score += answer.points;
      }
    }
  }
}

recomputeScoresFromAnswers();
saveState();

io.on("connection", (socket) => {
  socketRoles[socket.id] = "player";
  socket.emit("state", publicState("player", networkAddresses(), socket.id));

  socket.on("view:role", (role) => {
    const safeRole = ["host", "screen", "player"].includes(role) ? role : "player";
    socketRoles[socket.id] = safeRole;
    socket.emit("state", publicState(safeRole, networkAddresses(), socket.id));
  });

  socket.on("join", ({ name, playerId, avatar }) => {
    const trimmedName = String(name ?? "").trim().slice(0, 32);
    if (!trimmedName) return;

    const id =
      String(playerId ?? "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 48) || socket.id;

    state.socketToPlayer[socket.id] = id;
    state.players[id] = {
      id,
      name: trimmedName,
      avatar: normalizeAvatar(avatar, state.players[id]?.avatar),
      score: state.players[id]?.score ?? 0,
      connected: true,
    };
    emitState();
  });

  socket.on("submit-answer", ({ value, playerId: claimedPlayerId }) => {
    const question = currentQuestion();
    let playerId = state.socketToPlayer[socket.id];

    // Herstel na een reconnect (bijv. telefoon kwam terug uit de achtergrond):
    // koppel deze socket alsnog aan de speler die het antwoord instuurt.
    if (!playerId) {
      const cleanedId = String(claimedPlayerId ?? "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 48);
      if (cleanedId && state.players[cleanedId]) {
        playerId = cleanedId;
        state.socketToPlayer[socket.id] = cleanedId;
        state.players[cleanedId].connected = true;
      }
    }

    const player = state.players[playerId];
    if (!question || !player || state.phase !== "answering") return;

    if (!state.answers[question.id]) {
      state.answers[question.id] = {};
    }

    if (state.answers[question.id][playerId]) {
      socket.emit("state", publicState(socketRoles[socket.id] ?? "player", networkAddresses(), socket.id));
      return;
    }

    state.answers[question.id][playerId] = {
      playerId,
      playerName: player.name,
      avatar: player.avatar,
      value:
        question.type === "location"
          ? {
              lat: Math.max(-90, Math.min(90, Number(value?.lat))),
              lng: Math.max(-180, Math.min(180, Number(value?.lng))),
            }
          : String(value ?? "").trim().slice(0, 500),
      isCorrect: null,
      points: 0,
      submittedAt: Date.now(),
    };

    if (question.type === "multiple-choice") {
      scoreMultipleChoice(question, playerId, value);
    } else if (question.type === "estimate") {
      scoreEstimate(question, playerId, value);
    } else if (question.type === "location") {
      scoreLocation(question, playerId, value);
    } else if (question.type === "month") {
      scoreMonth(question, playerId, value);
    }

    emitState();
  });

  socket.on("player:reset-profile", ({ playerId }) => {
    const id = String(playerId ?? state.socketToPlayer[socket.id] ?? "").trim();
    if (!id) return;

    delete state.players[id];
    Object.values(state.answers).forEach((questionAnswers) => {
      delete questionAnswers[id];
    });
    Object.entries(state.socketToPlayer).forEach(([socketId, mappedPlayerId]) => {
      if (mappedPlayerId === id) {
        delete state.socketToPlayer[socketId];
      }
    });
    emitState();
  });

  socket.on("host:set-phase", (phase) => {
    if (!["lobby", "answering", "review", "results", "scores"].includes(phase)) return;
    state.phase = phase;
    emitState();
  });

  socket.on("host:next-question", () => {
    state.currentQuestionIndex = Math.min(
      state.currentQuestionIndex + 1,
      state.quiz.length - 1,
    );
    state.phase = "answering";
    emitState();
  });

  socket.on("host:advance", () => {
    const question = currentQuestion();
    const answers = question ? Object.values(state.answers[question.id] ?? {}) : [];
    const hasPendingOpenAnswers =
      question?.type === "open" && answers.some((answer) => answer.isCorrect === null);

    if (state.phase === "lobby") {
      state.phase = "answering";
    } else if (state.phase === "answering") {
      state.phase = hasPendingOpenAnswers ? "review" : "results";
    } else if (state.phase === "review") {
      state.phase = "results";
    } else if (state.phase === "results" || state.phase === "scores") {
      if (state.currentQuestionIndex >= state.quiz.length - 1) {
        state.phase = "scores";
      } else {
        state.currentQuestionIndex += 1;
        state.phase = "answering";
      }
    } else {
      state.phase = "answering";
    }

    emitState();
  });

  socket.on("host:previous-question", () => {
    state.currentQuestionIndex = Math.max(state.currentQuestionIndex - 1, 0);
    state.phase = "answering";
    emitState();
  });

  socket.on("host:judge-answer", ({ questionId, playerId, isCorrect }) => {
    const questionAnswers = state.answers[questionId];
    const answer = questionAnswers?.[playerId];
    const player = state.players[playerId];
    const question = state.quiz.find((item) => item.id === questionId);
    if (!answer || !player || !question) return;

    if (answer.isCorrect === true) {
      player.score -= answer.points;
    }

    answer.isCorrect = Boolean(isCorrect);
    answer.points = answer.isCorrect ? question.points : 0;
    if (answer.isCorrect) {
      player.score += answer.points;
    }

    emitState();
  });

  socket.on("host:set-wifi", ({ ssid, password }) => {
    wifiConfig = {
      ssid: safeText(ssid, "", 64),
      password: safeText(password, "", 64),
    };
    saveWifiConfig();
    emitState();
  });

  socket.on("host:reset", () => {
    state.currentQuestionIndex = 0;
    state.phase = "lobby";
    state.answers = {};
    Object.values(state.players).forEach((player) => {
      player.score = 0;
    });
    emitState();
  });

  socket.on("host:clear-players", () => {
    state.currentQuestionIndex = 0;
    state.phase = "lobby";
    state.players = {};
    state.socketToPlayer = {};
    state.answers = {};
    state.sessionVersion += 1;
    emitState();
  });

  socket.on("host:remove-player", ({ playerId }) => {
    const id = String(playerId ?? "").trim();
    if (!state.players[id]) return;

    delete state.players[id];
    Object.values(state.answers).forEach((questionAnswers) => {
      delete questionAnswers[id];
    });
    Object.entries(state.socketToPlayer).forEach(([socketId, mappedPlayerId]) => {
      if (mappedPlayerId === id) {
        delete state.socketToPlayer[socketId];
      }
    });
    emitState();
  });

  socket.on("disconnect", () => {
    delete socketRoles[socket.id];
    const playerId = state.socketToPlayer[socket.id];
    if (playerId && state.players[playerId]) {
      state.players[playerId].connected = false;
      delete state.socketToPlayer[socket.id];
      emitState();
    }
  });
});

const distPath = path.join(__dirname, "..", "dist");

function safeFileBaseName(fileName, fallback = "asset") {
  const parsed = path.parse(String(fileName ?? fallback));
  return (parsed.name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || fallback;
}

function extensionForUpload(fileName, mimeType, kind) {
  const ext = path.extname(String(fileName ?? "")).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const allowedImageExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
  const allowedAudioExts = new Set([".mp3", ".wav", ".m4a", ".ogg", ".webm"]);
  if (kind === "image" && allowedImageExts.has(ext)) return ext;
  if (kind === "audio" && allowedAudioExts.has(ext)) return ext;

  const mimeMap = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
  };
  return mimeMap[mimeType] ?? (kind === "audio" ? ".mp3" : ".png");
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl ?? ""));
  if (!match) {
    throw new Error("Upload mist geldige data-url.");
  }
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

app.get("/api/editor/quiz", (_req, res) => {
  res.json({ questions: state.quiz });
});

app.post("/api/editor/quiz", (req, res) => {
  try {
    const questions = normalizeQuiz(req.body?.questions ?? req.body?.quiz);
    validateQuiz(questions);
    saveQuiz(questions);
    state.quiz = questions;
    resetQuizRuntime();
    saveState();
    emitState();
    res.json({ ok: true, questions: state.quiz });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/editor/quiz/default", (_req, res) => {
  try {
    const questions = normalizeQuiz(starterQuiz());
    validateQuiz(questions);
    saveQuiz(questions);
    state.quiz = questions;
    resetQuizRuntime();
    saveState();
    emitState();
    res.json({ ok: true, questions: state.quiz });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/editor/upload", (req, res) => {
  try {
    const kind = req.body?.kind === "audio" ? "audio" : "image";
    const { mimeType, buffer } = parseDataUrl(req.body?.dataUrl);
    if (kind === "image" && !mimeType.startsWith("image/")) {
      throw new Error("Dit bestand is geen afbeelding.");
    }
    if (kind === "audio" && !mimeType.startsWith("audio/")) {
      throw new Error("Dit bestand is geen audio.");
    }
    if (buffer.length > 70 * 1024 * 1024) {
      throw new Error("Bestand is te groot. Maximaal 70 MB.");
    }

    const folder = kind === "audio" ? "audio" : "images";
    const uploadDir = path.join(USER_ASSET_DIR, folder);
    fs.mkdirSync(uploadDir, { recursive: true });
    const baseName = safeFileBaseName(req.body?.fileName, kind);
    const ext = extensionForUpload(req.body?.fileName, mimeType, kind);
    const fileName = `${Date.now()}-${baseName}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    const resolvedUploadDir = path.resolve(uploadDir);
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
      throw new Error("Ongeldig uploadpad.");
    }

    fs.writeFileSync(resolvedFilePath, buffer);
    res.json({
      ok: true,
      url: `${userAssetUrlPrefix}/${folder}/${fileName}`,
      fileName,
      size: buffer.length,
      mimeType,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, phase: state.phase, players: Object.keys(state.players).length });
});
app.get("/api/state", (_req, res) => {
  res.json(publicState());
});
app.use(userAssetUrlPrefix, express.static(USER_ASSET_DIR));
app.use(express.static(distPath));
app.use((_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.log("");
    console.log(`[FOUT] Poort ${PORT} is bezet: er draait al een Pubquizzz.`);
    console.log("       Sluit alle zwarte vensters en start daarna opnieuw.");
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Pubquizzz server draait op http://localhost:${PORT}`);
  const addresses = networkAddresses();
  console.log("");
  if (addresses.length === 0) {
    console.log("[LET OP] Geen netwerkadres gevonden. Zit de laptop wel op wifi of een hotspot?");
    console.log("         Telefoons kunnen nu NIET meedoen.");
  } else {
    console.log(`Telefoons doen mee via: http://${addresses[0].address}:${PORT}`);
    console.log("Dit adres zit ook in de QR-code op het beamer-scherm.");
    console.log("Zodra een telefoon verbindt, zie je hieronder een [OK]-melding verschijnen.");
    if (addresses.length > 1) {
      console.log("");
      console.log("Werkt de QR-code niet? Probeer deze adressen dan eens op de telefoon:");
      for (const entry of addresses.slice(1)) {
        console.log(`  - http://${entry.address}:${PORT}   (via ${entry.name})`);
      }
    }
  }
  console.log("");
});
