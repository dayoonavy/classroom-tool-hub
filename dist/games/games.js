import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.0";
import { supabaseUrl, supabasePublishableKey } from "./supabase-config.js";

const supabase = createClient(supabaseUrl, supabasePublishableKey);
const names = { arithmetic: "숫자 스프린트", sequence: "다음 숫자의 비밀", fraction: "조각의 크기" };
const levels = ["쉬움", "보통", "도전"];
const dialog = document.querySelector("dialog");
const content = document.querySelector("#content");
const status = document.querySelector("#account-status");
const accountForm = document.querySelector("#account-form");
let state;
let session = null;
let focusBefore;
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const usernameEmail = (username) => `${username.trim().toLowerCase()}@students.mathplay.invalid`;

function setAccount(user) {
  session = user ? { user } : null;
  status.textContent = user ? `${user.user_metadata?.username || "학습자"} 계정으로 로그인했어요. 기록은 이 계정에 저장돼요.` : "아이디와 비밀번호로 가입하거나 로그인하세요.";
  document.querySelector("#signout").hidden = !user;
  accountForm.querySelectorAll("input,button[type=submit]").forEach((control) => { control.disabled = Boolean(user); });
  document.querySelectorAll("[data-game]").forEach((button) => { button.disabled = !user; });
  document.querySelector("#records").disabled = !user;
}

supabase.auth.onAuthStateChange((_event, newSession) => setAccount(newSession?.user || null));
supabase.auth.getSession().then(({ data, error }) => {
  if (error) status.textContent = "로그인 상태를 불러오지 못했어요. 새로고침해 주세요.";
  else setAccount(data.session?.user || null);
});

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = event.submitter?.value;
  const username = document.querySelector("#username").value.trim();
  const password = document.querySelector("#password").value;
  if (!/^[A-Za-z0-9._-]{3,20}$/.test(username)) { status.textContent = "아이디는 영문, 숫자, 점, 밑줄, 하이픈을 사용해 3~20자로 만들어 주세요."; return; }
  if (password.length < 8) { status.textContent = "비밀번호는 8자 이상 입력해 주세요."; return; }
  accountForm.querySelectorAll("button[type=submit]").forEach((button) => { button.disabled = true; });
  status.textContent = mode === "signup" ? "계정을 만들고 있어요…" : "로그인하고 있어요…";
  try {
    if (mode === "signup") {
      const { error } = await supabase.functions.invoke("register-learner", {
        body: { username: username.toLowerCase(), password },
      });
      if (error) throw error;
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
      if (loginError) throw loginError;
      status.textContent = "가입했어요. 이제 수학 게임을 시작할 수 있어요.";
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
      if (error) throw error;
    }
  } catch (error) {
    console.error(error);
    status.textContent = /already|registered|409/i.test(error?.message || "") ? "이미 사용 중인 아이디예요. 로그인해 보세요." : /invalid login credentials/i.test(error?.message || "") ? "아이디나 비밀번호를 확인해 주세요." : "요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  } finally {
    if (!session) accountForm.querySelectorAll("button[type=submit]").forEach((button) => { button.disabled = false; });
  }
});

document.querySelector("#signout").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) status.textContent = "로그아웃하지 못했어요. 다시 시도해 주세요.";
});

function open() { focusBefore = document.activeElement; if (!dialog.open) dialog.showModal(); }
function close() { dialog.close(); state = null; focusBefore?.focus(); }
document.querySelector("#close").onclick = close;
dialog.oncancel = (event) => { event.preventDefault(); close(); };

document.querySelectorAll("[data-game]").forEach((button) => button.addEventListener("click", () => {
  if (!session) { status.textContent = "게임 기록을 저장하려면 먼저 로그인해 주세요."; document.querySelector("#username").focus(); return; }
  setup(button.dataset.game);
}));

function setup(game) {
  state = { game, index: 0, score: 0, level: 0 };
  content.innerHTML = `<h2 id="title">${names[game]}</h2><p>10문제를 나만의 속도로 풀어보세요.</p><label>난이도<select id="level">${levels.map((name, index) => `<option value="${index}">${name}</option>`).join("")}</select></label><button id="start" class="wide">플레이 시작</button>`;
  open();
  content.querySelector("#start").onclick = () => { state.level = Number(content.querySelector("#level").value); state.start = Date.now(); question(); };
}

function generate() {
  const level = state.level;
  if (state.game === "arithmetic") {
    let a = rand(1, [10, 30, 99][level]); let b = rand(1, [10, 30, 99][level]); const op = rand(0, level ? 2 : 1);
    if (op === 1 && a < b) [a, b] = [b, a];
    if (op === 2) { a = rand(2, level === 2 ? 19 : 9); b = rand(2, 9); }
    const answer = op === 0 ? a + b : op === 1 ? a - b : a * b; const text = `${a} ${["+", "−", "×"][op]} ${b}`;
    return { text: `${text} = ?`, answer, explanation: `${text} = ${answer}` };
  }
  if (state.game === "sequence") {
    const first = rand(1, 20); const difference = rand(2, [5, 12, 20][level]); const growing = level === 2 && rand(0, 1);
    const values = Array.from({ length: 5 }, (_, index) => first + difference * index + (growing ? index * (index - 1) / 2 : 0));
    return { text: `${values.slice(0, 4).join(" · ")} · ?`, answer: values[4], explanation: growing ? `더하는 수가 ${difference}, ${difference + 1}, ${difference + 2}, ${difference + 3}으로 늘어나요. 정답은 ${values[4]}입니다.` : `${difference}씩 더해요. 정답은 ${values[4]}입니다.` };
  }
  const da = rand(2, [5, 9, 15][level]); const db = rand(2, [5, 9, 15][level]); const na = rand(1, da - 1); const nb = rand(1, db - 1);
  return { text: `${na}/${da} vs ${nb}/${db}`, answer: na * db === nb * da ? "equal" : na * db > nb * da ? "left" : "right", explanation: `공통 분모 ${da * db}로 바꾸면 ${na * db}/${da * db}와 ${nb * da}/${da * db}입니다.`, choices: [`${na}/${da}`, "같아요", `${nb}/${db}`] };
}

function question() {
  state.locked = false; state.q = generate(); const q = state.q;
  content.innerHTML = `<h2 id="title">${names[state.game]}</h2><p>${levels[state.level]} · ${state.index + 1} / 10</p><p>${q.choices ? "더 큰 분수를 고르세요." : "빈칸에 들어갈 숫자를 입력하세요."}</p><div class="question">${q.text}</div>${q.choices ? `<div class="choices">${q.choices.map((choice, index) => `<button data-answer="${["left", "equal", "right"][index]}">${choice}</button>`).join("")}</div>` : "<form><input type=\"number\" required step=\"1\" aria-label=\"정답\" placeholder=\"정답 입력\"><button class=\"wide\">정답 확인</button></form>"}<p id="feedback" aria-live="polite"></p><button id="next" class="wide" hidden>${state.index === 9 ? "결과 보기" : "다음 문제"}</button>`;
  if (q.choices) content.querySelectorAll("[data-answer]").forEach((button) => { button.onclick = () => answer(button.dataset.answer); });
  else { content.querySelector("form").onsubmit = (event) => { event.preventDefault(); answer(Number(content.querySelector("input").value)); }; content.querySelector("input").focus(); }
  content.querySelector("#next").onclick = () => { state.index += 1; state.index === 10 ? finish() : question(); };
}

function answer(value) {
  if (state.locked) return;
  state.locked = true; const correct = value === state.q.answer; if (correct) state.score += 1;
  content.querySelector("#feedback").textContent = `${correct ? "정답이에요! " : "아쉬워요. "}${state.q.explanation}`;
  content.querySelectorAll("input, form button, [data-answer]").forEach((control) => { control.disabled = true; });
  const next = content.querySelector("#next"); next.hidden = false; next.focus();
}

async function finish() {
  const game = state.game; const result = { game, level: state.level, score: state.score, seconds: Math.floor((Date.now() - state.start) / 1000) };
  content.innerHTML = `<h2 id="title">한 걸음 더 나아갔어요.</h2><div class="score">${result.score} / 10</div><p id="save-result" role="status">학습 기록을 저장하고 있어요…</p>`;
  try {
    if (!session) throw new Error("로그인 상태가 풀렸어요.");
    const { error } = await supabase.from("game_records").insert({ user_id: session.user.id, game_key: result.game, difficulty: result.level, score: result.score, elapsed_seconds: result.seconds });
    if (error) throw error;
    content.querySelector("#save-result").textContent = "학습 기록을 계정에 저장했어요.";
  } catch (error) {
    console.error(error); content.querySelector("#save-result").textContent = "기록을 저장하지 못했어요. 인터넷 연결을 확인한 뒤 담당 교사에게 알려 주세요.";
  }
  content.insertAdjacentHTML("beforeend", '<button id="again" class="wide">한 번 더 플레이</button>');
  content.querySelector("#again").onclick = () => setup(game);
}

document.querySelector("#records").addEventListener("click", async () => {
  if (!session) { status.textContent = "내 기록을 보려면 로그인해 주세요."; return; }
  content.innerHTML = '<h2 id="title">나의 작은 발자국</h2><p>기록을 불러오고 있어요…</p>'; open();
  try {
    const { data, error } = await supabase.from("game_records").select("game_key,difficulty,score,played_at").order("played_at", { ascending: false }).limit(30);
    if (error) throw error;
    content.innerHTML = '<h2 id="title">나의 작은 발자국</h2>';
    if (!data.length) content.insertAdjacentHTML("beforeend", "<p>아직 기록이 없어요. 첫 게임을 시작해 보세요.</p>");
    data.forEach((record) => { const row = document.createElement("p"); row.className = "record"; row.textContent = `${names[record.game_key]} · ${levels[record.difficulty]} · ${record.score} / 10 · ${new Date(record.played_at).toLocaleDateString("ko-KR")}`; content.append(row); });
  } catch (error) {
    console.error(error); content.innerHTML = '<h2 id="title">나의 작은 발자국</h2><p>기록을 불러오지 못했어요. 다시 로그인해 주세요.</p>';
  }
});
