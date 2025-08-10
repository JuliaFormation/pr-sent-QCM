// === ÉTAT GLOBAL ===
let quizData = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let quizTitle = "";
let rawCsvText = "";           // CSV original pour le partage
let isReaderMode = false;      // ✅ mode lecteur (lien partagé)

// === SÉLECTEURS ===
const screenImport   = document.getElementById("screen-import");
const screenQuestion = document.getElementById("screen-question");
const screenResults  = document.getElementById("screen-results");

const csvFileInput   = document.getElementById("csvFile");
const btnStart       = document.getElementById("btnStart");
const btnShare       = document.getElementById("btnShare");
const btnPrev        = document.getElementById("btnPrev");
const btnValidate    = document.getElementById("btnValidate");
const btnRestart     = document.getElementById("btnRestart");

const quizTitleEl    = document.getElementById("quizTitle");
const importSummary  = document.getElementById("importSummary");

const questionTitle  = document.getElementById("question-title");
const progressEl     = document.getElementById("progress");
const answersEl      = document.getElementById("answers");

const finalScoreEl   = document.getElementById("finalScore");
const resultsListEl  = document.getElementById("resultsList");
const finalMessageCard = document.getElementById("finalMessageCard");

const readerBanner   = document.getElementById("readerBanner");

const htmlEl         = document.documentElement;
const themeToggleBtn = document.getElementById("themeToggle");
const themeIcon      = document.getElementById("themeIcon");

// Modal partage
const shareModal     = document.getElementById("shareModal");
const shareClose     = document.getElementById("shareClose");
const shareLinkEl    = document.getElementById("shareLink");
const shareIframeEl  = document.getElementById("shareIframe");
const copyLinkBtn    = document.getElementById("copyLink");
const copyIframeBtn  = document.getElementById("copyIframe");

// === UTILS ===
const normalizeCaseOnly = (s) => (s || "").trim().toLowerCase();

function guessSeparator(line) {
  const counts = [
    { sep: ";",  n: (line.match(/;/g)  || []).length },
    { sep: ",",  n: (line.match(/,/g)  || []).length },
    { sep: "\t", n: (line.match(/\t/g) || []).length },
  ];
  counts.sort((a,b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].sep : ",";
}

function parseCsvLine(line, sep) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// URL image directe (Drive/Dropbox -> direct)
function normalizeImageURL(url){
  if (!url) return url;
  try{
    const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    if (url.includes("dropbox.com")) {
      const u = new URL(url);
      if (u.searchParams.get("dl") === "0") { u.searchParams.set("dl", "1"); return u.toString(); }
      if (u.searchParams.get("raw") === "0") { u.searchParams.set("raw", "1"); return u.toString(); }
    }
  }catch(e){}
  return url;
}

// base64url pour partage
function base64urlEncode(str){
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64urlDecode(str){
  const b64 = str.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4 - str.length % 4) % 4);
  return decodeURIComponent(escape(atob(b64)));
}

// === CONFIG message final (localStorage) ===
const FINAL_CFG_KEY = "quiz_final_message_cfg";
function defaultFinalConfig(){
  return {
    excellent: { min: 80, text: "Bravo, excellent score !", linkText: "", linkHref: "", img: "" },
    good:      { min: 50, max: 79, text: "Beau résultat, encore un effort pour atteindre l’excellence !", linkText: "", linkHref: "", img: "" },
    review:    { max: 49, text: "Pas grave, ça se travaille. Revois le cours et retente !", linkText: "", linkHref: "", img: "" }
  };
}
function loadFinalConfig(){
  try{
    const raw = localStorage.getItem(FINAL_CFG_KEY);
    if (!raw) return defaultFinalConfig();
    const parsed = JSON.parse(raw);
    return { ...defaultFinalConfig(), ...parsed };
  }catch(e){ return defaultFinalConfig(); }
}
function saveFinalConfig(cfg){ localStorage.setItem(FINAL_CFG_KEY, JSON.stringify(cfg)); }

const ui = {
  excellentMin: document.getElementById("cfgExcellentMin"),
  excellentText: document.getElementById("cfgExcellentText"),
  excellentLinkText: document.getElementById("cfgExcellentLinkText"),
  excellentLinkHref: document.getElementById("cfgExcellentLinkHref"),
  excellentImg: document.getElementById("cfgExcellentImg"),
  excellentImgPreviewWrap: document.getElementById("cfgExcellentImgPreviewWrap"),
  excellentImgPreview: document.getElementById("cfgExcellentImgPreview"),

  goodMin: document.getElementById("cfgGoodMin"),
  goodMax: document.getElementById("cfgGoodMax"),
  goodText: document.getElementById("cfgGoodText"),
  goodLinkText: document.getElementById("cfgGoodLinkText"),
  goodLinkHref: document.getElementById("cfgGoodLinkHref"),
  goodImg: document.getElementById("cfgGoodImg"),
  goodImgPreviewWrap: document.getElementById("cfgGoodImgPreviewWrap"),
  goodImgPreview: document.getElementById("cfgGoodImgPreview"),

  reviewMax: document.getElementById("cfgReviewMax"),
  reviewText: document.getElementById("cfgReviewText"),
  reviewLinkText: document.getElementById("cfgReviewLinkText"),
  reviewLinkHref: document.getElementById("cfgReviewLinkHref"),
  reviewImg: document.getElementById("cfgReviewImg"),
  reviewImgPreviewWrap: document.getElementById("cfgReviewImgPreviewWrap"),
  reviewImgPreview: document.getElementById("cfgReviewImgPreview"),

  btnSave: document.getElementById("cfgSave"),
  btnReset: document.getElementById("cfgReset"),
};

let finalCfg = loadFinalConfig();

function hydrateFinalCfgUI(){
  if (!ui.btnSave) return;
  ui.excellentMin.value = finalCfg.excellent.min;
  ui.excellentText.value = finalCfg.excellent.text;
  ui.excellentLinkText.value = finalCfg.excellent.linkText || "";
  ui.excellentLinkHref.value = finalCfg.excellent.linkHref || "";
  ui.excellentImg.value = finalCfg.excellent.img || "";

  ui.goodMin.value = finalCfg.good.min;
  ui.goodMax.value = finalCfg.good.max;
  ui.goodText.value = finalCfg.good.text;
  ui.goodLinkText.value = finalCfg.good.linkText || "";
  ui.goodLinkHref.value = finalCfg.good.linkHref || "";
  ui.goodImg.value = finalCfg.good.img || "";

  ui.reviewMax.value = finalCfg.review.max;
  ui.reviewText.value = finalCfg.review.text;
  ui.reviewLinkText.value = finalCfg.review.linkText || "";
  ui.reviewLinkHref.value = finalCfg.review.linkHref || "";
  ui.reviewImg.value = finalCfg.review.img || "";

  updatePreview(ui.excellentImg, ui.excellentImgPreviewWrap, ui.excellentImgPreview);
  updatePreview(ui.goodImg, ui.goodImgPreviewWrap, ui.goodImgPreview);
  updatePreview(ui.reviewImg, ui.reviewImgPreviewWrap, ui.reviewImgPreview);
}
function readFinalCfgFromUI(){
  finalCfg = {
    excellent: {
      min: parseInt(ui.excellentMin.value || "80", 10),
      text: ui.excellentText.value || "",
      linkText: ui.excellentLinkText.value || "",
      linkHref: ui.excellentLinkHref.value || "",
      img: ui.excellentImg.value || ""
    },
    good: {
      min: parseInt(ui.goodMin.value || "50", 10),
      max: parseInt(ui.goodMax.value || "79", 10),
      text: ui.goodText.value || "",
      linkText: ui.goodLinkText.value || "",
      linkHref: ui.goodLinkHref.value || "",
      img: ui.goodImg.value || ""
    },
    review: {
      max: parseInt(ui.reviewMax.value || "49", 10),
      text: ui.reviewText.value || "",
      linkText: ui.reviewLinkText.value || "",
      linkHref: ui.reviewLinkHref.value || "",
      img: ui.reviewImg.value || ""
    }
  };
}
if (ui.btnSave && ui.btnReset) {
  hydrateFinalCfgUI();
  ui.btnSave.addEventListener("click", () => { readFinalCfgFromUI(); saveFinalConfig(finalCfg); alert("Message final enregistré."); });
  ui.btnReset.addEventListener("click", () => { finalCfg = defaultFinalConfig(); hydrateFinalCfgUI(); saveFinalConfig(finalCfg); });
  [ui.excellentImg, ui.goodImg, ui.reviewImg].forEach((el) => {
    el.addEventListener("input", () => {
      if (el === ui.excellentImg) updatePreview(ui.excellentImg, ui.excellentImgPreviewWrap, ui.excellentImgPreview);
      if (el === ui.goodImg)      updatePreview(ui.goodImg, ui.goodImgPreviewWrap, ui.goodImgPreview);
      if (el === ui.reviewImg)    updatePreview(ui.reviewImg, ui.reviewImgPreviewWrap, ui.reviewImgPreview);
    });
  });
}
function updatePreview(inputEl, wrapEl, imgEl){
  const raw = (inputEl.value || "").trim();
  if (!raw){ wrapEl.hidden = true; imgEl.src=""; return; }
  const url = normalizeImageURL(raw);
  wrapEl.hidden = false;
  imgEl.src = url;
  imgEl.onerror = () => { wrapEl.hidden = true; imgEl.src=""; };
}

// === IMPORT CSV ===
csvFileInput?.addEventListener("change", handleFileImport);
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  quizTitle = file.name.replace(/\.csv$/i, "");
  quizTitleEl.textContent = quizTitle;

  const reader = new FileReader();
  reader.onload = function (event) {
    let text = event.target.result || "";
    text = text.replace(/^\uFEFF/, ""); // anti‑BOM
    rawCsvText = text;
    parseCSV(text);
    importSummary.textContent = `${quizData.length} question(s) détectée(s).`;
    btnStart.disabled = quizData.length === 0;
    btnShare.disabled  = quizData.length === 0;
  };
  reader.readAsText(file, "UTF-8");
}

function parseCSV(text) {
  quizData = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length === 0) return;

  const sep = guessSeparator(lines[0]);
  const header = parseCsvLine(lines[0], sep);
  const headerLooksLikeHeader = header.join(" ").toLowerCase().includes("question");
  let startIdx = headerLooksLikeHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], sep);
    if (cols.length < 9) continue;

    const typeRaw = (cols[0] || "").replace(/\uFEFF/g,"").trim().toLowerCase();
    const type = typeRaw === "réponse courte" ? "RC" : typeRaw.toUpperCase();
    if (type !== "QCM" && type !== "RC") continue;

    const id           = (cols[1] || "").trim();
    const questionText = (cols[2] || "").trim();
    const options      = (type === "QCM") ? [cols[3], cols[4], cols[5], cols[6]].map(x => (x || "").trim()).filter(Boolean) : [];
    const correct      = (cols[7] || "").trim();
    const comment      = (cols[8] || "").trim();

    if (!questionText || !correct) continue;
    if (type === "QCM" && options.length === 0) continue;

    quizData.push({ id, type, question: questionText, options, correct, comment });
  }
  if (quizData.length === 0) console.warn("Aucune question reconnue. Vérifie séparateur & colonne A (QCM/RC) / BOM.");
}

// === DÉMARRAGE ===
btnStart?.addEventListener("click", () => {
  currentQuestionIndex = 0;
  userAnswers = new Array(quizData.length).fill(null);
  showQuestion();
  screenImport.hidden = true;
  screenQuestion.hidden = false;
});

// === AFFICHAGE QUESTION ===
function showQuestion() {
  const q = quizData[currentQuestionIndex];
  questionTitle.textContent = q.question;
  progressEl.textContent = `Question ${currentQuestionIndex + 1} sur ${quizData.length}`;
  answersEl.innerHTML = "";

  if (q.type === "QCM") {
    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => selectAnswer(option));
      if (userAnswers[currentQuestionIndex] === option) btn.classList.add("selected");
      answersEl.appendChild(btn);
    });
  } else {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "shortAnswerInput";
    input.className = "short-answer-input";
    input.placeholder = "Écris ta réponse ici";
    input.value = userAnswers[currentQuestionIndex] ?? "";
    input.addEventListener("input", () => { userAnswers[currentQuestionIndex] = input.value; });
    answersEl.appendChild(input);
    setTimeout(() => input.focus(), 0);
  }

  btnPrev.disabled = currentQuestionIndex === 0;
  btnValidate.disabled = (q.type === "QCM" && !userAnswers[currentQuestionIndex]);
}
function selectAnswer(option) {
  userAnswers[currentQuestionIndex] = option;
  document.querySelectorAll(".answer-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.textContent === option);
  });
  btnValidate.disabled = false;
}

// === NAVIGATION ===
btnPrev?.addEventListener("click", () => { if (currentQuestionIndex > 0) { currentQuestionIndex--; showQuestion(); } });
btnValidate?.addEventListener("click", () => {
  if (currentQuestionIndex < quizData.length - 1) { currentQuestionIndex++; showQuestion(); }
  else { showResults(); }
});

// === CLAVIER : Entrée / Espace ===
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (!screenImport.hidden && !btnStart.disabled) { e.preventDefault(); btnStart.click(); return; }
  if (!screenQuestion.hidden) {
    const ae = document.activeElement;
    if (ae?.classList?.contains("answer-btn")) { e.preventDefault(); ae.click(); return; }
    e.preventDefault(); btnValidate.click();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || screenQuestion.hidden) return;
  const ae = document.activeElement;
  if (ae?.classList?.contains("answer-btn")) { e.preventDefault(); ae.click(); }
});

// === RÉSULTATS ===
function showResults() {
  screenQuestion.hidden = true;
  screenResults.hidden = false;

  let score = 0;
  resultsListEl.innerHTML = "";

  quizData.forEach((q, idx) => {
    const userAnswer = userAnswers[idx];
    const isCorrect = normalizeCaseOnly(userAnswer) === normalizeCaseOnly(q.correct);
    if (isCorrect) score++;

    const questionBlock = document.createElement("div");
    questionBlock.className = "result-question";

    const qText = document.createElement("h3");
    qText.textContent = q.question;

    const mark = document.createElement("span");
    mark.textContent = isCorrect ? " ✔" : " ✖";
    mark.className = isCorrect ? "q-status-check" : "q-status-cross";
    qText.appendChild(mark);
    questionBlock.appendChild(qText);

    if (q.type === "QCM") {
      const ul = document.createElement("ul");
      q.options.forEach(opt => {
        const li = document.createElement("li");
        li.textContent = opt;
        const isOptionCorrect = normalizeCaseOnly(opt) === normalizeCaseOnly(q.correct);
        const isOptionChosen  = normalizeCaseOnly(opt) === normalizeCaseOnly(userAnswer);
        if (isOptionCorrect)      li.classList.add("correct");
        else if (isOptionChosen)  li.classList.add("wrong");
        else                      li.classList.add("other");
        ul.appendChild(li);
      });
      questionBlock.appendChild(ul);
    } else {
      const pUser = document.createElement("p");
      pUser.innerHTML = `<strong>Ta réponse :</strong> ${userAnswer ?? "—"}`;
      pUser.className = isCorrect ? "rc-user correct" : "rc-user wrong";
      questionBlock.appendChild(pUser);

      const pCorr = document.createElement("p");
      pCorr.innerHTML = `<strong>Bonne réponse :</strong> ${q.correct}`;
      pCorr.className = "rc-correct";
      questionBlock.appendChild(pCorr);
    }

    if (q.comment) {
      const exp = document.createElement("p");
      exp.className = "explanation";
      exp.textContent = q.comment;
      questionBlock.appendChild(exp);
    }

    resultsListEl.appendChild(questionBlock);
  });

  finalScoreEl.textContent = `${score} / ${quizData.length}`;
  renderFinalMessage(score, quizData.length);
}

// Message final (sans titre)
function renderFinalMessage(score, total){
  const pct = total ? Math.round((score / total) * 100) : 0;
  if (!finalMessageCard) return;
  finalMessageCard.innerHTML = "";

  let selected;
  if (pct >= (finalCfg.excellent.min ?? 80)) selected = finalCfg.excellent;
  else if (pct >= (finalCfg.good.min ?? 50) && pct <= (finalCfg.good.max ?? 79)) selected = finalCfg.good;
  else selected = finalCfg.review;

  if (!selected) return;

  if (selected.text) {
    const p = document.createElement("p");
    p.className = "final-msg-text";
    p.textContent = selected.text.replace("{score}", `${score}/${total}`).replace("{percent}", `${pct}%`);
    finalMessageCard.appendChild(p);
  }
  if (selected.linkHref && selected.linkText) {
    const a = document.createElement("a");
    a.className = "final-msg-link";
    a.href = selected.linkHref;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = selected.linkText;
    finalMessageCard.appendChild(a);
  }
  if (selected.img) {
    const img = document.createElement("img");
    img.className = "final-msg-img";
    img.src = normalizeImageURL(selected.img);
    img.alt = "Illustration";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    finalMessageCard.appendChild(img);
  }
}

// === RECOMMENCER ===
btnRestart?.addEventListener("click", () => {
  screenResults.hidden = true;
  screenImport.hidden  = false;

  const titleEl = document.getElementById("import-title");
  if (titleEl) titleEl.textContent = "Prêt à jouer ?";
  btnStart.disabled = false;

  if (isReaderMode) {
    document.querySelector(".uploader")?.setAttribute("hidden","true");
    document.querySelector(".final-message-card")?.setAttribute("hidden","true");
    if (btnShare) btnShare.hidden = true;
    if (readerBanner) readerBanner.hidden = true;
    enterReaderLanding(); // hero centrée
  } else {
    document.querySelector(".uploader")?.removeAttribute("hidden");
    document.querySelector(".final-message-card")?.removeAttribute("hidden");
    if (btnShare) btnShare.hidden = false;
    if (readerBanner) readerBanner.hidden = true;
    importSummary.textContent = `${quizData.length} question(s) • ${quizTitle || "Mon quiz"}`;
    btnStart.textContent = "Rejouer le quiz";
  }
});

// === THÈME ===
(function initTheme(){
  const saved = localStorage.getItem("quiz_theme");
  htmlEl.setAttribute("data-theme", saved || "light");
  syncThemeIcon();
})();
function toggleTheme(){
  const current = htmlEl.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  htmlEl.setAttribute("data-theme", next);
  localStorage.setItem("quiz_theme", next);
  syncThemeIcon();
}
function syncThemeIcon(){
  const mode = htmlEl.getAttribute("data-theme");
  themeIcon.textContent = mode === "light" ? "☀️" : "🌙";
}
themeToggleBtn?.addEventListener("click", toggleTheme);

// === PARTAGE ===
function buildPayload(){ return { t: quizTitle || "Mon quiz", csv: rawCsvText, cfg: finalCfg, v: 1 }; }

btnShare?.addEventListener("click", async () => {
  const payload = buildPayload();
  const encoded = base64urlEncode(JSON.stringify(payload));
  const base = window.location.origin + window.location.pathname;
  const url  = `${base}#q=${encoded}`;

  shareLinkEl.value   = url;
  shareIframeEl.value = `<iframe src="${url}" width="100%" height="640" style="border:0;" allow="clipboard-write; web-share"></iframe>`;

  if (!document.getElementById("exportHtmlBtn")) {
    const exportBtn = document.createElement("button");
    exportBtn.id = "exportHtmlBtn";
    exportBtn.className = "btn";
    exportBtn.textContent = "Exporter .html (autonome)";
    shareIframeEl.parentElement.appendChild(exportBtn);
    exportBtn.addEventListener("click", async () => { await exportStandaloneHTML(encoded); });
  }
  shareModal.hidden = false;
});
shareClose?.addEventListener("click", () => shareModal.hidden = true);
copyLinkBtn?.addEventListener("click",  () => { shareLinkEl.select(); document.execCommand('copy'); copyLinkBtn.textContent="Copié !"; setTimeout(()=>copyLinkBtn.textContent="Copier",1000); });
copyIframeBtn?.addEventListener("click",()=> { shareIframeEl.select(); document.execCommand('copy'); copyIframeBtn.textContent="Copié !"; setTimeout(()=>copyIframeBtn.textContent="Copier",1000); });

// === LECTURE via lien (#q=...) — avec fallback ===
window.addEventListener("DOMContentLoaded", () => {
  const m = (window.location.hash || "").match(/#q=([^&]+)/);
  if (!m) return;

  let ok = false;
  try{
    const data = JSON.parse(base64urlDecode(m[1]));
    quizTitle = data.t || "Mon quiz";
    quizTitleEl.textContent = quizTitle;

    finalCfg = data.cfg ? { ...defaultFinalConfig(), ...data.cfg } : defaultFinalConfig();
    if (typeof hydrateFinalCfgUI === "function") hydrateFinalCfgUI();

    rawCsvText = (data.csv || "").replace(/^\uFEFF/, "");
    parseCSV(rawCsvText);

    if (quizData.length > 0) {
      isReaderMode = true;
      screenImport.hidden = false;
      document.getElementById("import-title").textContent = "Prêt à jouer ?";
      importSummary.textContent = `${quizData.length} question(s) • ${quizTitle}`;
      document.querySelector(".uploader")?.setAttribute("hidden","true");
      document.querySelector(".final-message-card")?.setAttribute("hidden","true");
      btnStart.textContent = "Démarrer";
      btnStart.disabled = false;
      if (btnShare) btnShare.hidden = true;
      if (readerBanner) readerBanner.hidden = true;
      enterReaderLanding(); // ⭐️ landing centrée
      ok = true;
    }
  }catch(e){ console.error("Lien invalide", e); }

  if (!ok) {
    document.querySelector(".uploader")?.removeAttribute("hidden");
    document.querySelector(".final-message-card")?.removeAttribute("hidden");
    if (readerBanner) readerBanner.hidden = true;
    if (btnShare) btnShare.hidden = false;
    btnStart.textContent = "Tester le quiz";
    btnStart.disabled = true;
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
});

// === Landing mode lecteur (hero) ===
function ensureReaderHero(){
  let hero = document.getElementById("readerLanding");
  if (!hero) {
    hero = document.createElement("div");
    hero.id = "readerLanding";
    hero.className = "reader-hero";
    hero.innerHTML = `
      <div class="hero-title">Prêt à jouer&nbsp;?</div>
      <div class="hero-card">
        <div id="heroQuizTitle" class="hero-quiz-title"></div>
      </div>
    `;
    const importTitle = document.getElementById("import-title");
    importTitle?.insertAdjacentElement("afterend", hero);
  }
  const t = document.getElementById("heroQuizTitle");
  if (t) t.textContent = quizTitle || "Mon quiz";
}
function enterReaderLanding(){
  document.body.classList.add("reader-mode");
  ensureReaderHero();
  importSummary.textContent = "";
  btnStart.textContent = "Démarrer";
  btnStart.disabled = false;
}

// === Export .html autonome ===
async function exportStandaloneHTML(encodedPayload){
  let cssText = "", jsText = "";
  try{
    const link = document.querySelector('link[rel="stylesheet"]');
    const scriptTag = [...document.scripts].find(s => s.src && /script\.js(\?|$)/.test(s.src));
    if (link?.href)      { const res = await fetch(link.href, { cache:"no-store" }); cssText = await res.text(); }
    if (scriptTag?.src)  { const res2= await fetch(scriptTag.src, { cache:"no-store" }); jsText  = await res2.text(); }
  }catch(e){ console.warn("Inlining CSS/JS impossible. Fallback liens externes.", e); }

  const title = (quizTitle || "Quiz").replace(/[<>]/g,"");
  const html = `<!doctype html>
<html lang="fr" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  ${cssText ? `<style>${cssText}</style>` : `<link rel="stylesheet" href="style.css">`}
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  ${document.querySelector('main.app')?.outerHTML || '<main id="app"></main>'}
  ${jsText ? `<script>${jsText}</script>` : `<script src="script.js"></script>`}
  <script>(function(){var e='${encodedPayload}';if(!location.hash||!location.hash.includes('#q=')){location.hash='#q='+e;}})();</script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${(title||"quiz").toLowerCase().replace(/\s+/g,'-')}.html`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}
