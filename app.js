// ── STATE ──────────────────────────────────────────────
let allQuestions = [];
let todayQuestions = [];
let currentIndex = 0;
let score = 0;
let answerLog = []; // true/false per question

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

// ── HOME ───────────────────────────────────────────────
function renderHome() {
  const s = loadState();
  const td = today();

  // streak: count only if last complete was yesterday or today
  let streak = s.streak || 0;
  if (s.lastCompleteDate !== td && s.lastCompleteDate !== yesterday()) streak = 0;
  document.getElementById('streak-count').textContent = streak;

  // today progress
  const count = (s.date === td) ? (s.count || 0) : 0;
  const done  = (s.date === td) && s.done;
  const pct   = (count / 10) * 100;
  document.getElementById('home-progress-bar').style.width = pct + '%';
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

// ── QUESTION SELECTION ─────────────────────────────────
function selectQuestions() {
  const s = loadState();
  const td = today();

  if (s.date === td && s.questionIds && s.count < 10) {
    // resume
    todayQuestions = s.questionIds.map(id => allQuestions.find(q => q.id === id));
    currentIndex   = s.count;
    score          = s.score || 0;
    answerLog      = s.answerLog || [];
    return;
  }

  // new day — shuffle and pick 10
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  todayQuestions = shuffled.slice(0, 10);
  currentIndex   = 0;
  score          = 0;
  answerLog      = [];

  saveState({
    ...s,
    date:        td,
    questionIds: todayQuestions.map(q => q.id),
    count:       0,
    score:       0,
    answerLog:   [],
    done:        false
  });
}

// ── PROGRESS DOTS ──────────────────────────────────────
function renderDots() {
  const el = document.getElementById('progress-dots');
  el.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    if (i < answerLog.length) {
      d.classList.add(answerLog[i] ? 'correct' : 'wrong');
    } else if (i === currentIndex) {
      d.classList.add('current');
    }
    el.appendChild(d);
  }
}

// ── QUIZ SCREEN ────────────────────────────────────────
function showQuiz() {
  renderDots();
  const q = todayQuestions[currentIndex];
  document.getElementById('quiz-current').textContent = currentIndex + 1;
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
    btn.dataset.idx = i;
    btn.addEventListener('click', () => onAnswer(i));
    choicesEl.appendChild(btn);
  });

  showScreen('screen-quiz');
}

// ── ANSWER HANDLER ─────────────────────────────────────
function onAnswer(chosen) {
  const q = todayQuestions[currentIndex];
  const correct = chosen === q.answer;

  // lock buttons and highlight
  document.querySelectorAll('.choice-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer)             btn.classList.add('correct');
    else if (i === chosen && !correct) btn.classList.add('wrong');
  });

  if (correct) score++;
  answerLog.push(correct);

  // persist progress
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
  const icon   = document.getElementById('result-icon');
  const text   = document.getElementById('result-text');

  if (correct) {
    banner.className   = 'result-banner correct';
    icon.textContent   = '🎊';
    text.textContent   = '정답이에요!';
  } else {
    banner.className   = 'result-banner wrong';
    icon.textContent   = '💪';
    text.textContent   = '아쉽지만 괜찮아요!';
  }

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

  const nextBtn = document.getElementById('next-btn');
  nextBtn.textContent = (currentIndex === 9) ? '결과 보기 🎉' : '다음 문제 →';

  showScreen('screen-answer');
}

// ── COMPLETE SCREEN ────────────────────────────────────
function showComplete() {
  // update streak
  const s  = loadState();
  const td = today();
  let streak = s.streak || 0;
  if (s.lastCompleteDate === yesterday()) streak += 1;
  else if (s.lastCompleteDate !== td)     streak  = 1;

  s.done             = true;
  s.streak           = streak;
  s.lastCompleteDate = td;
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
  const msg = msgs.find(([min]) => score >= min);
  document.getElementById('score-msg').textContent = msg[1];

  // pick a fun emoji based on score
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
  try {
    const res = await fetch('questions.json');
    allQuestions = await res.json();
  } catch (e) {
    console.error('문제를 불러오지 못했어요:', e);
  }
  renderHome();
  showScreen('screen-home');
})();
