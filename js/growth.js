// ── LetterBrick Growth Edition ──
// Preserved MVP logic: copy → transform → create → feedback.
// Now uses shared.js for stats/archive and quotes-growth.js for content.

// ── State ──
var selectedQuote = "";
var selectedQuoteObj = null;
var startTime = null;
var todayBricks = 0;
var todaySeconds = 0;

// ── DOM ──
var $ = function (id) { return document.getElementById(id); };

var quoteSelection = $("quoteSelection");
var quoteList = $("quoteList");
var step1 = $("step1");
var step2 = $("step2");
var step3 = $("step3");
var feedback = $("feedback");

var copyInput = $("copyInput");
var transformInput = $("transformInput");
var createInput = $("createInput");

var copyNext = $("copyNext");
var transformNext = $("transformNext");
var submitBrick = $("submitBrick");

// ── Init ──
loadTodayLocal();
renderQuotes();
updateStatsUI();
updateWorldStageUI();

// ── Track today's session-local bricks/time ──
// (for the "Today's Bricks" display, which resets on page load per day)
function loadTodayLocal() {
  try {
    var raw = localStorage.getItem("lb_growth_today");
    if (raw) {
      var data = JSON.parse(raw);
      if (data.date === new Date().toDateString()) {
        todayBricks = data.bricks || 0;
        todaySeconds = data.seconds || 0;
        return;
      }
    }
  } catch (e) { /* ignore */ }
  todayBricks = 0;
  todaySeconds = 0;
}

function saveTodayLocal() {
  localStorage.setItem("lb_growth_today", JSON.stringify({
    date: new Date().toDateString(),
    bricks: todayBricks,
    seconds: todaySeconds,
  }));
}

// ── Quotes ──
function pickDailyQuotes() {
  var today = new Date().toDateString();
  var seed = 0;
  for (var i = 0; i < today.length; i++) seed += today.charCodeAt(i);

  var pool = GROWTH_QUOTES;
  var shuffled = pool.slice().sort(function (a, b) {
    return LB.hashString(a.text + seed) - LB.hashString(b.text + seed);
  });
  return shuffled.slice(0, 3);
}

function renderQuotes() {
  var daily = pickDailyQuotes();
  quoteList.innerHTML = "";

  daily.forEach(function (q) {
    var btn = document.createElement("button");
    btn.className = "quote-option";
    btn.innerHTML =
      '<span class="quote-text">\u201C' + q.text + '\u201D</span>' +
      '<span class="quote-author">\u2014 ' + q.author + '</span>' +
      '<span class="quote-reason">' + q.selectionReason + '</span>';
    btn.addEventListener("click", function () { selectQuote(q, btn); });
    quoteList.appendChild(btn);
  });
}

function selectQuote(quoteObj, btn) {
  selectedQuote = quoteObj.text;
  selectedQuoteObj = quoteObj;
  document.querySelectorAll(".quote-option").forEach(function (b) {
    b.classList.remove("selected");
  });
  btn.classList.add("selected");

  // Move to step 1
  setTimeout(function () {
    quoteSelection.classList.add("hidden");
    step1.classList.remove("hidden");
    $("selectedQuote").textContent = "\u201C" + selectedQuote + "\u201D";
    $("quoteMeta").textContent = "\u2014 " + quoteObj.author +
      (quoteObj.source ? ", " + quoteObj.source : "");
    $("transformQuote").textContent = "\u201C" + selectedQuote + "\u201D";
    $("createQuote").textContent = "\u201C" + selectedQuote + "\u201D";
    copyInput.focus();
    startTime = Date.now();
  }, 300);
}

// ── Step 1: Copy ──
copyInput.addEventListener("input", function () {
  var val = copyInput.value.trim();
  var target = selectedQuote;
  var match = $("copyMatch");

  if (val === target) {
    match.textContent = "Perfect match!";
    match.className = "match-indicator perfect";
    copyNext.disabled = false;
  } else if (target.startsWith(val) && val.length > 0) {
    var pct = Math.round((val.length / target.length) * 100);
    match.textContent = pct + "% matched...";
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

copyNext.addEventListener("click", function () {
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
  transformInput.focus();
});

// ── Step 2: Transform ──
transformInput.addEventListener("input", function () {
  var val = transformInput.value.trim();
  transformNext.disabled = val.length < 15;
});

transformNext.addEventListener("click", function () {
  step2.classList.add("hidden");
  step3.classList.remove("hidden");
  createInput.focus();
});

// ── Step 3: Create ──
createInput.addEventListener("input", function () {
  var val = createInput.value.trim();
  submitBrick.disabled = val.length < 15;
});

submitBrick.addEventListener("click", function () {
  step3.classList.add("hidden");
  showFeedback();
});

// ── Feedback ──
function showFeedback() {
  var elapsed = Math.round((Date.now() - startTime) / 1000);
  var copyText = copyInput.value.trim();
  var transformText = transformInput.value.trim();
  var createText = createInput.value.trim();

  // Score components (preserved from MVP)
  var copyScore = copyText === selectedQuote ? 30 : 15;
  var transformScore = scoreTransform(transformText);
  var createScore = scoreCreate(createText);
  var total = Math.min(100, copyScore + transformScore + createScore);

  // Animate score ring
  var circle = $("scoreCircle");
  var offset = 264 - (264 * total) / 100;
  requestAnimationFrame(function () {
    circle.style.strokeDashoffset = offset;
  });
  $("brickScore").textContent = total;

  // Analysis
  var analysis = [
    ["Copy Accuracy", copyText === selectedQuote ? "Perfect" : "Close"],
    ["Structure Change", transformScore >= 25 ? "Strong" : transformScore >= 15 ? "Moderate" : "Minimal"],
    ["Creativity", createScore >= 35 ? "Excellent" : createScore >= 20 ? "Good" : "Developing"],
    ["Time Spent", LB.formatTime(elapsed)],
  ];
  var list = $("analysisList");
  list.innerHTML = "";
  analysis.forEach(function (pair) {
    var li = document.createElement("li");
    li.innerHTML = "<span>" + pair[0] + "</span><span>" + pair[1] + "</span>";
    list.appendChild(li);
  });

  // Coach comment
  $("coachComment").textContent = generateCoachComment(total, transformText, createText);

  // Brick count for this session (using MVP logic: 1 brick per completion)
  var bricksEarned = 1;

  // Update shared stats
  LB.updateStats("growth", bricksEarned, elapsed);

  // Update today's local counter
  todayBricks += bricksEarned;
  todaySeconds += elapsed;
  saveTodayLocal();

  // Save to archive
  LB.saveSessionToArchive({
    id: LB.generateSessionId(),
    edition: "growth",
    date: new Date().toISOString().slice(0, 10),
    startedAt: startTime,
    durationSeconds: elapsed,
    inputMode: "typing",
    contentId: selectedQuoteObj ? selectedQuoteObj.id : null,
    contentText: selectedQuote,
    contentAuthor: selectedQuoteObj ? selectedQuoteObj.author : "",
    contentSource: selectedQuoteObj ? selectedQuoteObj.source : "",
    copyText: copyText,
    transformText: transformText,
    createText: createText,
    bricksEarned: bricksEarned,
    scoreBreakdown: {
      copy: copyScore,
      transform: transformScore,
      create: createScore,
      total: total,
    },
    coachComment: $("coachComment").textContent,
  });

  // Mark quote as seen
  if (selectedQuoteObj) {
    LB.markContentSeen(selectedQuoteObj.id);
  }

  updateStatsUI();
  updateWorldStageUI();

  feedback.classList.remove("hidden");
}

function scoreTransform(text) {
  if (!text) return 0;
  var words = text.split(/\s+/).length;
  var differentStart = !text.toLowerCase().startsWith(selectedQuote.split(" ")[0].toLowerCase());
  var score = 10;
  if (words >= 5) score += 5;
  if (words >= 8) score += 5;
  if (differentStart) score += 10;
  if (text.length > selectedQuote.length * 0.5) score += 5;
  return Math.min(35, score);
}

function scoreCreate(text) {
  if (!text) return 0;
  var words = text.split(/\s+/).length;
  var originalWords = {};
  selectedQuote.toLowerCase().split(/\s+/).forEach(function (w) { originalWords[w] = true; });
  var newWords = text.toLowerCase().split(/\s+/).filter(function (w) { return !originalWords[w]; });
  var novelty = newWords.length / Math.max(1, words);

  var score = 10;
  if (words >= 6) score += 5;
  if (words >= 10) score += 5;
  if (novelty > 0.4) score += 10;
  if (novelty > 0.6) score += 5;
  return Math.min(35, score);
}

function generateCoachComment(score, transformText, createText) {
  if (score >= 85) {
    return "Outstanding work! Your transformation shows real structural awareness, and your creative sentence brings a fresh voice. Keep building \u2014 you\u2019re developing a strong writing instinct.";
  }
  if (score >= 65) {
    return "Solid brick! You\u2019re getting the hang of reshaping sentences. Next time, try pushing your creative sentence even further from the original \u2014 use it as a springboard, not a template.";
  }
  if (score >= 45) {
    return "Good effort! Your copy was on point. For the transform step, try changing the sentence order or voice (active to passive, or vice versa). Small structural shifts build big skills over time.";
  }
  return "Every brick counts! The most important thing is showing up. Try reading the quote aloud before transforming it \u2014 hearing the rhythm helps you find new structures. Keep going!";
}

// ── Stats UI ──
function updateStatsUI() {
  $("totalBricks").textContent = todayBricks;
  var stats = LB.getStats();
  $("streakDays").textContent = stats.growth.currentStreak;
  $("writingTime").textContent = LB.formatTime(todaySeconds);
}

function updateWorldStageUI() {
  var stats = LB.getStats();
  var info = LB.getNextStageInfo("growth", stats.growth.totalBricks, stats.growth.currentStreak);

  $("stageName").textContent = info.currentStage;

  if (info.nextStage) {
    var pct = Math.round((info.current / info.nextAt) * 100);
    $("stageFill").style.width = Math.min(100, pct) + "%";
    $("stageLabel").textContent = info.current + " / " + info.nextAt + " bricks to " + info.nextStage;
  } else {
    $("stageFill").style.width = "100%";
    $("stageLabel").textContent = info.current + " bricks \u2014 max stage reached";
  }
}

// ── Reset ──
$("newBrick").addEventListener("click", function () {
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
  selectedQuoteObj = null;
  startTime = null;

  quoteSelection.classList.remove("hidden");
  renderQuotes();
});
