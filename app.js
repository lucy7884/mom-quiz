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
// 큰따옴표로 감싼 필드, 줄바꿈 포함 셀 모두 처리
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

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

  // 헤더 제거 후 Question 객체로 변환
  // 컬럼 순서: 사자성어 | 한자 | 이미지URL | 문제 | 정답 | 오답1 | 오답2 | 뜻 | 유래스토리
  return rows.slice(1)
    .filter(r => r[0] && r[0].trim())
    .map((r, idx) => ({
      id: 1000 + idx,
      idiom:    r[0]?.trim() || '',
      chinese:  r[1]?.trim() || '',
      image:    r[2]?.trim() || '',
      question: r[3]?.trim() || '',
      choices:  [r[4]?.trim() || '', r[5]?.trim() || '', r[6]?.trim() || ''],
      answer:   0,  // E열이 항상 정답
      meaning:  r[7]?.trim() || '',
      story:    r[8]?.trim() || ''
    }));
}

// ── LOAD QUESTIONS ─────────────────────────────────────
async function loadQuestions() {
  // 1. config.json 에서 구글 시트 URL 읽기
  try {
    const cfgRes = await fetch('config.json');
    const cfg = await cfgRes.json();

    if (cfg.sheetUrl && cfg.sheetUrl.trim() !== '') {
      const csvRes = await fetch(cfg.sheetUrl.trim());
      const csvText = await csvRes.text();
      const sheetQuestions = parseCSV(csvText);
      if (sheetQuestions.length > 0) {
        allQuestions = sheetQuestions;
        return;
      }
    }
  } catch (e) {
    console.warn('구글 시트 로드 실패, 기본 문제를 사용해요:', e);
  }

  // 2. 폴백: questions.json
  const res = await fetch('questions.json');
  allQuestions = await res.json();
}

// ── SHUFFLE CHOICES ────────────────────────────────────
// 보기 순서를 섞어서 매번 정답 위치가 달라지게 함
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

  let streak = s.streak || 0;
  if (s.lastCompleteDate !== td && s.lastCompleteDate !== yesterday()) streak = 0;
  document.getElementById('streak-count').textContent = streak;

  const count = (s.date === td) ? (s.count || 0) : 0;
  const done  = (s.date === td) && s.done;
  document.getElementById('home-progress-bar').style.width = (count / 10 * 100) + '%';
  document.getElementById('home-progress-count').textContent = count + ' / 10';

  const btn = document.getElementById('start-btn');
  if (done) {
    btn.textContent = '오늘은 모두 풀었어요 ✅';
    btn.disabled = true;
  } else if (count > 0) {
    btn.textContent = '이어서 풀기 →';
    btn.disabled = false;
  } else {
    btn.textContent = '오늘의 퀴즈 시작하기';
    btn.disabled = false;
  }
}

// ── SELECT TODAY'S QUESTIONS ───────────────────────────
function selectQuestions() {
  const s = loadState();
  const td = today();

  // 이어하기: 저장된 오늘 문제가 있으면 복원
  if (s.date === td && s.questionsData && s.count < 10) {
    todayQuestions = s.questionsData;
    currentIndex   = s.count;
    score          = s.score || 0;
    answerLog      = s.answerLog || [];
    return;
  }

  // 새 날: 랜덤 10문제 선택 + 보기 섞기
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  todayQuestions = shuffled.slice(0, 10).map(shuffleChoices);
  currentIndex   = 0;
  score          = 0;
  answerLog      = [];

  saveState({
    ...s,
    date:          td,
    questionsData: todayQuestions,
    count:         0,
    score:         0,
    answerLog:     [],
    done:          false
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
  s.count     = currentIndex + 1;
  s.score     = score;
  s.answerLog = answerLog;
  saveState(s);

  setTimeout(() => showAnswer(correct), 650);
}

// ── ANSWER SCREEN ──────────────────────────────────────
function showAnswer(correct) {
  const q = todayQuestions[currentIndex];

  const banner = document.getElementById('result-banner');
  document.getElementById('result-icon').textContent = correct ? '🎊' : '💪';
  document.getElementById('result-text').textContent = correct ? '정답이에요!' : '아쉽지만 괜찮아요!';
  banner.className = 'result-banner ' + (correct ? 'correct' : 'wrong');

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
  let streak = s.streak || 0;
  if (s.lastCompleteDate === yesterday()) streak += 1;
  else if (s.lastCompleteDate !== td)     streak  = 1;

  s.done = true; s.streak = streak; s.lastCompleteDate = td;
  saveState(s);

  document.getElementById('final-score').textContent  = score;
  document.getElementById('streak-count').textContent = streak;

  const msgs = [
    [10, '완벽해요! 정말 대단하세요! 🏆'],
    [8,  '훌륭해요! 많이 아시네요! 👏'],
    [6,  '잘하셨어요! 내일도 화이팅! 🌸'],
    [4,  '조금씩 늘고 있어요! 계속해요! 💪'],
    [0,  '내일은 더 잘하실 거예요! 🌱']
  ];
  document.getElementById('score-msg').textContent    = msgs.find(([m]) => score >= m)[1];
  document.getElementById('complete-emoji').textContent = score === 10 ? '🏆' : '🎉';

  showScreen('screen-complete');
}

// ── EVENT LISTENERS ────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
  const s = loadState();
  if (s.date === today() && s.done) return;
  selectQuestions();
  showQuiz();
});

document.getElementById('next-btn').addEventListener('click', () => {
  currentIndex++;
  if (currentIndex >= 10) showComplete();
  else showQuiz();
});

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
