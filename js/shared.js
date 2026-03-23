// ── LetterBrick Shared Layer ──
// Common utilities for brick engine, stats, archive, and world progression.
// Used by both Growth and Healing editions.

(function (window) {
  "use strict";

  // ── localStorage helpers ──
  function lbGet(key) {
    try {
      const raw = localStorage.getItem("lb_" + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function lbSet(key, val) {
    localStorage.setItem("lb_" + key, JSON.stringify(val));
  }

  // ── Default stats shape ──
  function defaultEditionStats() {
    return {
      totalBricks: 0,
      totalSessions: 0,
      totalSeconds: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastSessionDate: "",
      worldStage: "Brick",
    };
  }

  function defaultStats() {
    return {
      healing: defaultEditionStats(),
      growth: defaultEditionStats(),
      seenContentIds: [],
    };
  }

  // ── Migration from old MVP format ──
  // The original app.js stored stats under key "letterbrick_stats"
  // with shape: { bricks, streak, totalSeconds, lastDate }
  // We migrate this into the new lb_stats.growth bucket once.
  function migrateOldStats(stats) {
    try {
      var raw = localStorage.getItem("letterbrick_stats");
      if (!raw) return stats;

      var old = JSON.parse(raw);
      stats.growth.totalBricks = old.bricks || 0;
      stats.growth.currentStreak = old.streak || 0;
      stats.growth.totalSeconds = old.totalSeconds || 0;
      stats.growth.lastSessionDate = old.lastDate || "";
      stats.growth.totalSessions = old.bricks || 0;

      // Remove old key so migration only runs once
      localStorage.removeItem("letterbrick_stats");
      lbSet("stats", stats);
    } catch (e) {
      // migration failed — not critical, just start fresh
    }
    return stats;
  }

  // ── Stats access ──
  function getStats() {
    var stats = lbGet("stats");
    if (!stats) {
      stats = defaultStats();
      stats = migrateOldStats(stats);
      lbSet("stats", stats);
    }
    // Ensure both edition buckets exist (forward compatibility)
    if (!stats.healing) stats.healing = defaultEditionStats();
    if (!stats.growth) stats.growth = defaultEditionStats();
    if (!stats.seenContentIds) stats.seenContentIds = [];
    return stats;
  }

  function updateStats(edition, bricksEarned, seconds) {
    var stats = getStats();
    var ed = stats[edition];
    var today = new Date().toDateString();

    // Streak logic
    if (ed.lastSessionDate !== today) {
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (ed.lastSessionDate === yesterday.toDateString()) {
        ed.currentStreak++;
      } else if (ed.lastSessionDate === "") {
        // First ever session
        ed.currentStreak = 1;
      } else if (ed.lastSessionDate !== today) {
        ed.currentStreak = 1;
      }
      if (ed.currentStreak > ed.longestStreak) {
        ed.longestStreak = ed.currentStreak;
      }
    }

    ed.totalBricks += bricksEarned;
    ed.totalSessions++;
    ed.totalSeconds += seconds;
    ed.lastSessionDate = today;
    ed.worldStage = getWorldStage(edition, ed.totalBricks, ed.currentStreak);

    stats[edition] = ed;
    lbSet("stats", stats);
    return stats;
  }

  // ── World stage calculation ──
  function getWorldStage(edition, totalBricks, currentStreak) {
    if (edition === "healing") {
      if (totalBricks >= 1500) return "Cosmic Library";
      if (totalBricks >= 700) return "Library";
      if (totalBricks >= 300) return "Castle";
      if (totalBricks >= 100) return "Mansion";
      if (totalBricks >= 30) return "House";
      if (currentStreak >= 7) return "House Foundation";
      return "Brick";
    }
    // growth
    if (totalBricks >= 12000) return "Cosmic Library";
    if (totalBricks >= 6000) return "Library";
    if (totalBricks >= 2500) return "Castle";
    if (totalBricks >= 800) return "Mansion";
    if (totalBricks >= 60) return "House";
    if (totalBricks >= 10) return "House Foundation";
    return "Brick";
  }

  // Returns the next stage threshold for progress display
  function getNextStageInfo(edition, totalBricks, currentStreak) {
    var currentStage = getWorldStage(edition, totalBricks, currentStreak);
    var thresholds;
    if (edition === "healing") {
      thresholds = [
        { name: "House Foundation", bricks: 7, streakBased: true },
        { name: "House", bricks: 30 },
        { name: "Mansion", bricks: 100 },
        { name: "Castle", bricks: 300 },
        { name: "Library", bricks: 700 },
        { name: "Cosmic Library", bricks: 1500 },
      ];
    } else {
      thresholds = [
        { name: "House Foundation", bricks: 10 },
        { name: "House", bricks: 60 },
        { name: "Mansion", bricks: 800 },
        { name: "Castle", bricks: 2500 },
        { name: "Library", bricks: 6000 },
        { name: "Cosmic Library", bricks: 12000 },
      ];
    }
    for (var i = 0; i < thresholds.length; i++) {
      if (totalBricks < thresholds[i].bricks) {
        return {
          currentStage: currentStage,
          nextStage: thresholds[i].name,
          nextAt: thresholds[i].bricks,
          current: totalBricks,
        };
      }
    }
    return {
      currentStage: currentStage,
      nextStage: null,
      nextAt: null,
      current: totalBricks,
    };
  }

  // ── Archive ──
  function getArchive() {
    return lbGet("archive") || [];
  }

  function saveSessionToArchive(record) {
    var archive = getArchive();
    archive.push(record);
    // Cap at 500 entries
    if (archive.length > 500) {
      archive = archive.slice(archive.length - 500);
    }
    lbSet("archive", archive);
  }

  function generateSessionId() {
    return "ses_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  }

  // ── Mark content as seen ──
  function markContentSeen(contentId) {
    var stats = getStats();
    if (stats.seenContentIds.indexOf(contentId) === -1) {
      stats.seenContentIds.push(contentId);
      lbSet("stats", stats);
    }
  }

  function getSeenContentIds() {
    var stats = getStats();
    return stats.seenContentIds || [];
  }

  // ── Utility: hash string (moved from app.js) ──
  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  // ── Utility: format time ──
  function formatTime(seconds) {
    if (seconds < 60) return seconds + "s";
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return s > 0 ? m + "m " + s + "s" : m + "m";
  }

  // ── Public API ──
  window.LB = {
    getStats: getStats,
    updateStats: updateStats,
    getWorldStage: getWorldStage,
    getNextStageInfo: getNextStageInfo,
    getArchive: getArchive,
    saveSessionToArchive: saveSessionToArchive,
    generateSessionId: generateSessionId,
    markContentSeen: markContentSeen,
    getSeenContentIds: getSeenContentIds,
    hashString: hashString,
    formatTime: formatTime,
  };
})(window);
