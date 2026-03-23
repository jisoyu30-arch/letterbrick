// ── LetterBrick Dashboard ──
// Basic stats display. Full expansion in Phase 5.

(function () {
  "use strict";

  var stats = LB.getStats();
  var archive = LB.getArchive();

  // Summary stats
  var totalBricks = stats.growth.totalBricks + stats.healing.totalBricks;
  var totalSessions = stats.growth.totalSessions + stats.healing.totalSessions;
  var totalSeconds = stats.growth.totalSeconds + stats.healing.totalSeconds;

  document.getElementById("totalBricksAll").textContent = totalBricks;
  document.getElementById("totalSessions").textContent = totalSessions;
  document.getElementById("totalTime").textContent = LB.formatTime(totalSeconds);

  // Growth summary
  var growthEl = document.getElementById("growthSummary");
  if (stats.growth.totalSessions > 0) {
    var gi = LB.getNextStageInfo("growth", stats.growth.totalBricks, stats.growth.currentStreak);
    growthEl.textContent =
      stats.growth.totalBricks + " bricks \u00B7 " +
      gi.currentStage + " \u00B7 " +
      stats.growth.currentStreak + " day streak";
  }

  // Healing summary
  var healingEl = document.getElementById("healingSummary");
  if (stats.healing.totalSessions > 0) {
    var hi = LB.getNextStageInfo("healing", stats.healing.totalBricks, stats.healing.currentStreak);
    healingEl.textContent =
      stats.healing.totalBricks + " bricks \u00B7 " +
      hi.currentStage + " \u00B7 " +
      stats.healing.currentStreak + " day streak";
  }

  // Recent sessions (last 10)
  var container = document.getElementById("recentSessions");
  if (archive.length > 0) {
    container.innerHTML = "";
    var recent = archive.slice(-10).reverse();
    recent.forEach(function (session) {
      var div = document.createElement("div");
      div.className = "session-entry";
      var preview = session.contentText || "";
      if (preview.length > 60) preview = preview.slice(0, 60) + "\u2026";
      div.innerHTML =
        '<div class="session-row">' +
          '<span class="session-date">' + (session.date || "") + '</span>' +
          '<span class="session-edition">' + (session.edition || "") + '</span>' +
          '<span class="session-bricks">+' + (session.bricksEarned || 0) + ' brick' + (session.bricksEarned !== 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div class="session-preview">' + preview + '</div>';
      container.appendChild(div);
    });
  }
})();
