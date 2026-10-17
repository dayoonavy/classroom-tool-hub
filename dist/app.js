const questionCount = 10;
const dialog = document.querySelector("#practice-dialog");
const content = document.querySelector("#practice-content");
const pdfDialog = document.querySelector("#pdf-dialog");
let session = null;
let returnFocus = null;
let pdfLibraryPromise = null;
let pdfTaskId = 0;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function makeMultiplication() {
  const left = randomInt(2, 9);
  const right = randomInt(2, 9);
  return {
    kind: "multiply",
    prompt: `${left} × ${right}`,
    answer: left * right,
    explanation: `${left} × ${right} = ${left * right}`,
  };
}

function makeDivision() {
  const divisor = randomInt(2, 9);
  const quotient = randomInt(Math.ceil(10 / divisor), 9);
  const remainder = randomInt(0, divisor - 1);
  const dividend = divisor * quotient + remainder;
  return {
    kind: "divide",
    prompt: `${dividend} ÷ ${divisor}`,
    divisor,
    answer: { quotient, remainder },
    explanation: `${dividend} ÷ ${divisor} = 몫 ${quotient}, 나머지 ${remainder}`,
  };
}

function makeRound() {
  const questions = Array.from({ length: questionCount / 2 }, makeMultiplication)
    .concat(Array.from({ length: questionCount / 2 }, makeDivision));
  for (let index = questions.length - 1; index > 0; index -= 1) {
    const other = randomInt(0, index);
    [questions[index], questions[other]] = [questions[other], questions[index]];
  }
  return questions;
}

function openDialog() {
  returnFocus = document.activeElement;
  if (!dialog.open) dialog.showModal();
}

function closeDialog() {
  session = null;
  if (dialog.open) dialog.close();
  returnFocus?.focus();
}

function startPractice() {
  session = { questions: makeRound(), index: 0, score: 0, answered: false };
  openDialog();
  renderQuestion();
}

function renderQuestion() {
  const question = session.questions[session.index];
  const isDivision = question.kind === "divide";
  const currentNumber = session.index + 1;
  session.answered = false;

  content.innerHTML = `
    <p class="eyebrow">오늘의 수학 연습</p>
    <h2 id="dialog-title">문제 ${currentNumber}</h2>
    <div class="question-meta"><span>${currentNumber} / ${questionCount} 문제</span><span>${isDivision ? "나눗셈" : "곱셈"}</span></div>
    <div class="progress" role="progressbar" aria-label="문제 진행" aria-valuemin="0" aria-valuemax="${questionCount}" aria-valuenow="${session.index}"><span style="width:${(session.index / questionCount) * 100}%"></span></div>
    <p class="answer-prompt">${isDivision ? "몫과 나머지를 입력해 주세요." : "정답을 입력해 주세요."}</p>
    <div class="question-expression">${question.prompt} <span>=</span> ?</div>
    <form class="answer-form" novalidate>
      ${isDivision ? `
        <label>몫<input id="quotient" type="number" inputmode="numeric" step="1" min="0" autocomplete="off" aria-label="몫"></label>
        <label>나머지<input id="remainder" type="number" inputmode="numeric" step="1" min="0" max="${question.divisor - 1}" autocomplete="off" aria-label="나머지"></label>
      ` : `
        <label class="single-answer">정답<input id="answer" type="number" inputmode="numeric" step="1" autocomplete="off" aria-label="정답"></label>
      `}
      <button class="pill" type="submit">정답 확인</button>
    </form>
    <p class="feedback" aria-live="polite"></p>
    <button class="pill wide next-button" id="next-question" type="button" hidden>${currentNumber === questionCount ? "결과 보기" : "다음 문제"}</button>
    <p class="no-save-note">점수와 답안은 이 연습을 마치면 저장되지 않습니다.</p>
  `;

  content.querySelector(".answer-form").addEventListener("submit", checkAnswer);
  content.querySelector("#next-question").addEventListener("click", advanceQuestion);
  content.querySelector(isDivision ? "#quotient" : "#answer").focus();
}

function checkAnswer(event) {
  event.preventDefault();
  if (session.answered) return;

  const question = session.questions[session.index];
  const feedback = content.querySelector(".feedback");
  const inputs = [...content.querySelectorAll(".answer-form input")];
  if (inputs.some((input) => input.value.trim() === "")) {
    feedback.textContent = "답을 모두 입력해 주세요.";
    feedback.className = "feedback error";
    inputs.find((input) => input.value.trim() === "")?.focus();
    return;
  }

  if (inputs.some((input) => !Number.isInteger(Number(input.value)) || Number(input.value) < 0)) {
    feedback.textContent = "0 이상의 정수로 입력해 주세요.";
    feedback.className = "feedback error";
    inputs.find((input) => !Number.isInteger(Number(input.value)) || Number(input.value) < 0)?.focus();
    return;
  }

  if (question.kind === "divide" && Number(content.querySelector("#remainder").value) >= question.divisor) {
    feedback.textContent = "나머지는 나누는 수보다 작아야 해요.";
    feedback.className = "feedback error";
    content.querySelector("#remainder").focus();
    return;
  }

  const isCorrect = question.kind === "divide"
    ? Number(content.querySelector("#quotient").value) === question.answer.quotient
      && Number(content.querySelector("#remainder").value) === question.answer.remainder
    : Number(content.querySelector("#answer").value) === question.answer;

  session.answered = true;
  if (isCorrect) session.score += 1;

  feedback.textContent = isCorrect
    ? "정답이에요! 잘했어요."
    : `아쉬워요. 정답은 ${question.explanation}이에요.`;
  feedback.className = `feedback ${isCorrect ? "success" : "incorrect"}`;
  content.querySelectorAll(".answer-form input, .answer-form button").forEach((control) => {
    control.disabled = true;
  });
  const nextButton = content.querySelector("#next-question");
  nextButton.hidden = false;
  nextButton.focus();
}

function advanceQuestion() {
  if (session.index === questionCount - 1) {
    renderResult();
    return;
  }
  session.index += 1;
  renderQuestion();
}

function renderResult() {
  content.innerHTML = `
    <p class="eyebrow">연습 완료</p>
    <h2 id="dialog-title">오늘의 결과</h2>
    <div class="result-score">${session.score}<span> / ${questionCount}</span></div>
    <p class="result-copy">열 문제를 모두 풀었어요.<br />작은 연습이 쌓여 큰 자신감이 됩니다.</p>
    <p class="no-save-note">이 결과는 화면에만 표시되며 저장되지 않습니다.</p>
    <button class="pill wide" id="try-again" type="button">한 번 더 풀기</button>
    <button class="pill wide secondary" id="return-home" type="button">허브로 돌아가기</button>
  `;
  content.querySelector("#try-again").addEventListener("click", () => {
    session = { questions: makeRound(), index: 0, score: 0, answered: false };
    renderQuestion();
  });
  content.querySelector("#return-home").addEventListener("click", closeDialog);
  content.querySelector("#try-again").focus();
}

document.querySelector("#start-practice").addEventListener("click", startPractice);
document.querySelectorAll("[data-start-practice]").forEach((button) => {
  button.addEventListener("click", startPractice);
});
document.querySelector(".close-button").addEventListener("click", closeDialog);
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDialog();
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});

async function loadPdfLibrary() {
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import("https://unpkg.com/pdfjs-dist@6.4.299/build/pdf.mjs")
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@6.4.299/build/pdf.worker.mjs";
        return pdfjs;
      })
      .catch((error) => {
        pdfLibraryPromise = null;
        throw error;
      });
  }
  return pdfLibraryPromise;
}

function setPdfStatus(message, state = "") {
  const status = document.querySelector("#pdf-status");
  status.textContent = message;
  status.className = `pdf-status ${state}`;
}

function clearPdfResult() {
  pdfTaskId += 1;
  document.querySelector("#pdf-results").hidden = true;
  document.querySelector("#pdf-file").value = "";
  setPdfStatus("파일을 선택하면 이 기기에서 분석합니다.");
}

function countWords(text) {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length;
}

async function analyzePdf(file) {
  const thisTask = ++pdfTaskId;
  const results = document.querySelector("#pdf-results");
  results.hidden = true;

  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    setPdfStatus("PDF 파일만 선택할 수 있어요.", "error");
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    setPdfStatus("100MB 이하의 PDF 파일을 선택해 주세요.", "error");
    return;
  }

  try {
    setPdfStatus("분석 도구를 준비하고 있어요…");
    const pdfjs = await loadPdfLibrary();
    if (thisTask !== pdfTaskId) return;
    setPdfStatus("PDF 텍스트를 이 기기에서 분석하고 있어요…");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useWorkerFetch: false });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const textParts = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (thisTask !== pdfTaskId) {
        await pdf.destroy();
        return;
      }
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      for (const item of textContent.items) {
        if (typeof item.str !== "string") continue;
        textParts.push(item.str);
        if (item.hasEOL) textParts.push("\n");
      }
    }
    await pdf.destroy();
    if (thisTask !== pdfTaskId) return;

    const text = textParts.join("");
    document.querySelector("#pdf-file-name").textContent = file.name;
    document.querySelector("#count-with-spaces").textContent = Array.from(text).length.toLocaleString("ko-KR");
    document.querySelector("#count-without-spaces").textContent = Array.from(text.replace(/\s/gu, "")).length.toLocaleString("ko-KR");
    document.querySelector("#count-words").textContent = countWords(text).toLocaleString("ko-KR");
    document.querySelector("#count-pages").textContent = pageCount.toLocaleString("ko-KR");
    document.querySelector("#pdf-empty-note").hidden = text.trim().length !== 0;
    results.hidden = false;
    setPdfStatus("분석이 끝났어요. 파일과 결과는 저장되지 않습니다.", "success");
  } catch (error) {
    if (thisTask !== pdfTaskId) return;
    const message = error?.name === "PasswordException"
      ? "암호로 보호된 PDF는 열 수 없어요. 잠금 해제 후 다시 선택해 주세요."
      : "PDF를 읽지 못했어요. 파일이 손상되었거나 암호로 보호되었는지 확인해 주세요.";
    setPdfStatus(message, "error");
  }
}

document.querySelector("#start-pdf-counter").addEventListener("click", () => {
  if (!pdfDialog.open) pdfDialog.showModal();
  document.querySelector("#pdf-file").focus();
});
document.querySelector("#close-pdf-dialog").addEventListener("click", () => pdfDialog.close());
pdfDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  pdfDialog.close();
});
pdfDialog.addEventListener("click", (event) => {
  if (event.target === pdfDialog) pdfDialog.close();
});
document.querySelector("#pdf-file").addEventListener("change", (event) => analyzePdf(event.target.files?.[0]));
document.querySelector("#clear-pdf").addEventListener("click", clearPdfResult);

const dropZone = document.querySelector("#pdf-drop-zone");
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  const file = event.dataTransfer.files?.[0];
  if (file) analyzePdf(file);
});

