#!/usr/bin/env node

const fs = require('node:fs');

async function main() {
  const resultPath = process.env.DATA_QUALITY_RESULT_PATH || 'data-quality-result.json';
  const result = readResult(resultPath);
  const summary = buildSummary(result);
  writeGithubSummary(summary);

  if (!process.env.DATA_QUALITY_SLACK_WEBHOOK_URL) {
    console.log('[data-quality-notify] DATA_QUALITY_SLACK_WEBHOOK_URL is not set. Slack notification skipped.');
    return;
  }

  await sendSlack(result);
  console.log('[data-quality-notify] Slack notification sent.');
}

function readResult(resultPath) {
  if (!fs.existsSync(resultPath)) {
    return {
      status: 'missing-result',
      issueCounts: { error: 1, warn: 0, info: 0 },
      issues: [{ severity: 'error', code: 'missing-result', where: resultPath, message: 'Data quality result file was not created.' }]
    };
  }
  return JSON.parse(fs.readFileSync(resultPath, 'utf8'));
}

function buildSummary(result) {
  const counts = result.issueCounts || {};
  const lines = [
    '## LetterBrick Data Quality',
    '',
    `- Status: ${result.status || 'unknown'}`,
    `- Errors: ${counts.error || 0}`,
    `- Warnings: ${counts.warn || 0}`,
    `- Firestore checked: ${result.firestore && result.firestore.checked ? 'true' : 'false'}`
  ];

  if (result.firestore && result.firestore.checked) {
    lines.push(`- Firestore sampled: ${result.firestore.sampledEntries}`);
    lines.push(`- Recent 7-day records: ${result.firestore.recent7DayCount}`);
    lines.push(`- Malformed records: ${result.firestore.malformedCount}`);
    lines.push(`- Duplicate keys: ${result.firestore.duplicateKeyCount}`);
  }

  if (result.githubRunUrl) lines.push(`- GitHub run: ${result.githubRunUrl}`);
  if (result.issues && result.issues.length) {
    lines.push('', '### Issues');
    result.issues.slice(0, 20).forEach(issue => {
      lines.push(`- [${String(issue.severity || '').toUpperCase()}] ${issue.code} @ ${issue.where}: ${issue.message}`);
    });
  }

  return `${lines.join('\n')}\n`;
}

function writeGithubSummary(summary) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    console.log(summary);
    return;
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}

async function sendSlack(result) {
  const counts = result.issueCounts || {};
  const status = result.status || 'unknown';
  const indicator = status === 'ok' ? ':white_check_mark:' : status === 'warn' ? ':warning:' : ':rotating_light:';
  const fields = [
    field('Status', status),
    field('Errors', String(counts.error || 0)),
    field('Warnings', String(counts.warn || 0)),
    field('Firestore', result.firestore && result.firestore.checked ? `${result.firestore.sampledEntries} sampled` : 'not checked')
  ];

  if (result.githubRunUrl) fields.push(field('GitHub run', `<${result.githubRunUrl}|Open run>`));
  if (result.issues && result.issues.length) {
    fields.push(field('Top issue', truncate(`${result.issues[0].code}: ${result.issues[0].message}`, 500)));
  }

  const response = await fetch(process.env.DATA_QUALITY_SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: `LetterBrick data quality ${status}: ${counts.error || 0} errors, ${counts.warn || 0} warnings`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `${indicator} LetterBrick data quality ${status}`, emoji: true } },
        { type: 'section', fields }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: HTTP ${response.status} ${await response.text()}`);
  }
}

function field(label, value) {
  return { type: 'mrkdwn', text: `*${label}:*\n${value}` };
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

main().catch(err => {
  console.error('[data-quality-notify] failed:', err && err.message ? err.message : err);
  process.exit(1);
});
