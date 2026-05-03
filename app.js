// ── STATE ──────────────────────────────────────────────
let allQuestions = [];
let todayQuestions = [];
let currentIndex = 0;
let score = 0;
let answerLog = [];

// ── SCREENS ────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── DATE HELPERS ───────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}
function yesterday() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

// ── STORAGE ────────────────────────────────────────────
function loadState() {
  return JSON.parse(localStorage.getItem('sajaState') || '{}');
}
function saveState(s) {
  localStorage.setItem('sajaState', JSON.stringify(s));
}

// ── CSV PARSER ─────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      row.push(field); field = '';
    } else if (c === '\r' && !inQuotes) {
      // skip
    } else if (c === '\n' && !inQuotes) {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  // 헤더 제거 / 컬럼: 사자성어 | 한자 | 이미지URL | 문제 | 정답 | 오답1 | 오답2 | 뜻 | 유래스토리
  return rows.slice(1)
    .filter(r => r[0] && r[0].trim())
    .map((r, idx) => ({
      id:       1000 + idx,
      idiom:    r[0]?.trim() || '',
      chinese:  r[1]?.trim() || '',
      image:    r[2]?.trim() || '',
      question: r[3]?.trim() || '',
      choices:  [r[4]?.trim() || '', r[5]?.trim() || '', r[6]?.trim() || ''],
      answer:   0,
      meaning:  r[7]?.trim() || '',
      story:    r[8]?.trim() || ''
    }));
}

// ── LOAD QUESTIONS ─────────────────────────────────────
async function loadQuestions() {
  try {
    const cfgRes = await fetch('config.json');
    const cfg = await cfgRes.json();
    if (cfg.sheetUrl && cfg.sheetUrl.trim()) {
      const csvRes = await fetch(cfg.sheetUrl.trim());
      const csvText = await csvRes.text();
      const sheetQs = parseCSV(csvText);
      if (sheetQs.length > 0) { allQuestions = sheetQs; return; }
    }
  } catch (e) {
    console.warn('구글 시트 로드 실패, 기본 문제를 사용해요:', e);
  }
  const res = await fetch('questions.json');
  allQuestions = await res.json();
}

// ── SHUFFLE CHOICES ────────────────────────────────────
function shuffleChoices(q) {
  const order = [0, 1, 2].sort(() => Math.random() - 0.5);
  const correctText = q.choices[q.answer];
  const newChoices = order.map(i => q.choices[i]);
  return { ...q, choices: newChoices, answer: newChoices.indexOf(correctText) };
}

// ── HOME ───────────────────────────────────────────────
function renderHome() {
  const s = loadState();
  const td = today();

  // 스트릭: 어제 또는 오늘 완료한 경우에만 유지
  let streak = s.streak || 0;
  if (s.lastCompleteDate !== td && s.lastCompleteDate !== yesterday()) streak = 0;
  document.getElementById('streak-count').textContent = streak;

  const isToday = s.date === td;
  const totalToday = isToday ? (s.totalToday || 0) : 0;
  const roundNum   = isToday ? (s.roundNum   || 0) : 0;

  document.getElementById('home-progress-count').textContent = totalToday + '문제';

  const roundEl = document.getElementById('home-round-info');
  if (roundNum > 0) {
    roundEl.textContent = roundNum + '라운드 완료 🎯';
  } else {
    roundEl.textContent = '오늘 처음 도전해봐요!';
  }

  const btn = document.getElementById('start-btn');
  btn.disabled = false;
  btn.textContent = totalToday > 0 ? '계속 풀기 →' : '오늘의 퀴즈 시작하기';
}

// ── SELECT QUESTIONS (무한 출제, 중복 최소화) ───────────
function selectQuestions() {
  const s = loadState();
  const td = today();

  // 이어하기: 현재 라운드가 진행 중이면 복원
  if (s.date === td && s.questionsData && (s.roundIndex || 0) < 10) {
    todayQuestions = s.questionsData;
    currentIndex   = s.roundIndex || 0;
    score          = s.roundScore  || 0;
    answerLog      = s.answerLog   || [];
    return;
  }

  // 새 라운드: 아직 안 본 문제 먼저 선택
  const isToday  = s.date === td;
  let seenIds    = new Set(isToday ? (s.seenIds || []) : []);

  let pool = allQuestions.filter(q => !seenIds.has(q.id));
  if (pool.length < 10) {
    // 모두 봤으면 초기화하고 전체에서 다시
    seenIds = new Set();
    pool = [...allQuestions];
  }

  const picked = pool.sort(() => Math.random() - 0.5).slice(0, 10);
  todayQuestions = picked.map(shuffleChoices);
  picked.forEach(q => seenIds.add(q.id));

  currentIndex = 0;
  score        = 0;
  answerLog    = [];

  saveState({
    date:          td,
    questionsData: todayQuestions,
    roundIndex:    0,
    roundScore:    0,
    answerLog:     [],
    seenIds:       [...seenIds],
    totalToday:    isToday ? (s.totalToday || 0) : 0,
    roundNum:      isToday ? (s.roundNum   || 0) : 0,
    streak:        s.streak,
    lastCompleteDate: s.lastCompleteDate
  });
}

// ── PROGRESS DOTS ──────────────────────────────────────
function renderDots() {
  const el = document.getElementById('progress-dots');
  el.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    if (i < answerLog.length)    d.classList.add(answerLog[i] ? 'correct' : 'wrong');
    else if (i === currentIndex) d.classList.add('current');
    el.appendChild(d);
  }
}

// ── QUIZ SCREEN ────────────────────────────────────────
function showQuiz() {
  renderDots();
  const q = todayQuestions[currentIndex];
  document.getElementById('quiz-current').textContent  = currentIndex + 1;
  document.getElementById('quiz-idiom').textContent    = q.idiom;
  document.getElementById('quiz-chinese').textContent  = q.chinese;
  document.getElementById('quiz-question').textContent = q.question;

  const imgBox = document.getElementById('quiz-img-box');
  const img    = document.getElementById('quiz-image');
  if (q.image) {
    imgBox.style.display = '';
    img.src = q.image;
    img.alt = q.idiom;
  } else {
    imgBox.style.display = 'none';
  }

  const labels = ['①', '②', '③'];
  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  q.choices.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = labels[i] + '  ' + text;
    btn.addEventListener('click', () => onAnswer(i));
    choicesEl.appendChild(btn);
  });

  showScreen('screen-quiz');
}

// ── ANSWER HANDLER ─────────────────────────────────────
function onAnswer(chosen) {
  const q = todayQuestions[currentIndex];
  const correct = chosen === q.answer;

  document.querySelectorAll('.choice-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer)                btn.classList.add('correct');
    else if (i === chosen && !correct) btn.classList.add('wrong');
  });

  if (correct) score++;
  answerLog.push(correct);

  const s = loadState();
  s.roundIndex = currentIndex + 1;
  s.roundScore = score;
  s.answerLog  = answerLog;
  saveState(s);

  setTimeout(() => showAnswer(correct), 650);
}

// ── ANSWER SCREEN ──────────────────────────────────────
function showAnswer(correct) {
  const q = todayQuestions[currentIndex];

  document.getElementById('result-icon').textContent = correct ? '🎊' : '💪';
  document.getElementById('result-text').textContent = correct ? '정답이에요!' : '아쉽지만 괜찮아요!';
  document.getElementById('result-banner').className = 'result-banner ' + (correct ? 'correct' : 'wrong');

  const imgBox = document.getElementById('answer-img-box');
  const img    = document.getElementById('answer-image');
  if (q.image) {
    imgBox.style.display = '';
    img.src = q.image;
    img.alt = q.idiom;
  } else {
    imgBox.style.display = 'none';
  }

  document.getElementById('answer-idiom').textContent   = q.idiom + '  ' + q.chinese;
  document.getElementById('answer-meaning').textContent = '💡 ' + q.meaning;
  document.getElementById('answer-story').textContent   = q.story;
  document.getElementById('next-btn').textContent = (currentIndex === 9) ? '결과 보기 🎉' : '다음 문제 →';

  showScreen('screen-answer');
}

// ── COMPLETE SCREEN ────────────────────────────────────
function showComplete() {
  const s  = loadState();
  const td = today();

  // 스트릭 업데이트
  let streak = s.streak || 0;
  if (s.lastCompleteDate === yesterday()) streak += 1;
  else if (s.lastCompleteDate !== td)     streak  = 1;

  const totalToday = (s.totalToday || 0) + 10;
  const roundNum   = (s.roundNum   || 0) + 1;

  // 라운드 완료 상태 저장 (questionsData 비워서 다음엔 새 라운드로)
  saveState({
    ...s,
    roundIndex:      10,
    questionsData:   null,
    totalToday,
    roundNum,
    streak,
    lastCompleteDate: td
  });

  document.getElementById('final-score').textContent   = score;
  document.getElementById('streak-count').textContent  = streak;
  document.getElementById('complete-emoji').textContent = score === 10 ? '🏆' : '🎉';

  const msgs = [
    [10, '완벽해요! 정말 대단하세요! 🏆'],
    [8,  '훌륭해요! 많이 아시네요! 👏'],
    [6,  '잘하셨어요! 오늘 ' + roundNum + '라운드 완료! 🌸'],
    [4,  '조금씩 늘고 있어요! 계속해요! 💪'],
    [0,  '내일은 더 잘하실 거예요! 🌱']
  ];
  document.getElementById('score-msg').textContent = msgs.find(([m]) => score >= m)[1];

  showScreen('screen-complete');
}

// ── EVENT LISTENERS ────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
  selectQuestions();
  showQuiz();
});

document.getElementById('next-btn').addEventListener('click', () => {
  currentIndex++;
  if (currentIndex >= 10) showComplete();
  else showQuiz();
});

// 계속 풀기: 새 라운드 바로 시작
document.getElementById('continue-btn').addEventListener('click', () => {
  selectQuestions();
  showQuiz();
});

// 홈으로
document.getElementById('home-btn').addEventListener('click', () => {
  renderHome();
  showScreen('screen-home');
});

// ── BOOT ───────────────────────────────────────────────
(async function init() {
  await loadQuestions();
  renderHome();
  showScreen('screen-home');
})();
