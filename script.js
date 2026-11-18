/* =====================================================================
   B.P.R.D. Case File XT-1026 — script.js
   Loaded with `defer` by system.html, index.html and classified.html,
   so every HTML element already exists when this code runs.

   1. Lighting: room lights (terminal) and desk lamp + flashlight (dossier)
   2. Records Terminal: three-step sign-in, fruit picker, knight's mate
   3. Field agent's pen: random fact generator   (dossier pages)
   4. Clipboard page turning                     (dossier pages)
   ===================================================================== */


/* ---------- Shared helpers ---------- */

// Browser storage can be blocked (private windows, strict settings),
// so every read and write is wrapped and simply does nothing if it fails.
function readStored(key, store = "local") {
  try { return window[store + "Storage"].getItem(key); } catch (error) { return null; }
}

function writeStored(key, value, store = "local") {
  try { window[store + "Storage"].setItem(key, value); } catch (error) { /* not saved */ }
}

const isTerminal = document.querySelector(".terminal") !== null;
const isDossier = document.querySelector(".stack") !== null;
const root = document.documentElement;


/* =====================================================================
   1. Lighting
   Terminal: "Room lights" switch, dark by default, remembered.
   Dossier: the desk lamp starts OFF at the start of every visit, and a
   flashlight follows the mouse until the visitor finds the lamp switch.
   Touch screens have no mouse to aim with, so there the lamp starts ON.
   Switching the lamp on turns the flashlight off.
   ===================================================================== */

const lampSwitch = document.getElementById("lamp-switch");
const lampState = document.getElementById("lamp-state");
const isTouchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// Where each page keeps its light setting
const lightKey = isTerminal ? "bprd-room-lights" : "bprd-desk-lamp";
const lightStore = isTerminal ? "local" : "session";     // lamp resets each visit
const defaultTheme = isTerminal || !isTouchOnly ? "dark" : "light";

function applyTheme(theme) {
  root.classList.toggle("theme-dark", theme === "dark");
  root.classList.toggle("theme-light", theme === "light");

  if (lampSwitch) {
    // The switch is "pressed" (on) when the room is lit
    lampSwitch.setAttribute("aria-pressed", String(theme === "light"));
    lampState.textContent = theme === "dark" ? "Off" : "On";
  }
}

let currentTheme = readStored(lightKey, lightStore) || defaultTheme;
applyTheme(currentTheme);

if (lampSwitch) {
  lampSwitch.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(currentTheme);
    writeStored(lightKey, currentTheme, lightStore);
  });
}

// Flashlight: the dark layer in style.css has a hole at --mx / --my
if (isDossier) {
  root.classList.add("flashlight-away");          // dark until the mouse moves

  document.addEventListener("pointermove", (event) => {
    if (currentTheme !== "dark") return;          // lamp on: no flashlight
    root.style.setProperty("--mx", event.clientX + "px");
    root.style.setProperty("--my", event.clientY + "px");
    root.classList.remove("flashlight-away");
  });

  // Mouse leaves the window: the beam goes with it
  root.addEventListener("pointerleave", () => root.classList.add("flashlight-away"));
}


/* =====================================================================
   2. Records Terminal sign-in
   Check 1: type an agent name and AUTHENTICATE (or press Enter).
   Check 2: tick "I am not a robot".
   Check 3: OPEN CASE FILE opens two visual checks in turn:
            select the 4 oranges among 5 look-alike apples, then
            checkmate in one with a knight (hint after 3 failed tries).
   Only after all of that is the agent's clearance saved and the case
   file opened. Nothing moves on to the next step by itself.
   ===================================================================== */

// Cleared earlier in this visit? (gate.js checks the same value)
let isCleared = Boolean(readStored("bprd-agent", "session"));

const loginForm = document.getElementById("login-form");

if (loginForm) {
  const nameInput = document.getElementById("agent-name-input");
  const loginMessage = document.getElementById("login-message");
  const humanBox = document.getElementById("human-box");
  const openFile = document.getElementById("open-file");

  // Progress through the three checks
  const checks = { agentName: "", authenticated: false, human: false };

  function showLoginMessage(text, kind) {
    loginMessage.textContent = text;
    loginMessage.classList.toggle("is-error", kind === "error");
    loginMessage.classList.toggle("is-success", kind === "ok");
  }

  function resetHumanBox() {
    checks.human = false;
    humanBox.classList.remove("is-checked", "is-loading");
    humanBox.setAttribute("aria-checked", "false");
    openFile.classList.add("is-hidden");
  }

  /* ----- Check 1: agent name ----- */
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();                 // stay on this page
    const agentName = nameInput.value.trim();

    if (agentName === "") {
      // Validation: nothing (or only spaces) was entered
      showLoginMessage("ACCESS DENIED: agent name required.", "error");
      nameInput.setAttribute("aria-invalid", "true");
      nameInput.focus();
      return;
    }

    checks.agentName = agentName;
    checks.authenticated = true;
    nameInput.removeAttribute("aria-invalid");
    // textContent (not innerHTML) so typed text is always shown as plain text
    showLoginMessage(checks.human
      ? `Welcome back, Agent ${agentName}. Open the case file when ready.`
      : `Welcome back, Agent ${agentName}. Confirm you are human to continue.`, "ok");
  });

  nameInput.addEventListener("input", () => {
    nameInput.removeAttribute("aria-invalid");
    if (checks.authenticated && nameInput.value.trim() !== checks.agentName) {
      // A different name has to go through the checks again
      checks.authenticated = false;
      resetHumanBox();
      showLoginMessage("Name changed. Authenticate again.");
    } else if (loginMessage.classList.contains("is-error")) {
      showLoginMessage("");
    }
  });

  /* ----- Check 2: "I am not a robot" ----- */
  humanBox.addEventListener("click", () => {
    if (checks.human || humanBox.classList.contains("is-loading")) return;
    if (!checks.authenticated) {
      showLoginMessage("ACCESS DENIED: authenticate your agent name first.", "error");
      nameInput.focus();
      return;
    }
    humanBox.classList.add("is-loading");
    showLoginMessage("Checking…");
    setTimeout(() => {
      humanBox.classList.remove("is-loading");
      humanBox.classList.add("is-checked");
      humanBox.setAttribute("aria-checked", "true");
      checks.human = true;
      openFile.classList.remove("is-hidden");
      showLoginMessage("Humanity confirmed. Case file XT-1026 is ready.", "ok");
    }, 900);
  });

  /* ----- Check 3: open the case file -> visual checks ----- */
  openFile.addEventListener("click", () => {
    if (isCleared) {                        // already cleared this visit
      window.location.href = "index.html";
      return;
    }
    if (checks.authenticated && checks.human) openFruit();
  });

  // Returning later in the same visit: clearance is already on file
  if (isCleared) {
    showLoginMessage(`Clearance on file for Agent ${readStored("bprd-agent", "session")}.`, "ok");
    openFile.classList.remove("is-hidden");
  }

  /* ----- Case links: locked until cleared; directory links always locked ----- */
  const caseLinks = document.querySelectorAll('a[href^="index.html"], a[href^="classified.html"]');

  caseLinks.forEach((link) => {
    const alwaysLocked = link.closest("#directory") !== null;

    link.addEventListener("click", (event) => {
      if (isCleared && !alwaysLocked) return;   // cleared: open the file
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

      showLoginMessage(isCleared
        ? "ACCESS DENIED: directory links are locked. Use OPEN CASE FILE XT-1026 above."
        : "ACCESS DENIED: complete the agent checks to open case files.", "error");
      if (!isCleared) nameInput.focus();
    });
  });

  // Sent here from a case file page without clearance
  if (window.location.hash === "#clearance-required" && !isCleared) {
    showLoginMessage("CLEARANCE REQUIRED: complete the agent checks to open case files.", "error");
  }

  /* ----- Shared helpers for the two challenge windows ----- */
  function openWindow(wrap, focusTarget) {
    wrap.classList.remove("is-hidden");
    if (focusTarget) focusTarget.focus();
  }

  function closeWindow(wrap) {
    wrap.classList.add("is-hidden");
    openFile.focus();
  }

  function shake(card) {
    card.classList.remove("shake");
    void card.offsetWidth;                  // restart the animation
    card.classList.add("shake");
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /* ===== Visual check 1: select the oranges ===== */
  const fruitWrap = document.getElementById("fruit-wrap");
  const fruitCard = document.getElementById("fruit-card");
  const fruitGrid = document.getElementById("fruit-grid");
  const fruitMsg = document.getElementById("fruit-msg");

  const orangePhotos = [1, 2, 3, 4, 5, 6].map((n) => `images/captcha/orange-${n}.jpg`);
  const applePhotos = [1, 2, 3, 4, 5, 6].map((n) => `images/captcha/apple-${n}.jpg`);
  const fruit = { tiles: [], selected: new Set(), attempts: 0 };

  function buildFruitGrid() {
    // 4 of the 6 orange photos and 5 of the 6 apple photos, shuffled together
    fruit.tiles = shuffle([
      ...shuffle(orangePhotos).slice(0, 4).map((src) => ({ kind: "orange", src })),
      ...shuffle(applePhotos).slice(0, 5).map((src) => ({ kind: "apple", src }))
    ]);
    fruit.selected.clear();

    fruitGrid.innerHTML = "";               // remove the previous tiles
    fruit.tiles.forEach((tile, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tile";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Image ${index + 1}`);
      const img = document.createElement("img");
      img.src = tile.src;
      img.alt = "";
      button.appendChild(img);
      button.addEventListener("click", () => {
        if (fruit.selected.has(index)) fruit.selected.delete(index);
        else fruit.selected.add(index);
        button.setAttribute("aria-pressed", String(fruit.selected.has(index)));
        fruitMsg.textContent = "";
      });
      fruitGrid.appendChild(button);
    });
  }

  function openFruit() {
    buildFruitGrid();
    fruitMsg.textContent = "";
    fruitMsg.className = "challenge-msg";
    openWindow(fruitWrap, fruitGrid.querySelector(".tile"));
  }

  document.getElementById("fruit-new").addEventListener("click", buildFruitGrid);

  document.getElementById("fruit-verify").addEventListener("click", () => {
    if (fruit.selected.size === 0) {
      fruitMsg.textContent = "Please select all images with oranges.";
      return;
    }
    const picked = [...fruit.selected].map((index) => fruit.tiles[index].kind);
    const apples = picked.filter((kind) => kind === "apple").length;
    const oranges = picked.length - apples;

    if (apples > 0 || oranges < 4) {
      fruit.attempts++;
      fruitMsg.textContent = apples
        ? `${apples} of those ${apples === 1 ? "is an apple" : "are apples"}. Try again.`
        : "You missed some oranges. Try again.";
      shake(fruitCard);
      setTimeout(buildFruitGrid, 900);      // new pictures for the next try
      return;
    }

    fruitMsg.textContent = "Correct.";
    fruitMsg.classList.add("is-ok");
    setTimeout(() => {
      fruitWrap.classList.add("is-hidden");
      showLoginMessage("Visual check passed. One final check…", "ok");
      openChess();
    }, 500);
  });

  /* ===== Visual check 2: checkmate in one with a knight ===== */
  // Position checked with a chess engine: White to move, and Knight e5 to f7
  // (a smothered mate) is the only checkmate in one on the board.
  const START = {
    a8: "bR", c8: "bB", g8: "bR", h8: "bK",
    a7: "bP", b7: "bP", g7: "bP", h7: "bP",
    b6: "bQ", e5: "wN", d4: "wN",
    a2: "wP", b2: "wP", f2: "wP", g2: "wP", h2: "wP",
    c1: "wB", d1: "wR", g1: "wK"
  };
  const GLYPHS = { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F" };
  const NAMES = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };
  const FILES = "abcdefgh";
  const MATE = { from: "e5", to: "f7" };
  const HINT_AFTER = 3;                     // failed attempts before the hint
  const WRONG_MOVES = {
    "e5-g6": "Check, but the h7 pawn (or the queen) captures the knight. Try again.",
    "e5-d7": "That attacks the queen, but it isn't check. Try again."
  };

  const chessWrap = document.getElementById("chess-wrap");
  const chessCard = document.getElementById("chess-card");
  const boardEl = document.getElementById("board");
  const chessMsg = document.getElementById("chess-msg");
  const chess = { board: {}, selected: null, solved: false, failures: 0 };

  function knightTargets(square) {
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    const jumps = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    return jumps
      .map(([df, dr]) => [file + df, rank + dr])
      .filter(([f, r]) => f >= 0 && f < 8 && r >= 1 && r <= 8)
      .map(([f, r]) => FILES[f] + r)
      .filter((target) => !(chess.board[target] || "").startsWith("w"));
  }

  function drawBoard() {
    boardEl.innerHTML = "";                 // rebuild all 64 squares
    for (let rank = 8; rank >= 1; rank--) {
      for (let f = 0; f < 8; f++) {
        const square = FILES[f] + rank;
        const piece = chess.board[square];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "sq " + ((f + rank) % 2 ? "sq-dark" : "sq-light");   // a1 is dark
        cell.dataset.sq = square;
        if (rank === 1) cell.dataset.file = FILES[f];
        if (f === 0) cell.dataset.rank = rank;
        cell.setAttribute("aria-label", square + (piece
          ? ` ${piece[0] === "w" ? "white" : "black"} ${NAMES[piece[1]]}` : ""));

        if (piece) {
          const glyph = document.createElement("span");
          glyph.className = "piece " + (piece[0] === "w" ? "white" : "black");
          glyph.textContent = GLYPHS[piece[1]];
          cell.appendChild(glyph);
        }
        if (piece === "wN" && !chess.solved) {
          cell.classList.add("movable");
          cell.draggable = true;
        }
        if (square === MATE.from && piece === "wN" && !chess.solved && chess.failures >= HINT_AFTER) {
          cell.classList.add("hint");
        }
        if (chess.selected === square) cell.classList.add("selected");
        if (chess.selected && knightTargets(chess.selected).includes(square)) {
          cell.classList.add("target");
          if (piece) cell.classList.add("capture");
          const dot = document.createElement("span");
          dot.className = "dot";
          cell.appendChild(dot);
        }
        boardEl.appendChild(cell);
      }
    }
  }

  function showHint() {
    chessMsg.className = "challenge-msg is-hint";
    chessMsg.textContent = "Hint: the glowing knight delivers the mate. Where can it attack the king?";
  }

  function openChess() {
    chess.board = { ...START };
    chess.selected = null;
    chess.solved = false;
    chessMsg.className = "challenge-msg";
    chessMsg.textContent = "";
    drawBoard();
    if (chess.failures >= HINT_AFTER) showHint();
    openWindow(chessWrap, boardEl.querySelector(".movable"));
  }

  function tryMove(from, to) {
    if (chess.solved || chess.board[from] !== "wN" || !knightTargets(from).includes(to)) return;
    chess.board[to] = "wN";                 // show the move on the board
    delete chess.board[from];
    chess.selected = null;

    if (from === MATE.from && to === MATE.to) {
      chess.solved = true;
      drawBoard();
      boardEl.querySelector('[data-sq="h8"]').classList.add("mated");
      chessMsg.className = "challenge-msg is-ok";
      chessMsg.textContent = "Nf7#. Smothered mate. Clearance granted.";

      // All checks passed: save clearance for this visit and open the file
      writeStored("bprd-agent", checks.agentName, "session");
      isCleared = true;
      setTimeout(() => {
        chessWrap.classList.add("is-hidden");
        showLoginMessage(`ACCESS GRANTED. Opening case file XT-1026, Agent ${checks.agentName}…`, "ok");
        setTimeout(() => { window.location.href = "index.html"; }, 900);
      }, 1400);
      return;
    }

    chess.failures++;
    drawBoard();
    boardEl.querySelector(`[data-sq="${to}"]`).classList.add("wrong");
    chessMsg.className = "challenge-msg";
    chessMsg.textContent = WRONG_MOVES[`${from}-${to}`] || "That isn't checkmate. Try again.";
    shake(chessCard);
    setTimeout(() => {                      // put the knight back
      chess.board = { ...START };
      drawBoard();
      if (chess.failures >= HINT_AFTER) showHint();
    }, 1200);
  }

  // Click a knight, then click one of its highlighted squares
  boardEl.addEventListener("click", (event) => {
    const cell = event.target.closest(".sq");
    if (!cell || chess.solved) return;
    const square = cell.dataset.sq;
    if (chess.board[square] === "wN") {
      chess.selected = chess.selected === square ? null : square;
      drawBoard();
      boardEl.querySelector(`[data-sq="${square}"]`).focus();
    } else if (chess.selected) {
      tryMove(chess.selected, square);
    }
  });

  // Or drag a knight onto a square
  boardEl.addEventListener("dragstart", (event) => {
    const cell = event.target.closest(".sq");
    if (!cell || chess.board[cell.dataset.sq] !== "wN") return;
    event.dataTransfer.setData("text/plain", cell.dataset.sq);
    chess.selected = cell.dataset.sq;
    setTimeout(drawBoard, 0);               // show its target squares
  });

  boardEl.addEventListener("dragover", (event) => {
    const cell = event.target.closest(".sq");
    if (cell && chess.selected && knightTargets(chess.selected).includes(cell.dataset.sq)) {
      event.preventDefault();               // allow dropping here
      boardEl.querySelectorAll(".drag-over").forEach((c) => c.classList.remove("drag-over"));
      cell.classList.add("drag-over");
    }
  });

  boardEl.addEventListener("drop", (event) => {
    event.preventDefault();
    const cell = event.target.closest(".sq");
    const from = event.dataTransfer.getData("text/plain");
    if (cell && from) tryMove(from, cell.dataset.sq);
  });

  boardEl.addEventListener("dragend", () => {
    if (!chess.solved && chess.selected) {
      chess.selected = null;
      drawBoard();
    }
  });

  document.getElementById("chess-reset").addEventListener("click", openChess);

  // Escape closes either challenge window (the checks restart from OPEN CASE FILE)
  [fruitWrap, chessWrap].forEach((wrap) => {
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeWindow(wrap);
    });
  });
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
