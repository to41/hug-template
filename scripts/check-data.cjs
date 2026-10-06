'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const templates = read('templates.json');
const original = read('original-templates.json');
const { additions, metadata } = read('additions.json');
const tabs = new Set(['child','visit','transition','sharing','family','special']);
const rules = new Map(additions.map(rule => [rule.id, rule]));
assert.equal(original.length, 24);
assert.equal(new Set(templates.map(item => item.id)).size, templates.length);
assert.equal(rules.size, additions.length);
assert.equal(additions.length, 16);
assert.equal(metadata.reviewedAt, '2026-10-06');
assert.equal(metadata.effectiveFrom, null, 'Do not invent a common legal effective date');
assert.match(metadata.sourceUrl, /^https:\/\/www\.cfa\.go\.jp\//);
for (const rule of additions) {
  assert.ok(rule.checks.length && rule.records.length && rule.sourcePages.length, rule.id);
  assert.ok(rule.sourcePages.every(page => Number.isInteger(page) && page > 0 && page <= 116));
}
for (const item of templates) {
  assert.ok(item.tabs.length && item.tabs.every(tab => tabs.has(tab)), item.id);
  assert.ok(item.services.length && item.services.every(service => ['child','visit'].includes(service)), item.id);
  assert.ok(item.text.trim() && item.label.trim(), item.id);
  if (item.additionId) {
    const rule = rules.get(item.additionId);
    assert.ok(rule, item.id);
    assert.ok(item.services.every(service => rule.services.includes(service)), item.id);
  }
}
for (const item of original.filter(item => item.kind === 'general')) {
  const active = templates.find(active => active.id === item.id);
  assert.ok(active, 'Missing original: '+item.id);
  assert.equal(active.text, item.text, 'Original wording changed: '+item.id);
  assert.equal(active.label, item.label);
}
assert.ok(!templates.some(item => item.services.includes('visit') && /専門的支援(実施|体制)加算/.test(item.label)));
assert.ok(!templates.some(item => item.services.includes('visit') && item.additionId === 'child-parenting-support'));
assert.ok(!templates.some(item => item.services.includes('child') && item.additionId?.startsWith('visit-')));
for (const n of ['1','2','3','4']) assert.ok(rules.has('child-agency-'+n));
for (const service of ['child','visit']) for (const n of ['1','2']) assert.ok(rules.has(service+'-family-'+n));
const legacy = fs.readFileSync(path.join(root, 'legacy/index.html'));
const blobHash = crypto.createHash('sha1').update(Buffer.from('blob '+legacy.length+'\0')).update(legacy).digest('hex');
assert.equal(blobHash, '49b01dac768e2fc52942ca78fc78fc350236b961', 'Legacy must exactly match the original GitHub blob');
new vm.Script(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
console.log('Data checks passed: 36 active templates, 16 additions, 24 archived originals; legacy blob matches main.');
