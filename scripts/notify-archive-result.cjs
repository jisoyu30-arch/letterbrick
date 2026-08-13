#!/usr/bin/env node

const fs = require('node:fs');

async function main() {
  const resultPath = process.env.ARCHIVE_RESULT_PATH || 'archive-result.json';
  const result = readResult(resultPath);
  const summary = buildSummary(result);

  writeGithubSummary(summary);

  if (!process.env.ARCHIVE_SLACK_WEBHOOK_URL) {
    console.log('[archive-notify] ARCHIVE_SLACK_WEBHOOK_URL is not set. Slack notification skipped.');
    return;
  }

  await sendSlackNotification(result);
  console.log('[archive-notify] Slack notification sent.');
}

function readResult(resultPath) {
  if (!fs.existsSync(resultPath)) {
    return {
      status: 'missing-result',
      month: '',
      error: `Archive result file not found: ${resultPath}`,
      githubRunUrl: getGithubRunUrl()
    };
  }

  return JSON.parse(fs.readFileSync(resultPath, 'utf8'));
}

function buildSummary(result) {
  const lines = [
    '## LetterBrick Monthly Archive',
    '',
    `- Status: ${result.status || 'unknown'}`,
    `- Month: ${result.month || '(unknown)'}`,
    `- Records: ${result.recordsCount ?? '-'}`,
    `- Sogam: ${result.sogamCount ?? '-'}`,
    `- Upload: ${result.uploadStatus || '-'}`,
    `- Dry run: ${result.dryRun ? 'true' : 'false'}`
  ];

  if (result.archiveDocPath) lines.push(`- Archive doc: \`${result.archiveDocPath}\``);
  if (result.runDocPath) lines.push(`- Run doc: \`${result.runDocPath}\``);
  if (result.githubRunUrl) lines.push(`- GitHub run: ${result.githubRunUrl}`);
  if (process.env.ARCHIVE_ADMIN_URL) lines.push(`- Admin: ${process.env.ARCHIVE_ADMIN_URL}`);
  if (result.error) lines.push('', `Error: \`${truncate(result.error, 500)}\``);

  return `${lines.join('\n')}\n`;
}

function writeGithubSummary(summary) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    console.log(summary);
    return;
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}

async function sendSlackNotification(result) {
  const status = result.status || 'unknown';
  const isSuccess = status === 'success' || status === 'dry-run';
  const isPartial = status === 'partial';
  const indicator = isSuccess ? ':white_check_mark:' : isPartial ? ':warning:' : ':rotating_light:';
  const title = `${indicator} LetterBrick archive ${status}`;
  const fields = [
    mrkdwnField('Month', result.month || '(unknown)'),
    mrkdwnField('Records', String(result.recordsCount ?? '-')),
    mrkdwnField('Sogam', String(result.sogamCount ?? '-')),
    mrkdwnField('Upload', result.uploadStatus || '-'),
    mrkdwnField('Dry run', result.dryRun ? 'true' : 'false')
  ];

  if (result.githubRunUrl) fields.push(mrkdwnField('GitHub run', `<${result.githubRunUrl}|Open run>`));
  if (process.env.ARCHIVE_ADMIN_URL) fields.push(mrkdwnField('Admin', `<${process.env.ARCHIVE_ADMIN_URL}|Open admin>`));
  if (result.error) fields.push(mrkdwnField('Error', truncate(result.error, 700)));

  const response = await fetch(process.env.ARCHIVE_SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: `LetterBrick archive ${status}: ${result.month || '(unknown)'}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: title, emoji: true }
        },
        {
          type: 'section',
          fields
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: HTTP ${response.status} ${await response.text()}`);
  }
}

function mrkdwnField(label, value) {
  return {
    type: 'mrkdwn',
    text: `*${label}:*\n${value}`
  };
}

function truncate(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function getGithubRunUrl() {
  if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) {
    return '';
  }
  return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

main().catch(err => {
  console.error('[archive-notify] failed:', err && err.message ? err.message : err);
  process.exit(1);
});
