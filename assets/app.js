/* Agent Signal HQ · agentsignalhq.com
   Every node is built with createElement/textContent: no innerHTML, so the page runs under
   require-trusted-types-for 'script'. Progress lives in localStorage on this device only. */
(function () {
"use strict";

/* ---------- helpers ---------- */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var store = {
  get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
};
function h(tag, attrs, kids) {
  var el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v == null || v === false) return;
    if (k === "class") el.className = v;
    else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  });
  (kids || []).forEach(function (c) {
    if (c == null || c === false) return;
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  });
  return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function jget(k, d) { try { var v = JSON.parse(store.get(k)); return v == null ? d : v; } catch (e) { return d; } }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function dayNum(key) { var p = key.split("-"); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); }
function weekId(key) { return Math.floor((dayNum(key) + 3) / 7); }   // weeks start Monday

/* ---------- progress: points, alien, levels ---------- */
var LEVELS = [
  [0, "Newcomer", "Plain antennas.", "Level 1: where everyone starts."],
  [30, "Signal Scout", "Antennas start to glow.", "Level 2: read the cards and your antennas glow."],
  [60, "Field Apprentice", "A chest badge (new art coming), and a bright glow.", "Level 3: a perfect Level 0 reaches here. Chest badge art is coming."],
  [150, "Deployer", "A cape (new art coming), and a bright glow.", "Level 4: a few Signal checks later. Cape art is coming."],
  [300, "Forward Deployed", "Full gear (new art coming), and a bright glow.", "Level 5: the top of the FDE path. Full gear art is coming."]
];
var prog = jget("hq_prog", { pts: 0, cards: [], quiz: null, name: "", colour: "blue" });
function save() { store.set("hq_prog", JSON.stringify(prog)); }
function levelOf(p) { var L = 0; LEVELS.forEach(function (x, i) { if (p >= x[0]) L = i; }); return L; }
var ALIEN = { blue: "img/coach-blue.png", purple: "img/coach-purple.png" };

function renderLevels(preview) {
  var L = levelOf(prog.pts), show = preview != null ? preview : L, steps = clear($("#lvlSteps"));
  var img = $("#lvlImg");
  img.setAttribute("src", ALIEN[prog.colour] || ALIEN.blue);
  img.setAttribute("alt", "Your alien: a flat, pastel " + (prog.colour || "blue") + " alien with two antennas");
  img.className = "alien-img" + (show >= 2 ? " glow2" : show === 1 ? " glow1" : "");
  $("#lvlName").textContent = prog.name || "You";
  $("#lvlTitle").textContent = "Alien level " + (show + 1) + " · " + LEVELS[show][1];
  $("#lvlGear").textContent = LEVELS[show][2];
  LEVELS.forEach(function (x, i) {
    steps.appendChild(h("li", { class: i === show ? "cur" : i <= L ? "got" : i === L + 1 ? "next" : null }, [h("i", {}, [String(i + 1)]), h("span", {}, [h("b", {}, [x[1] + ": "]), x[2]]), h("em", {}, [x[0] + " pts"])]));
  });
  var nx = LEVELS[L + 1], p = prog.pts, pct = nx ? (p - LEVELS[L][0]) / (nx[0] - LEVELS[L][0]) * 100 : 100;
  $("#xpFill").style.width = Math.max(3, Math.min(100, pct)) + "%";
  $("#xpTxt").textContent = p + " point" + (p === 1 ? "" : "s") + ". " + (nx ? (nx[0] - p) + " more for level " + (L + 2) + ": " + nx[1] + "." : "Top level reached.") + (p === 0 ? " Read a card to earn your first." : "");
}
var slide = $("#lvlSlide");
slide.addEventListener("input", function () {
  var v = +slide.value - 1;
  $("#lvlSlideN").textContent = String(v + 1);
  $("#lvlDesc").textContent = LEVELS[v][3];
  renderLevels(v);
});

/* ---------- Level 0 cards ---------- */
var lc = $("#lcards"), cards = $$(".lcard", lc), cur = 0;
var SAY = ["Take your time. Swipe, or tap Next.", "Three labels. You will use them every day.", "Last card. Then a quick check, no pressure."];
function seen(i) {
  if (prog.cards.indexOf(i) === -1) { prog.cards.push(i); prog.pts += 10; save(); renderLevels(); }
}
function showCard(i, move) {
  cur = Math.max(0, Math.min(cards.length - 1, i));
  $("#lpText").textContent = "Card " + (cur + 1) + " of 3";
  $("#lpFill").style.width = ((cur + 1) / 3 * 100) + "%";
  $("#coachSay").textContent = SAY[cur];
  $("#lcBack").disabled = cur === 0;
  $("#lcNext").textContent = cur === cards.length - 1 ? "Start the quick check" : "Next card";
  seen(cur);
  if (move) lc.scrollTo({ left: cards[cur].offsetLeft - lc.offsetLeft, behavior: REDUCED ? "auto" : "smooth" });
}
var scrollT = 0;
lc.addEventListener("scroll", function () {   // swipe: follow the snapped card
  window.clearTimeout(scrollT);
  scrollT = window.setTimeout(function () {
    var best = 0, d = 1e9;
    cards.forEach(function (c, i) { var x = Math.abs(c.offsetLeft - lc.offsetLeft - lc.scrollLeft); if (x < d) { d = x; best = i; } });
    if (best !== cur) showCard(best, false);
  }, 80);
}, { passive: true });
$("#lcBack").addEventListener("click", function () { showCard(cur - 1, true); });
$("#lcNext").addEventListener("click", function () {
  seen(cur);
  if (cur < cards.length - 1) { showCard(cur + 1, true); return; }
  openQuiz();
});
lc.addEventListener("keydown", function (e) {
  if (e.key === "ArrowRight") { e.preventDefault(); showCard(cur + 1, true); }
  if (e.key === "ArrowLeft") { e.preventDefault(); showCard(cur - 1, true); }
});

/* ---------- 3-question quiz ---------- */
var QS = [
  { q: "What does SI stand for on this site?", o: ["Search index", "Superintelligence, the new name for AI", "Silicon island"], a: 1,
    why: "SI is superintelligence, the next generation of artificial intelligence (AI). It is a new name, so you will see both." },
  { q: "One outlet says a model launches next week. No company post, no other source. Which label fits?", o: ["Fact", "Widely reported", "Unconfirmed rumor"], a: 2,
    why: "One source and nothing you can check is an unconfirmed rumor. Interesting, not settled." },
  { q: "What is the best first check on a surprising claim?", o: ["Count the likes", "Find who said it first, and look for a primary document", "Wait to see if a friend shares it"], a: 1,
    why: "Go to the original. A primary document, filing or demo beats any number of retellings." }
];
var quiz = $("#quiz"), qWrap = $("#quizQs");
QS.forEach(function (x, n) {
  var fs = h("fieldset", { class: "q", id: "q" + n }, [h("legend", {}, [(n + 1) + ". " + x.q])]);
  x.o.forEach(function (t, i) {
    fs.appendChild(h("label", { class: "opt" }, [h("input", { type: "radio", name: "q" + n, value: String(i), required: true }), h("span", {}, [t])]));
  });
  fs.appendChild(h("p", { class: "why", hidden: true }, [x.why]));
  qWrap.appendChild(fs);
});
function openQuiz() {
  quiz.hidden = false; $("#coachSay").textContent = "Pick one answer for each question.";
  quiz.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
  var f = $("input", quiz); if (f) f.focus({ preventScroll: true });
}
$("#quizBack").addEventListener("click", function () { quiz.hidden = true; showCard(cards.length - 1, true); });
quiz.addEventListener("submit", function (e) {
  e.preventDefault();
  var err = $("#quizErr"), score = 0, picks = [];
  for (var n = 0; n < QS.length; n++) {
    var c = $('input[name="q' + n + '"]:checked', quiz);
    if (!c) { err.textContent = "Pick an answer for question " + (n + 1) + " first."; var fi = $('input[name="q' + n + '"]', quiz); if (fi) fi.focus(); return; }
    picks.push(+c.value);
  }
  err.textContent = "";
  picks.forEach(function (p, n) {
    var fs = $("#q" + n), opts = $$(".opt", fs), ok = p === QS[n].a;
    if (ok) score++;
    opts.forEach(function (o, i) {
      var inp = $("input", o); inp.disabled = true;
      if (i === QS[n].a) o.classList.add("right");
      else if (i === p) o.classList.add("wrong");
    });
    fs.classList.add("done");
    var why = $(".why", fs); why.hidden = false;
    why.textContent = (ok ? "Right. " : "Not quite. ") + QS[n].why;
  });
  $("#quizGo").hidden = true; $("#quizBack").hidden = true;
  var first = !prog.quiz, earned = first ? score * 10 : 0;
  prog.pts += earned;
  var best = prog.quiz ? Math.max(prog.quiz.score, score) : score;
  prog.quiz = { score: best, day: prog.quiz ? prog.quiz.day : dayKey() };
  save();
  streakDone();
  renderLevels(); updateCert();
  var r = $("#quizResult"); clear(r); r.hidden = false;
  r.appendChild(h("h3", {}, ["Level 0 complete: " + score + " of 3"]));
  r.appendChild(h("p", {}, [score === 3 ? "A clean sweep. Nice work." : score === 2 ? "Good. Re-read the question you missed, and you are set." : "You finished Level 0. Read the cards again and try the check tomorrow."]));
  r.appendChild(h("p", {}, [first ? "You earned " + earned + " points. You are now alien level " + (levelOf(prog.pts) + 1) + ", " + LEVELS[levelOf(prog.pts)][1] + "." : "Points are counted once, so a retry keeps your best score."]));
  r.appendChild(h("div", { class: "f-actions" }, [
    h("a", { class: "btn sm", href: "#cert" }, ["See my certificate"]),
    h("a", { class: "btn line sm", href: "#join-email" }, ["Save my progress by email"]),
    h("a", { class: "notnow", href: "#path" }, ["See Level 1"])
  ]));
  $("#coachSay").textContent = "Level 0 is done. Well done.";
  r.focus();
});

/* ---------- opt-in streak with a free freeze day ---------- */
var st = jget("hq_streak", { on: false, count: 0, last: "", freezeWeek: -1, frozen: "" });
function saveStreak() { store.set("hq_streak", JSON.stringify(st)); }
function freezeReady() { return st.freezeWeek !== weekId(dayKey()); }
function renderStreak() {
  var on = $("#streakOn"); on.checked = !!st.on;
  var body = $("#streakBody"); body.hidden = !st.on;
  if (!st.on) return;
  var t = dayNum(dayKey()), gap = st.last ? t - dayNum(st.last) : 0;
  if (st.last && gap > 1 && !(gap === 2 && st.frozen === dayKey(new Date(Date.now() - 864e5)))) {
    // more than the one allowed missed day: the streak restarts on the next check
    if (gap > 2 || !freezeReady()) { st.count = 0; st.last = ""; saveStreak(); gap = 0; }
  }
  $("#streakCount").textContent = String(st.count);
    $("#freezeState").textContent = freezeReady() ? "1 ready this week" : "used this week; a new one comes Monday";
  var canFreeze = st.last && gap === 2 && freezeReady() && st.frozen !== dayKey(new Date(Date.now() - 864e5));
  $("#freezeBtn").hidden = !canFreeze;
  $("#streakMsg").textContent = st.last === dayKey() ? "Today is counted. See you tomorrow." : canFreeze ? "You missed yesterday. Your free freeze day keeps the streak." : "Finish the Level 0 quiz to count today.";
}
$("#streakOn").addEventListener("change", function () {
  st.on = this.checked; saveStreak(); renderStreak();
});
$("#freezeBtn").addEventListener("click", function () {
  st.frozen = dayKey(new Date(Date.now() - 864e5)); st.freezeWeek = weekId(dayKey());
  saveStreak(); renderStreak();
  $("#streakMsg").textContent = "Freeze used. Your streak is safe; finish a check today to keep it going.";
});
function streakDone() {
  if (!st.on) return;
  var today = dayKey();
  if (st.last === today) { renderStreak(); return; }
  var gap = st.last ? dayNum(today) - dayNum(st.last) : 99;
  st.count = (gap === 1 || (gap === 2 && st.frozen)) ? st.count + 1 : 1;
  st.last = today; saveStreak(); renderStreak();
}

/* ---------- certificate preview ---------- */
function updateCert() {
  var done = prog.quiz != null, card = $("#certCard");
  card.classList.toggle("earned", done);
  $("#certStamp").textContent = done ? "Earned" : "Preview";
  $("#certName").textContent = prog.name || "Your name";
  $("#certDate").textContent = done ? "Completed " + prog.quiz.day : "Date of completion";
  $("#certNote").textContent = done ? "Level 0 complete. Use the print option in your browser to keep a copy." : "Preview only for now. Complete the Level 0 quiz to unlock your Level 0 certificate.";
}
var certIn = $("#certIn");
certIn.value = prog.name || "";
certIn.addEventListener("input", function () {
  prog.name = certIn.value.trim().slice(0, 40); save(); updateCert(); renderLevels();
});

/* ---------- sign-up: email first, optional profile, then the welcome gift ---------- */
var API = "https://acp9reat3l.execute-api.us-east-1.amazonaws.com/signal/request-link";
var SITE = "agentsignalhq.com";
var LANDING_RE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]{0,199}$/;   // same shape the API accepts
var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
var ROLE_LIST = ["Software engineer", "Solutions or sales engineer", "Customer success", "Product manager", "Data or ML", "Student or career changer", "Something else"];
function payload(email, hp, profile) {
  // The request-link schema is strict: only email, hp, site, landing_path, tz, query, profile are sent.
  var b = { email: email, hp: hp || "", site: SITE };
  if (LANDING_RE.test(location.pathname)) b.landing_path = location.pathname;
  try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz && tz.length <= 40) b.tz = tz; } catch (e) { /* no zone: the API falls back */ }
  var q = location.search;
  if (q && q.length <= 2048 && /[?&](utm_[a-z]+|ref)=/i.test(q)) b.query = q;   // campaign attribution only
  if (profile) b.profile = profile;
  return b;
}
function post(body) {
  var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? window.setTimeout(function () { ctl.abort(); }, 15000) : 0;
  return fetch(API, { method: "POST", mode: "cors", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { window.clearTimeout(timer); return { status: r.status, code: j && j.error }; }); },
          function () { window.clearTimeout(timer); return { status: 0, code: "network" }; });
}
function errText(res) {
  var s = res.status, c = res.code;
  if (s === 400 && c === "invalid_email") return "That email address doesn't look right. Check it for a typo?";
  if (s === 400 && c === "invalid_profile") return "We couldn't save that. Letters, spaces, hyphens and apostrophes work best in a name.";
  if (s === 400) return "Something in the form didn't go through. Please try again.";
  if (s === 415) return "Your browser sent the form in a format we can't read. Refresh the page and try again.";
  if (s === 429) return "Lots of sign-ups from your network just now. Wait a minute, then try again.";
  if (s === 403) return "Sign-up only works on our own site. Open agentsignalhq.com and try again.";
  if (s >= 500) return "Our sign-up desk hit a snag. Please try again in a moment.";
  return "We couldn't reach the sign-up desk. Check your connection and try again.";
}
function validEmail(v) { return v.length <= 254 && EMAIL_RE.test(v); }

$$(".js-join").forEach(function (form, n) {
  var em = form.querySelector('input[type="email"]'), hp = form.querySelector('input[name="website"]'), err = $(".js-err", form);
  var btn = form.querySelector('button[type="submit"]'), flow = $(".js-flow", form.parentNode), busy = false;
  em.addEventListener("blur", function () {   // inline validation on blur, never only on submit
    var v = em.value.trim();
    if (v && !validEmail(v)) { err.textContent = "That email address doesn't look right yet."; em.setAttribute("aria-invalid", "true"); }
    else { err.textContent = ""; em.removeAttribute("aria-invalid"); }
  });
  em.addEventListener("input", function () { if (em.getAttribute("aria-invalid") && validEmail(em.value.trim())) { err.textContent = ""; em.removeAttribute("aria-invalid"); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var v = em.value.trim();
    if (!validEmail(v)) { err.textContent = "Please enter your email address, like name@example.com."; em.setAttribute("aria-invalid", "true"); em.focus(); return; }
    busy = true; btn.disabled = true; var label = btn.textContent; btn.textContent = "Sending…"; err.textContent = "";
    post(payload(v, hp ? hp.value : "")).then(function (res) {
      busy = false; btn.disabled = false; btn.textContent = label;
      if (res.status === 200) { form.hidden = true; stepProfile(flow, v, n); return; }
      err.textContent = errText(res);
      if (res.code === "invalid_email") { em.setAttribute("aria-invalid", "true"); em.focus(); }
    });
  });
});

function stepProfile(flow, email, n) {
  flow.hidden = false; clear(flow);
  var head = h("h3", { tabindex: "-1" }, ["You're in. Make it yours?"]);
  var name = h("input", { id: "nm" + n, name: "name", type: "text", autocomplete: "given-name", maxlength: "40" });
  var sel = h("select", { id: "rl" + n, name: "role" }, [h("option", { value: "" }, ["Choose from the list"])].concat(ROLE_LIST.map(function (k) { return h("option", { value: k }, [k]); })));
  var cad = ["daily", "weekly"].map(function (c) {
    return h("label", { class: "chk" }, [h("input", { type: "radio", name: "cadence" + n, value: c }), h("span", {}, [c === "daily" ? "Every weekday" : "Weekly recap"])]);
  });
  var perr = h("p", { class: "err", role: "alert" });
  var save = h("button", { class: "btn sm", type: "submit" }, ["Save and pick my gift"]);
  var skip = h("button", { class: "notnow", type: "button" }, ["Not now"]);
  var f = h("form", { novalidate: true }, [
    h("div", { class: "f-grid" }, [
      h("div", {}, [h("label", { for: "nm" + n }, ["First name"]), name]),
      h("div", {}, [h("label", { for: "rl" + n }, ["Your role"]), sel]),
      h("fieldset", { class: "seg-pick f-full" }, [h("legend", { class: "f-l" }, ["How often"])].concat(cad))
    ]),
    perr,
    h("div", { class: "f-actions" }, [save, skip])
  ]);
  flow.appendChild(h("p", { class: "ok-line", role: "status" }, [h("span", {}, ["Check your inbox: we sent a link to confirm ", h("b", {}, [email]), ". Tap it to start your free Level 0."])]));
  flow.appendChild(head);
  flow.appendChild(h("p", { class: "s" }, ["All optional. Skip anything."]));
  flow.appendChild(f);
  head.focus();
  function next(saved) {
    var nm = name.value.trim();
    if (nm) { prog.name = nm.slice(0, 24); save2(); renderLevels(); updateCert(); certIn.value = prog.name; }
    stepGift(flow, n, saved);
  }
  skip.addEventListener("click", function () { next(false); });
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var prof = {}, nm = name.value.trim(), c = f.querySelector('input[name="cadence' + n + '"]:checked');
    if (nm) prof.name = nm;
    if (sel.value && ROLE_LIST.indexOf(sel.value) !== -1) prof.role = sel.value;
    if (c) prof.cadence = c.value;
    if (!Object.keys(prof).length) { next(false); return; }
    if (/[<>]/.test(nm)) { perr.textContent = "Please leave out < and > in your name."; return; }
    save.disabled = true; perr.textContent = "";
    post(payload(email, "", prof)).then(function (res) {
      save.disabled = false;
      if (res.status === 200) next(true);
      else perr.textContent = errText(res);
    });
  });
}
function save2() { save(); }

var GIFTS = [
  { id: "alien", t: "Your own alien", now: true, img: "img/coach-blue.png", d: "Your colour, your name on a badge. It levels up as you learn." },
  { id: "wall", t: "Alien-crew wallpaper pack", now: false, img: "img/coach-purple-lying.png", d: "Phone and desktop sizes, sent to your email." },
  { id: "song", t: "Your theme song", now: false, d: "An original track with your name in it. Yours once, to keep." },
  { id: "audio", t: "A 3-minute audio brief", now: false, d: "On a topic you pick, such as what an FDE does." },
  { id: "chapter", t: "A free book chapter", now: false, d: "Your pick from the 21-book library." }
];
function stepGift(flow, n, saved) {
  clear(flow);
  var head = h("h3", { tabindex: "-1" }, ["Pick your welcome gift."]);
  var out = h("div", { class: "gift-out", "aria-live": "polite" });
  var row = h("div", { class: "snap gift-row", role: "radiogroup", "aria-label": "Welcome gifts", tabindex: "-1" });
  GIFTS.forEach(function (g) {
    var inp = h("input", { type: "radio", name: "gift" + n, value: g.id });
    inp.addEventListener("change", function () { store.set("hq_gift", g.id); renderGift(out, g, n); });
    var art = h("span", { class: "art" }, [g.img ? h("img", { src: g.img, alt: "", height: "70" }) : null]);
    row.appendChild(h("label", { class: "gcard" }, [inp, h("span", { class: "gc" }, [art, h("b", {}, [g.t]), h("span", { class: "when " + (g.now ? "now" : "made") }, [g.now ? "Instant" : "Made for you"]), h("span", { class: "d" }, [g.d])])]));
  });
  if (saved) flow.appendChild(h("p", { class: "ok-line", role: "status" }, [h("span", {}, ["Saved. We sent you a fresh confirm link, so tap the newest email."])]));
  flow.appendChild(head);
  flow.appendChild(h("p", { class: "s" }, ["One now, on us. Every extra newsletter you join later unlocks another, like stickers."]));
  flow.appendChild(row);
  flow.appendChild(out);
  flow.appendChild(h("p", { class: "unlocks" }, ["At 1,000 members, a bonus drop for everyone. At 10,000, a bigger one. No random prizes: every drop goes to every member."]));
  flow.appendChild(h("div", { class: "f-actions" }, [h("a", { class: "btn sm", href: "#lesson" }, ["Open Level 0"]), h("a", { class: "notnow", href: "#prices" }, ["See Pro, $7.99 founding"])]));
  head.focus();
}
function renderGift(out, g, n) {
  clear(out);
  if (g.id === "alien") {
    var nameIn = h("input", { type: "text", id: "an" + n, maxlength: "24", autocomplete: "given-name", value: prog.name || "" });
    var bName = h("b", {}, [prog.name || "You"]);
    var img = h("img", { src: ALIEN[prog.colour] || ALIEN.blue, alt: "", width: "92", height: "149" });
    function upd() { prog.name = nameIn.value.trim().slice(0, 24); bName.textContent = prog.name || "You"; img.setAttribute("src", ALIEN[prog.colour] || ALIEN.blue); save(); renderLevels(); updateCert(); certIn.value = prog.name; }
    nameIn.addEventListener("input", upd);
    var colours = h("div", { class: "seg-pick", role: "radiogroup", "aria-label": "Colour" }, ["blue", "purple"].map(function (col) {
      var r = h("input", { type: "radio", name: "acol" + n, value: col }); r.checked = prog.colour === col;
      r.addEventListener("change", function () { prog.colour = col; upd(); });
      return h("label", { class: "chk" }, [r, h("span", {}, [cap(col)])]);
    }));
    out.appendChild(h("h4", {}, ["Your alien is ready."]));
    out.appendChild(h("div", { class: "f-actions" }, [img, h("div", {}, [h("label", { class: "f-l", for: "an" + n }, ["Name on its badge"]), nameIn, colours, h("p", { class: "small" }, [h("span", { class: "coach-badge" }, ["Alien level " + (levelOf(prog.pts) + 1) + " · " + LEVELS[levelOf(prog.pts)][1]]), " ", bName])])]));
    out.appendChild(h("p", { class: "small" }, ["It shows up in your levels panel on this page right away."]));
  } else {
    out.appendChild(h("h4", {}, [g.t + ": on its way."]));
    out.appendChild(h("p", {}, ["We make this one for you and send it with your confirmed email. Pre-launch, so it can take a little while."]));
  }
}

/* ---------- checkout dialog (preview: no payment is taken) ---------- */
var INSIDER = "Insiders get first access to new features, products and prices, sneak peeks by email, and notes from the build room.";
var TIERS = {
  pro: { n: "Pro", get: ["Your role brief every weekday", "The full hourly radio-style brief", "Three lanes full text, full rumor and fact detail"], list: "$9.99/mo", found: "$7.99/mo", yr: "$99/yr at launch, $79/yr founding", save: "$2/mo · $24/yr · 20%", dep: "$9.99" },
  max: { n: "MAX", get: ["Everything in Pro, every lane full text", "Morning and evening deep dives (learning, no news)", "All 24 white papers and the member forum"], list: "$19.99/mo", found: "$14.99/mo", yr: "$199/yr at launch, $149/yr founding", save: "$5/mo · $60/yr · 25%", dep: "$29" },
  ultra: { n: "Ultra", get: ["Everything in MAX", "Training by job title, FDE first, with level certificates", "The 21-book library, the full Defense Playbook and the insider circle"], list: "$99.99/mo", found: "$69.99/mo", yr: "$999/yr at launch, $699/yr founding", save: "$30/mo · $360/yr · 30%", dep: "$99" }
};
var dlg = $("#checkout"), lastBtn = null;
function openDlg() { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
function closeDlg() { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
function fill(T) {
  var g = clear($("#coGet")); T.get.forEach(function (x) { g.appendChild(h("li", {}, [x])); });
  $("#coStatus").textContent = "";
}
$$(".js-reserve").forEach(function (b) {
  b.addEventListener("click", function () {
    var T = TIERS[b.getAttribute("data-tier")]; lastBtn = b; fill(T);
    $("#co-h").textContent = "Reserve " + T.n;
    var pr = clear($("#coPrice"));
    pr.appendChild(document.createTextNode("Launch price " + T.list + " · founding ")); pr.appendChild(h("b", {}, [T.found]));
    pr.appendChild(document.createTextNode(", locked while you stay subscribed")); pr.appendChild(h("br")); pr.appendChild(h("span", { class: "small" }, [T.yr]));
    $("#coSave").textContent = T.save;
    $("#coPay").textContent = "Reserve for " + T.dep;
    $("#coRefund").textContent = "4. Refundable on request before launch only. This " + T.dep + " deposit reserves the founding price; it is not a subscription payment. The price shown is the price you pay at checkout.";
    $("#coInsider").textContent = INSIDER; $("#coInsider").hidden = false;
    openDlg();
  });
});
$(".js-buy").addEventListener("click", function () {
  lastBtn = this; fill({ get: ["100-page PDF", "The full audio version", "Delivered right away"] });
  $("#co-h").textContent = "Buy the AI-Era Defense Playbook";
  clear($("#coPrice")).appendChild(h("b", {}, ["$49"])); $("#coPrice").appendChild(document.createTextNode(", one-time purchase, all-in"));
  $("#coSave").textContent = "No discount. It's a finished product at its normal price.";
  $("#coPay").textContent = "Buy for $49";
  $("#coRefund").textContent = "4. A finished digital product, delivered right away. See the refund terms before you pay.";
  $("#coInsider").hidden = true;
  openDlg();
});
$("#coPay").addEventListener("click", function () { $("#coStatus").textContent = "Preview build: Stripe's hosted checkout (test mode first) connects here. No payment was taken."; });
$("#coClose").addEventListener("click", closeDlg);
dlg.addEventListener("close", function () { if (lastBtn) lastBtn.focus(); });

/* ---------- boot ---------- */
renderLevels(); updateCert(); renderStreak();
})();
