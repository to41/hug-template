'use strict';

const state = { service: 'child', tab: 'child', query: '', templates: [], additions: new Map(), metadata: null };
const tabLabels = { child: '備考（児発）', visit: '備考（訪問）', transition: '移行支援', sharing: '学校・療育共有', family: '家族支援', special: '特記事項' };
let notificationTimer;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalize(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim(); }

function visibleTemplates() {
  const terms = normalize(state.query).split(/\s+/).filter(Boolean);
  return state.templates.filter(item => {
    if (!item.services.includes(state.service) || !item.tabs.includes(state.tab)) return false;
    const rule = state.additions.get(item.additionId);
    const searchable = normalize([item.label, item.text, item.pattern, item.cat, rule?.label, rule?.summary, ...(rule?.checks || [])].join(' '));
    return terms.every(term => searchable.includes(term));
  });
}

function ruleDetails(rule) {
  const details = element('details', 'rule-details');
  details.append(element('summary', '', '算定前の確認事項・根拠'));
  for (const [label, values] of [['確認すること', rule.checks], ['別途残す記録', rule.records]]) {
    if (!values?.length) continue;
    details.append(element('h4', '', label));
    const list = element('ul');
    values.forEach(value => list.append(element('li', '', value)));
    details.append(list);
  }
  const source = element('p', 'rule-source');
  const link = element('a', '', `根拠：留意事項通知 p.${rule.sourcePages.join('・')} ↗`);
  link.href = state.metadata.sourceUrl + '#page=' + rule.sourcePages[0];
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  source.append(link, element('span', 'rule-dates', `資料改正：${state.metadata.sourceRevisedAt} ／ 確認：${state.metadata.reviewedAt}`));
  details.append(source);
  return details;
}

function renderContent() {
  const container = document.getElementById('content-container');
  const items = visibleTemplates();
  container.replaceChildren();
  container.setAttribute('aria-busy', 'false');
  document.getElementById('sectionTitle').textContent = tabLabels[state.tab];
  document.getElementById('resultCount').textContent = `${items.length}件`;
  document.querySelectorAll('[data-tab]').forEach(button => {
    const tab = button.dataset.tab;
    button.hidden = (tab === 'child' && state.service !== 'child') || (tab === 'visit' && state.service !== 'visit');
    button.setAttribute('aria-pressed', String(tab === state.tab));
  });
  if (!items.length) {
    container.append(element('p', 'empty-state', '条件に合う文例が見つかりませんでした。検索語を変更してください。'));
    return;
  }
  for (const item of items) {
    const rule = state.additions.get(item.additionId);
    const card = element('article', 'card');
    card.dataset.templateId = item.id;
    const tags = element('div', 'card-tags');
    tags.append(element('span', `tag ${rule ? 'addition' : 'general'}`, rule ? '加算関連' : '一般支援文'));
    tags.append(element('span', 'tag', item.pattern));
    card.append(tags, element('h3', '', item.label));
    if (rule) card.append(element('p', 'card-summary', rule.summary));
    card.append(element('p', 'plan-text', item.text));
    const addButton = element('button', 'add-button', '＋ 文章を追加');
    addButton.type = 'button';
    addButton.setAttribute('aria-label', `${item.label}の文章を追加`);
    addButton.addEventListener('click', () => addToEditor(item.text));
    card.append(addButton);
    if (rule) card.append(ruleDetails(rule));
    container.append(card);
  }
}

function updateCharCount() {
  document.getElementById('charCount').textContent = `${Array.from(document.getElementById('custom-text').value).length}字`;
}

function addToEditor(text) {
  const editor = document.getElementById('custom-text');
  editor.value = editor.value.trim() ? editor.value + '\n' + text : text;
  editor.scrollTop = editor.scrollHeight;
  updateCharCount();
  showNotification('ワークエリアに追加しました');
}

function showNotification(message, error = false) {
  const node = document.getElementById('notification');
  clearTimeout(notificationTimer);
  node.textContent = message;
  node.classList.toggle('error', error);
  node.hidden = false;
  notificationTimer = setTimeout(() => { node.hidden = true; }, 3000);
}

async function copyCustom() {
  const editor = document.getElementById('custom-text');
  const text = editor.value;
  if (!text.trim()) { showNotification('文章を追加してからコピーしてください'); return; }
  let copied = false;
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); copied = true; } catch { /* Try the selection fallback. */ }
  }
  if (!copied) {
    const focused = document.activeElement;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const scrollTop = editor.scrollTop;
    editor.focus({ preventScroll: true });
    editor.select();
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    if (copied) {
      editor.setSelectionRange(start, end);
      editor.scrollTop = scrollTop;
      focused?.focus({ preventScroll: true });
    }
  }
  showNotification(copied ? 'クリップボードにコピーしました' : 'コピーできませんでした。文章を選択して手動でコピーしてください。', !copied);
}

function bindControls() {
  document.querySelectorAll('input[name="service"]').forEach(input => input.addEventListener('change', () => {
    state.service = input.value;
    if (state.tab === 'child' || state.tab === 'visit') state.tab = state.service;
    renderContent();
  }));
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; renderContent(); }));
  document.getElementById('searchInput').addEventListener('input', event => { state.query = event.target.value; renderContent(); });
  document.getElementById('custom-text').addEventListener('input', updateCharCount);
  document.getElementById('copyButton').addEventListener('click', copyCustom);
  document.getElementById('clearButton').addEventListener('click', () => {
    const editor = document.getElementById('custom-text');
    if (editor.value && confirm('ワークエリアをクリアしますか？')) { editor.value = ''; updateCharCount(); }
  });
}

async function loadData(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
  return response.json();
}

async function init() {
  bindControls();
  try {
    const [templates, data] = await Promise.all([loadData('data/templates.json'), loadData('data/additions.json')]);
    state.templates = templates;
    state.metadata = data.metadata;
    state.additions = new Map(data.additions.map(rule => [rule.id, rule]));
    for (const item of templates) {
      if (item.additionId && (!state.additions.has(item.additionId) || !item.services.every(service => state.additions.get(item.additionId).services.includes(service)))) throw new Error(`Invalid addition reference: ${item.id}`);
    }
    document.getElementById('versionInfo').textContent = `制度基準日・確認日：${data.metadata.reviewedAt} ／ 事業所の届出・指定権者の取扱いは別途確認`;
    renderContent();
  } catch (error) {
    const container = document.getElementById('content-container');
    container.setAttribute('aria-busy', 'false');
    container.replaceChildren(element('p', 'empty-state', '文例を読み込めませんでした。ページを再読み込みするか、旧版をご利用ください。'));
    document.getElementById('versionInfo').textContent = '制度情報を読み込めませんでした。';
    console.error(error);
  }
}

init();
