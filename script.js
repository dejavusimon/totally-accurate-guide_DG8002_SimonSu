/* =====================================================================
   B.P.R.D. Case File XT-1026 — script.js
   Loaded with `defer` by system.html, index.html and classified.html,
   so every HTML element already exists when this code runs.

   1. Desk lamp: light / dark theme toggle      (all pages)
   2. Agent greeting with validation             (Records Terminal)
   3. Field agent's pen: random fact generator   (dossier pages)
   4. Clipboard page turning                     (dossier pages)
   ===================================================================== */


/* ---------- Shared helpers ---------- */

// Browser storage can be blocked (private windows, strict settings),
// so every read and write is wrapped and simply does nothing if it fails.
function readStored(key) {
  try { return localStorage.getItem(key); } catch (error) { return null; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, value); } catch (error) { /* not saved */ }
}

const isTerminal = document.body.classList.contains("terminal-page") ||
                   document.querySelector(".terminal") !== null;
const isDossier = document.querySelector(".stack") !== null;


/* =====================================================================
   1. Desk lamp: light / dark theme
   The dossier is naturally lit (light) and the terminal is naturally dark.
   Clicking the switch adds or removes a theme class on <html>; style.css
   and terminal.css restyle everything from that one class. The choice is
   remembered, so it carries across all three pages.
   ===================================================================== */

const lampSwitch = document.getElementById("lamp-switch");
const lampState = document.getElementById("lamp-state");
const defaultTheme = isTerminal ? "dark" : "light";

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("theme-dark", theme === "dark");
  root.classList.toggle("theme-light", theme === "light");

  if (lampSwitch) {
    // The switch is "pressed" (on) when the room is lit
    lampSwitch.setAttribute("aria-pressed", String(theme === "light"));
    lampState.textContent = theme === "dark" ? "Off" : "On";
  }
}

let currentTheme = readStored("bprd-theme") || defaultTheme;
applyTheme(currentTheme);

if (lampSwitch) {
  lampSwitch.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(currentTheme);
    writeStored("bprd-theme", currentTheme);
  });
}


/* =====================================================================
   2. Agent greeting (Records Terminal)
   Reads the name typed into the login form, refuses blank entries,
   and greets the agent on the page without reloading.
   ===================================================================== */

const loginForm = document.getElementById("login-form");

// Signed in during this visit? (also remembered for the other pages)
let isAuthenticated = false;
try { isAuthenticated = Boolean(sessionStorage.getItem("bprd-agent")); } catch (error) { /* no */ }

if (loginForm) {
  const nameInput = document.getElementById("agent-name-input");
  const loginMessage = document.getElementById("login-message");
  const openFile = document.getElementById("open-file");

  function showLoginError(message) {
    loginMessage.textContent = message;
    loginMessage.classList.add("is-error");
    loginMessage.classList.remove("is-success");
    nameInput.setAttribute("aria-invalid", "true");
  }

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();                 // stay on this page
    const agentName = nameInput.value.trim();

    if (agentName === "") {
      // Validation: nothing (or only spaces) was entered
      showLoginError("ACCESS DENIED: agent name required.");
      openFile.classList.add("is-hidden");
      nameInput.focus();
      return;
    }

    // textContent (not innerHTML) so typed text is always shown as plain text
    loginMessage.textContent = `ACCESS GRANTED. Welcome back, Agent ${agentName}. Case file XT-1026 is unlocked.`;
    loginMessage.classList.add("is-success");
    loginMessage.classList.remove("is-error");
    nameInput.removeAttribute("aria-invalid");
    openFile.classList.remove("is-hidden");
    isAuthenticated = true;

    // Remember the name for this visit, so the dossier pages let them in
    try { sessionStorage.setItem("bprd-agent", agentName); } catch (error) { /* not saved */ }
  });

  // Clear the error as soon as they start typing again
  nameInput.addEventListener("input", () => {
    loginMessage.classList.remove("is-error");
    nameInput.removeAttribute("aria-invalid");
  });

  // Case file links refuse to open until the agent has signed in
  const caseLinks = document.querySelectorAll('a[href^="index.html"], a[href^="classified.html"]');

  caseLinks.forEach((link) => {
    // The Case Directory's OPEN FILE / OPEN ANNEX links are always locked;
    // signed-in agents enter through "OPEN CASE FILE XT-1026" instead.
    const alwaysLocked = link.closest("#directory") !== null;

    link.addEventListener("click", (event) => {
      if (isAuthenticated && !alwaysLocked) return;   // signed in: open the file
      event.preventDefault();

      // The link itself reads ACCESS DENIED for a moment
      if (!link.dataset.label) link.dataset.label = link.textContent;
      link.textContent = "ACCESS DENIED";
      link.classList.add("is-denied");
      clearTimeout(link.resetTimer);
      link.resetTimer = setTimeout(() => {
        link.textContent = link.dataset.label;
        link.classList.remove("is-denied");
      }, 1800);

      if (isAuthenticated) {
        showLoginError("ACCESS DENIED: directory links are locked. Use OPEN CASE FILE XT-1026 above.");
        nameInput.removeAttribute("aria-invalid");
      } else {
        showLoginError("ACCESS DENIED: enter your agent name to open case files.");
        nameInput.focus();
      }
    });
  });

  // Sent here from a case file page without signing in
  if (window.location.hash === "#clearance-required" && !isAuthenticated) {
    showLoginError("CLEARANCE REQUIRED: enter your agent name to open case files.");
    nameInput.removeAttribute("aria-invalid");
  }
}

// Classified Annex: show the signed-in agent's name in the access banner
const agentNameSlot = document.getElementById("agent-name");
if (agentNameSlot) {
  let savedAgent = null;
  try { savedAgent = sessionStorage.getItem("bprd-agent"); } catch (error) { /* none */ }
  if (savedAgent) {
    agentNameSlot.textContent = savedAgent;
  }
}


/* =====================================================================
   3. Field agent's pen: random fact generator
   Every fact about the subject is tagged with the page(s) it relates to.
   Each click picks a random fact for the page being read, and the field
   agent writes it into that page's "Agent annotation" strip.
   ===================================================================== */

const subjectFacts = [
  // Page 1: identification card
  { pages: [1], text: "Cover identity checks out. Really is enrolled in a Master of Digital Media." },
  { pages: [1], text: "Speaks English and Mandarin fluently. The alias may have a second spelling." },
  // Page 2: surveillance photo
  { pages: [2], text: "Runs a photo booth business. Knows exactly where our camera was." },
  { pages: [2], text: "Has photographed hundreds of humans through his booth. Legally." },
  // Page 3: introduction, odd working hours
  { pages: [3], text: "Builds his own apps at night: a budget tracker, a cooking journal, a word book." },
  { pages: [3], text: "Studied industrial design first. Then moved on to screens." },
  // Page 4: Shelter Engineer who designed doors, seats and lamps
  { pages: [4], text: "On Earth: industrial design lead for nearly six years. Doors, seats, lamps. Confirmed." },
  { pages: [4], text: "Holds a bachelor's degree in industrial design. The Kethri would approve." },
  // Page 5: the Comfort Incident, exile, grad school
  { pages: [5], text: "Left his design job in December 2025 to go back to school. Pattern repeating." },
  { pages: [5], text: "Eight years of designing products people kept using. Comfort risk: moderate." },
  // Page 6: known abilities
  { pages: [6], text: "Rapid prototyping confirmed: wired an Arduino to Wi-Fi to move a servo. For fun." },
  { pages: [6], text: "Built a flash-card dictionary app to collect new words. Self-improving." },
  // Page 7: threat assessment (interest in Earth food: 10/10)
  { pages: [7], text: "Built a bilingual cooking app to log what he eats. Food rating justified." },
  { pages: [7], text: "Tracks household spending in a budget app he wrote himself." },
  // Page 8: end of the Public Brief
  { pages: [8], text: "Built his own daily news dashboard. Probably knows this file exists." },
  { pages: [8], text: "Self-hosts his own AI tools at home. Recommend Level 5 encryption." },
  // Page 9: technically very old
  { pages: [9], text: "Eight years as a designer in Earth time. About 260 Proxima years." },
  { pages: [9], text: "Speaks two Earth languages. Three, counting Kethri." },
  // Page 10: Toronto winters, rearranging rooms
  { pages: [10], text: "Calls Toronto home. Has never complained about February in our presence." },
  { pages: [10], text: "Trained industrial designer. Rearranging rooms is a professional reflex." },
  // Page 11: survival guide (late meetings, keep him fed)
  { pages: [11], text: "Home terminal: a gaming PC with an ultrawide screen. Late meetings explained." },
  { pages: [11], text: "Cooks enough to have built an app about it. Dumplings remain the safest offer." },
  // Page 12: weaknesses (badly designed objects)
  { pages: [12], text: "Eight years of design training. Bad door handles cause him real pain." },
  { pages: [12], text: "Sells 3D models online. Will notice if your product photos are badly lit." },
  // Page 13: future ambitions
  { pages: [13], text: "Currently seeking product design and product manager roles. Theory C gains support." },
  { pages: [13], text: "Joined a university mentorship program. Building Earth alliances." },
  // Page 14: homeworld drawing, corrected 14 times
  { pages: [14], text: "Sculpts 3D characters and sells them online. The corrections were professional." },
  { pages: [14], text: "Designs in 3D most days. The Bureau artist has asked for lessons." },
  // Page 15: external intelligence
  { pages: [15], text: "Reads comics and speculative fiction. Calls it field research." },
  { pages: [15], text: "Follows performance art. Analysts suspect the Comfort Incident was one." }
];

const pen = document.getElementById("pen");
const lastFactOnPage = {};                 // remembers each page's last note

// Gives every sheet an empty annotation strip at the bottom (DOM creation)
function addAnnotationStrips() {
  document.querySelectorAll(".sheet").forEach((sheet) => {
    const strip = document.createElement("div");
    strip.className = "annotation";

    const label = document.createElement("p");
    label.className = "annotation-label";
    label.textContent = "Agent annotation:";

    const note = document.createElement("p");
    note.className = "annotation-text";

    strip.append(label, note);
    sheet.appendChild(strip);
  });
}

// Reads the page number printed on a sheet ("Page 9 of 15" -> 9)
function getPageNumber(sheet) {
  const label = sheet.querySelector(".page-no").textContent;
  return Number(label.match(/\d+/)[0]);
}

// Picks a random fact for this page, never the same one twice in a row
function pickFactFor(pageNumber) {
  let choices = subjectFacts.filter((fact) => fact.pages.includes(pageNumber));
  if (choices.length === 0) {
    choices = subjectFacts;                 // no page-specific facts: use any
  }
  if (choices.length > 1) {
    choices = choices.filter((fact) => fact.text !== lastFactOnPage[pageNumber]);
  }
  const fact = choices[Math.floor(Math.random() * choices.length)];
  lastFactOnPage[pageNumber] = fact.text;
  return fact.text;
}

function writeFact() {
  const sheet = getReadingSheet();
  if (!sheet) return;

  const note = sheet.querySelector(".annotation-text");
  note.textContent = pickFactFor(getPageNumber(sheet));

  // Restart the "being written" animation on every click
  note.classList.remove("is-writing");
  void note.offsetWidth;                    // forces the browser to notice the reset
  note.classList.add("is-writing");

  pen.classList.remove("is-scribbling");
  void pen.offsetWidth;
  pen.classList.add("is-scribbling");
}

if (isDossier) {
  addAnnotationStrips();
  pen.addEventListener("click", writeFact);
}


/* =====================================================================
   4. Clipboard page turning
   On tablet and desktop screens the sheets sit stacked on the clipboard.
   Scrolling, arrow keys, Page Up/Down, Space and swipes flip the top
   sheet up over the clip (an .is-flipped class; CSS animates it).
   Scrolling stops at page 8: the Annex opens only from the "Request
   clearance" link. Scrolling up from page 9 returns to the Brief. On phones the sheets
   are laid out as a normal scrolling page instead.
   ===================================================================== */

const sheets = Array.from(document.querySelectorAll(".sheet"));
const clipboardQuery = window.matchMedia("(min-width: 760px) and (min-height: 560px)");
const isAnnex = document.body.id === "page-classified";

let currentSheet = 0;
let isLeaving = false;

// Which sheet is the reader looking at? (used by the pen)
function getReadingSheet() {
  if (clipboardQuery.matches) {
    return sheets[currentSheet];
  }
  // Phone layout: the sheet crossing the middle of the screen
  const middle = window.innerHeight / 2;
  return sheets.find((sheet) => {
    const box = sheet.getBoundingClientRect();
    return box.top <= middle && box.bottom >= middle;
  }) || sheets[0];
}

// Applies the current page to every sheet
function showSheet(index) {
  currentSheet = Math.max(0, Math.min(index, sheets.length - 1));
  const onClipboard = clipboardQuery.matches;

  sheets.forEach((sheet, i) => {
    sheet.style.zIndex = String(sheets.length - i);         // page 1 on top
    sheet.classList.toggle("is-flipped", onClipboard && i < currentSheet);
    sheet.classList.toggle("is-current", onClipboard && i === currentSheet);
    sheet.classList.toggle("is-under", onClipboard && i > currentSheet);
    // Pages flipped away or hidden underneath can't be tabbed into
    sheet.inert = onClipboard && i !== currentSheet;
  });
}

function nextPage() {
  // Stops at the last sheet. The Annex (pages 9-15) is never reached by
  // scrolling: only the "Request clearance" link on page 8 opens it.
  if (currentSheet < sheets.length - 1) {
    showSheet(currentSheet + 1);
  }
}

function previousPage() {
  if (currentSheet > 0) {
    showSheet(currentSheet - 1);
  } else if (isAnnex) {
    goTo("index.html#sheet-8");             // before page 9: back to the Brief
  }
}

function goTo(url) {
  if (isLeaving) return;
  isLeaving = true;
  window.location.href = url;
}

if (isDossier) {
  // Start on the page named in the address (e.g. index.html#sheet-8)
  const startMatch = window.location.hash.match(/^#sheet-(\d+)$/);
  showSheet(startMatch ? Number(startMatch[1]) - 1 : 0);

  // Turn on the flip transition only after the starting page is in place,
  // so opening the file on page 8 doesn't animate through pages 1-7.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add("js-ready"));
  });

  // Re-arrange when the window crosses the phone / clipboard breakpoint
  clipboardQuery.addEventListener("change", () => showSheet(currentSheet));

  // --- Mouse wheel and trackpad ---
  // One flick turns one page: after a turn, wheel input is ignored until it
  // has been quiet briefly, so trackpad momentum can't flip several pages.
  let wheelLockedUntil = 0;

  window.addEventListener("wheel", (event) => {
    if (!clipboardQuery.matches) return;     // phones scroll normally
    event.preventDefault();

    const now = Date.now();
    if (Math.abs(event.deltaY) < 4) return;
    if (now < wheelLockedUntil) {
      wheelLockedUntil = Math.max(wheelLockedUntil, now + 160);
      return;
    }

    if (event.deltaY > 0) {
      nextPage();
    } else {
      previousPage();
    }
    wheelLockedUntil = now + 750;
  }, { passive: false });

  // --- Keyboard ---
  window.addEventListener("keydown", (event) => {
    if (!clipboardQuery.matches) return;
    const typingTarget = event.target instanceof Element
      ? event.target.closest("input, textarea, button, a")
      : null;
    if (typingTarget && event.key === " ") return;   // Space still presses buttons

    if (["ArrowDown", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      nextPage();
    } else if (["ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      previousPage();
    } else if (event.key === "Home") {
      event.preventDefault();
      showSheet(0);
    } else if (event.key === "End") {
      event.preventDefault();
      showSheet(sheets.length - 1);
    }
  });

  // --- Touch swipes (tablets) ---
  let touchStartY = null;

  window.addEventListener("touchstart", (event) => {
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchend", (event) => {
    if (!clipboardQuery.matches || touchStartY === null) return;
    const distance = touchStartY - event.changedTouches[0].clientY;
    if (distance > 50) nextPage();           // swipe up = next page
    if (distance < -50) previousPage();      // swipe down = previous page
    touchStartY = null;
  });

  // A link to another page of the same file (e.g. #sheet-3)
  window.addEventListener("hashchange", () => {
    const match = window.location.hash.match(/^#sheet-(\d+)$/);
    if (match) showSheet(Number(match[1]) - 1);
  });

  // If the reader turns again before the flip between the two files has
  // finished, the browser cancels that animation. That's harmless, so the
  // cancellation is caught here instead of showing up as a console error.
  function ignoreCancelledFlip(event) {
    const transition = event.viewTransition;
    if (!transition) return;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
  }
  window.addEventListener("pageswap", ignoreCancelledFlip);
  window.addEventListener("pagereveal", ignoreCancelledFlip);

  // Coming back with the browser's Back button: allow leaving again
  window.addEventListener("pageshow", () => { isLeaving = false; });
}
