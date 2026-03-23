// ── Quote Bank ──
const QUOTES = [
  "The only way to do great work is to love what you do.",
  "In the middle of difficulty lies opportunity.",
  "What we think, we become.",
  "The best time to plant a tree was twenty years ago. The second best time is now.",
  "Not all those who wander are lost.",
  "We write to taste life twice, in the moment and in retrospect.",
  "Simplicity is the ultimate sophistication.",
  "A room without books is like a body without a soul.",
  "The pen is the tongue of the mind.",
  "If you want to be a writer, you must do two things: read a lot and write a lot.",
  "Start writing, no matter what. The water does not flow until the faucet is turned on.",
  "You can always edit a bad page. You cannot edit a blank page.",
  "Either write something worth reading or do something worth writing.",
  "There is no greater agony than bearing an untold story inside you.",
  "Words are a lens to focus one's mind.",
];

// ── State ──
let selectedQuote = "";
let startTime = null;
let stats = loadStats();

// ── DOM ──
const $ = (id) => document.getElementById(id);

const quoteSelection = $("quoteSelection");
const quoteList = $("quoteList");
const step1 = $("step1");
const step2 = $("step2");
const step3 = $("step3");
const feedback = $("feedback");

const copyInput = $("copyInput");
const transformInput = $("transformInput");
const createInput = $("createInput");

const copyNext = $("copyNext");
const transformNext = $("transformNext");
const submitBrick = $("submitBrick");

// ── Init ──
renderQuotes();
updateStatsUI();

// ── Quotes ──
function pickDailyQuotes() {
  const today = new Date().toDateString();
  let seed = 0;
  for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i);

  const shuffled = [...QUOTES].sort((a, b) => {
    const ha = hash(a + seed);
    const hb = hash(b + seed);
    return ha - hb;
  });
  return shuffled.slice(0, 3);
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function renderQuotes() {
  const daily = pickDailyQuotes();
  quoteList.innerHTML = "";

  daily.forEach((q) => {
    const btn = document.createElement("button");
    btn.className = "quote-option";
    btn.textContent = `"${q}"`;
    btn.addEventListener("click", () => selectQuote(q, btn));
    quoteList.appendChild(btn);
  });
}

function selectQuote(quote, btn) {
  selectedQuote = quote;
  document.querySelectorAll(".quote-option").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");

  // Move to step 1
  setTimeout(() => {
    quoteSelection.classList.add("hidden");
    step1.classList.remove("hidden");
    $("selectedQuote").textContent = `"${quote}"`;
    $("transformQuote").textContent = `"${quote}"`;
    $("createQuote").textContent = `"${quote}"`;
    copyInput.focus();
    startTime = Date.now();
  }, 300);
}

// ── Step 1: Copy ──
copyInput.addEventListener("input", () => {
  const val = copyInput.value.trim();
  const target = selectedQuote;
  const match = $("copyMatch");

  if (val === target) {
    match.textContent = "Perfect match!";
    match.className = "match-indicator perfect";
    copyNext.disabled = false;
  } else if (target.startsWith(val) && val.length > 0) {
    const pct = Math.round((val.length / target.length) * 100);
    match.textContent = `${pct}% matched...`;
    match.className = "match-indicator partial";
    copyNext.disabled = true;
  } else if (val.length > 0) {
    match.textContent = "Check for typos.";
    match.className = "match-indicator partial";
    copyNext.disabled = true;
  } else {
    match.textContent = "";
    match.className = "match-indicator";
    copyNext.disabled = true;
  }
});

copyNext.addEventListener("click", () => {
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
  transformInput.focus();
});

// ── Step 2: Transform ──
transformInput.addEventListener("input", () => {
  const val = transformInput.value.trim();
  transformNext.disabled = val.length < 15;
});

transformNext.addEventListener("click", () => {
  step2.classList.add("hidden");
  step3.classList.remove("hidden");
  createInput.focus();
});

// ── Step 3: Create ──
createInput.addEventListener("input", () => {
  const val = createInput.value.trim();
  submitBrick.disabled = val.length < 15;
});

submitBrick.addEventListener("click", () => {
  step3.classList.add("hidden");
  showFeedback();
});

// ── Feedback ──
function showFeedback() {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const copyText = copyInput.value.trim();
  const transformText = transformInput.value.trim();
  const createText = createInput.value.trim();

  // Score components
  const copyScore = copyText === selectedQuote ? 30 : 15;
  const transformScore = scoreTransform(transformText);
  const createScore = scoreCreate(createText);
  const total = Math.min(100, copyScore + transformScore + createScore);

  // Animate score ring
  const circle = $("scoreCircle");
  const offset = 264 - (264 * total) / 100;
  requestAnimationFrame(() => {
    circle.style.strokeDashoffset = offset;
  });
  $("brickScore").textContent = total;

  // Analysis
  const analysis = [
    ["Copy Accuracy", copyText === selectedQuote ? "Perfect" : "Close"],
    ["Structure Change", transformScore >= 25 ? "Strong" : transformScore >= 15 ? "Moderate" : "Minimal"],
    ["Creativity", createScore >= 35 ? "Excellent" : createScore >= 20 ? "Good" : "Developing"],
    ["Time Spent", formatTime(elapsed)],
  ];
  const list = $("analysisList");
  list.innerHTML = "";
  analysis.forEach(([label, value]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${label}</span><span>${value}</span>`;
    list.appendChild(li);
  });

  // Coach comment
  $("coachComment").textContent = generateCoachComment(total, transformText, createText);

  // Update stats
  stats.bricks++;
  stats.totalSeconds += elapsed;
  stats.lastDate = new Date().toDateString();
  saveStats();
  updateStatsUI();

  feedback.classList.remove("hidden");
}

function scoreTransform(text) {
  if (!text) return 0;
  const words = text.split(/\s+/).length;
  const differentStart = !text.toLowerCase().startsWith(selectedQuote.split(" ")[0].toLowerCase());
  let score = 10;
  if (words >= 5) score += 5;
  if (words >= 8) score += 5;
  if (differentStart) score += 10;
  if (text.length > selectedQuote.length * 0.5) score += 5;
  return Math.min(35, score);
}

function scoreCreate(text) {
  if (!text) return 0;
  const words = text.split(/\s+/).length;
  const originalWords = new Set(selectedQuote.toLowerCase().split(/\s+/));
  const newWords = text.toLowerCase().split(/\s+/).filter((w) => !originalWords.has(w));
  const novelty = newWords.length / Math.max(1, words);

  let score = 10;
  if (words >= 6) score += 5;
  if (words >= 10) score += 5;
  if (novelty > 0.4) score += 10;
  if (novelty > 0.6) score += 5;
  return Math.min(35, score);
}

function generateCoachComment(score, transformText, createText) {
  if (score >= 85) {
    return "Outstanding work! Your transformation shows real structural awareness, and your creative sentence brings a fresh voice. Keep building — you're developing a strong writing instinct.";
  }
  if (score >= 65) {
    return "Solid brick! You're getting the hang of reshaping sentences. Next time, try pushing your creative sentence even further from the original — use it as a springboard, not a template.";
  }
  if (score >= 45) {
    return "Good effort! Your copy was on point. For the transform step, try changing the sentence order or voice (active to passive, or vice versa). Small structural shifts build big skills over time.";
  }
  return "Every brick counts! The most important thing is showing up. Try reading the quote aloud before transforming it — hearing the rhythm helps you find new structures. Keep going!";
}

// ── Stats ──
function loadStats() {
  try {
    const raw = localStorage.getItem("letterbrick_stats");
    if (raw) {
      const s = JSON.parse(raw);
      // Reset daily count if it's a new day
      if (s.lastDate !== new Date().toDateString()) {
        // Check streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (s.lastDate === yesterday.toDateString()) {
          s.streak++;
        } else if (s.lastDate !== new Date().toDateString()) {
          s.streak = 0;
        }
        s.bricks = 0;
        s.totalSeconds = 0;
      }
      return s;
    }
  } catch (e) {
    // ignore
  }
  return { bricks: 0, streak: 0, totalSeconds: 0, lastDate: "" };
}

function saveStats() {
  localStorage.setItem("letterbrick_stats", JSON.stringify(stats));
}

function updateStatsUI() {
  $("totalBricks").textContent = stats.bricks;
  $("streakDays").textContent = stats.streak;
  $("writingTime").textContent = formatTime(stats.totalSeconds);
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Reset ──
$("newBrick").addEventListener("click", () => {
  feedback.classList.add("hidden");
  copyInput.value = "";
  transformInput.value = "";
  createInput.value = "";
  $("copyMatch").textContent = "";
  copyNext.disabled = true;
  transformNext.disabled = true;
  submitBrick.disabled = true;
  $("scoreCircle").style.strokeDashoffset = 264;
  selectedQuote = "";
  startTime = null;

  quoteSelection.classList.remove("hidden");
  renderQuotes();
});
