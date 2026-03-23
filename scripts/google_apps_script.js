/**
 * 레터브릭 Google Apps Script
 * Google Sheets에서 스크립트 편집기(확장 → Apps Script)를 열고 이 코드를 붙여넣으세요.
 *
 * 시트 구조 (자동 생성):
 *   - users: 가입자 목록
 *   - records: 필사 기록
 *   - feedback: 피드백
 *
 * 배포: 배포 → 새 배포 → 웹 앱 → 누구나 접근 가능
 */

// ── POST: 데이터 받기 (기존 기능 유지) ──
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === 'signup') {
      var sheet = getOrCreateSheet(ss, 'users', ['timestamp', 'nickname', 'email', 'joinedAt', 'id']);
      sheet.appendRow([new Date().toISOString(), data.nickname, data.email, data.joinedAt, data.id || '']);
    }
    else if (data.type === 'feedback') {
      var sheet = getOrCreateSheet(ss, 'feedback', ['timestamp', 'nickname', 'email', 'round', 'daysSinceJoin', 'good', 'improve', 'overall', 'stars']);
      sheet.appendRow([new Date().toISOString(), data.nickname, data.email, data.round, data.daysSinceJoin, data.good, data.improve, data.overall, data.stars]);
    }
    else {
      // record (필사 기록)
      var sheet = getOrCreateSheet(ss, 'records', ['timestamp', 'userId', 'nickname', 'email', 'date', 'edition', 'author', 'source', 'structScore', 'creativeScore', 'finalScore', 'creative']);
      sheet.appendRow([
        new Date().toISOString(),
        data.userId || '', data.nickname || '', data.email || '',
        data.date || '', data.edition || 'growth',
        data.author || '', data.source || '',
        data.structScore || 0, data.creativeScore || 0, data.finalScore || 0,
        (data.creative || '').substring(0, 200)
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET: 데이터 읽기 (관리자 페이지용) ──
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = (e.parameter && e.parameter.action) || 'summary';

    if (action === 'summary') {
      // 요약 통계
      var users = getSheetData(ss, 'users');
      var records = getSheetData(ss, 'records');
      var feedback = getSheetData(ss, 'feedback');

      var today = new Date().toISOString().split('T')[0];
      var todayRecords = records.filter(function(r) { return r.date === today; });

      var result = {
        totalUsers: users.length,
        totalRecords: records.length,
        totalFeedback: feedback.length,
        todaySessions: todayRecords.length,
        growthSessions: records.filter(function(r) { return (r.edition || 'growth') === 'growth'; }).length,
        healingSessions: records.filter(function(r) { return r.edition === 'healing'; }).length,
        recentUsers: users.slice(-10).reverse(),
        recentRecords: records.slice(-20).reverse(),
        recentFeedback: feedback.slice(-10).reverse()
      };

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'users') {
      return ContentService.createTextOutput(JSON.stringify(getSheetData(ss, 'users')))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'records') {
      return ContentService.createTextOutput(JSON.stringify(getSheetData(ss, 'records').slice(-100)))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'feedback') {
      return ContentService.createTextOutput(JSON.stringify(getSheetData(ss, 'feedback')))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({error: 'Unknown action'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 유틸리티 ──
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function getSheetData(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}
