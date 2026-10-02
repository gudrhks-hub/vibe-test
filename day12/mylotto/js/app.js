const MAX_FIXED = 5;
const MAX_EXCLUDED = 39;
const SET_COUNT = 5;
const SET_LABELS = ['A', 'B', 'C', 'D', 'E'];
const COPY_LABEL = '<i class="bi bi-copy"></i><span class="btn-text"> 복사</span>';
const COPY_ALL_LABEL = '<i class="bi bi-copy"></i> 전체 복사';
const COPIED_LABEL = '<i class="bi bi-check-lg"></i><span class="btn-text"> 복사됨</span>';

const state = {
  fixed: new Set(),
  excluded: new Set(),
  results: [],
};

let toast;

document.addEventListener('DOMContentLoaded', init);

function init() {
  toast = new bootstrap.Toast(document.getElementById('appToast'), { delay: 2000 });

  renderBoards();

  // 번호판: 이벤트 위임
  document.getElementById('fixedBoard').addEventListener('click', (e) => {
    const btn = e.target.closest('.num-btn');
    if (btn && !btn.disabled) toggleNumber('fixed', Number(btn.dataset.num));
  });
  document.getElementById('excludedBoard').addEventListener('click', (e) => {
    const btn = e.target.closest('.num-btn');
    if (btn && !btn.disabled) toggleNumber('excluded', Number(btn.dataset.num));
  });

  document.getElementById('resetFixed').addEventListener('click', () => resetBoard('fixed'));
  document.getElementById('resetExcluded').addEventListener('click', () => resetBoard('excluded'));
  document.getElementById('generateBtn').addEventListener('click', generateAll);

  // 결과 영역: 이벤트 위임
  document.getElementById('resultList').addEventListener('click', (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    const set = state.results[Number(btn.dataset.index)];
    copyText(formatSet(set), btn, COPY_LABEL);
  });

  document.getElementById('copyAllBtn').addEventListener('click', (e) => {
    const text = state.results
      .map((set, i) => `${SET_LABELS[i]}: ${formatSet(set)}`)
      .join('\n');
    copyText(text, e.currentTarget, COPY_ALL_LABEL);
  });
}

// 번호판 그리기
function renderBoards() {
  renderBoard('fixedBoard', state.fixed, state.excluded, 'is-fixed');
  renderBoard('excludedBoard', state.excluded, state.fixed, 'is-excluded');
  document.getElementById('fixedCount').textContent = state.fixed.size;
  document.getElementById('excludedCount').textContent = state.excluded.size;
}

function renderBoard(boardId, own, other, selectedClass) {
  let html = '';
  for (let n = 1; n <= 45; n++) {
    const selected = own.has(n);
    const blocked = other.has(n);
    html += `<button type="button"
      class="num-btn${selected ? ' ' + selectedClass : ''}"
      data-num="${n}"
      aria-pressed="${selected}"
      ${blocked ? 'disabled title="반대편에서 선택된 번호예요"' : ''}>${n}</button>`;
  }
  document.getElementById(boardId).innerHTML = html;
}

function toggleNumber(type, num) {
  const set = state[type];

  if (set.has(num)) {
    set.delete(num);
  } else {
    if (type === 'fixed' && set.size >= MAX_FIXED) {
      showToast(`고정 번호는 최대 ${MAX_FIXED}개까지 고를 수 있어요`);
      return;
    }
    if (type === 'excluded' && set.size >= MAX_EXCLUDED) {
      showToast(`제외 번호는 최대 ${MAX_EXCLUDED}개까지 고를 수 있어요`);
      return;
    }
    set.add(num);
  }

  renderBoards();
}

function resetBoard(type) {
  state[type].clear();
  renderBoards();
}

// 0 ~ max-1 랜덤 정수
function randomInt(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function generateSet() {
  const pool = [];
  for (let n = 1; n <= 45; n++) {
    if (!state.fixed.has(n) && !state.excluded.has(n)) pool.push(n);
  }

  // Fisher–Yates 셔플
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const need = 6 - state.fixed.size;
  return [...state.fixed, ...pool.slice(0, need)].sort((a, b) => a - b);
}

function generateAll() {
  const poolSize = 45 - state.fixed.size - state.excluded.size;
  if (poolSize < 6 - state.fixed.size) {
    showToast('선택할 수 있는 번호가 부족해요. 제외 번호를 줄여 주세요');
    return;
  }

  state.results = [];
  for (let i = 0; i < SET_COUNT; i++) {
    state.results.push(generateSet());
  }
  renderResults();
}

function renderResults() {
  const type = state.fixed.size > 0 ? '반자동' : '자동';

  document.getElementById('resultList').innerHTML = state.results
    .map((set, i) => {
      const balls = set
        .map((n, j) => `<span class="ball ${getBallClass(n)}${state.fixed.has(n) ? ' is-fixed' : ''}"
          style="animation-delay:${j * 0.04}s">${n}</span>`)
        .join('');
      return `<div class="result-row">
        <span class="set-label">${SET_LABELS[i]}</span>
        ${balls}
        <span class="set-type">${type}</span>
        <button type="button" class="btn btn-outline-secondary btn-sm copy-btn ms-auto"
          data-index="${i}" aria-label="${SET_LABELS[i]} 세트 복사">${COPY_LABEL}</button>
      </div>`;
    })
    .join('');

  document.getElementById('copyAllBtn').classList.remove('d-none');
}

function getBallClass(num) {
  if (num <= 10) return 'ball-yellow';
  if (num <= 20) return 'ball-blue';
  if (num <= 30) return 'ball-red';
  if (num <= 40) return 'ball-gray';
  return 'ball-green';
}

function formatSet(arr) {
  return arr.join(', ');
}

// 클립보드 복사 (clipboard API → execCommand 폴백)
function copyText(text, button, label) {
  const onSuccess = () => {
    button.classList.add('is-copied');
    button.innerHTML = COPIED_LABEL;
    setTimeout(() => {
      button.classList.remove('is-copied');
      button.innerHTML = label;
    }, 1500);
  };

  const fallback = () => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    textarea.remove();
    if (ok) onSuccess();
    else showToast('복사하지 못했어요. 직접 선택해서 복사해 주세요');
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess, fallback);
  } else {
    fallback();
  }
}

function showToast(message) {
  document.getElementById('appToastBody').textContent = message;
  toast.show();
}
