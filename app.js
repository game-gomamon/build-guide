/* ==========================================================================
   Etheria Restart — Build & GVG Database
   Vanilla JS. Everything on screen comes from data.json, which build.py
   generates from core_data.xlsx. Nothing here knows any Animus or team by
   name, so new rows in the workbook appear without touching this file.
   ========================================================================== */

(function () {
  "use strict";

  var DATA = null;
  var view = document.getElementById("view");

  /* ------------------------------------------------------------ helpers -- */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Empty cells never render as "undefined" — they render as an em dash. */
  function dash(value) {
    var text = value == null ? "" : String(value).trim();
    return text ? esc(text) : '<span class="dash">—</span>';
  }

  function has(value) {
    return value != null && String(value).trim() !== "";
  }

  function initials(name) {
    return String(name || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";
  }

  /** Picture with a graceful placeholder behind it. */
  function art(src, alt, fallbackText) {
    var ph = '<span class="ph" aria-hidden="true">' + esc(fallbackText || "") + "</span>";
    if (!has(src)) return ph;
    return ph + '<img class="art-img" src="' + esc(src) + '" alt="' + esc(alt || "") +
      '" loading="lazy" decoding="async">';
  }

  function icon(src, alt, size) {
    if (!has(src)) return '<span class="ph-mini" aria-hidden="true"></span>';
    return '<img src="' + esc(src) + '" alt="' + esc(alt || "") +
      '" loading="lazy" decoding="async"' + (size ? ' width="' + size + '" height="' + size + '"' : "") + ">";
  }

  function norm(text) {
    return String(text || "").toLowerCase().trim();
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  /** A picture that 404s hides itself and leaves the placeholder visible. */
  document.addEventListener("error", function (event) {
    var node = event.target;
    if (node && node.tagName === "IMG" && node.parentNode) {
      node.parentNode.classList.add("img-fail");
    }
  }, true);

  /* ----------------------------------------------------------- searching -- */

  function animusMatches(animus, query) {
    if (!query) return true;
    return norm(animus.name).indexOf(query) > -1 ||
      norm(animus.element).indexOf(query) > -1;
  }

  function teamMatches(team, query) {
    if (!query) return true;
    if (norm(team.name).indexOf(query) > -1) return true;
    if (norm(team.remark).indexOf(query) > -1) return true;
    return team.slots.some(function (slot) {
      return norm(slot.name).indexOf(query) > -1;
    });
  }

  function imprintMatches(imprint, query) {
    if (!query) return true;
    if (norm(imprint.name).indexOf(query) > -1) return true;
    if (norm(imprint.no).indexOf(query) > -1) return true;
    var inComponents = imprint.components.some(function (c) {
      return norm(c.name).indexOf(query) > -1 ||
        c.options.some(function (o) { return norm(o).indexOf(query) > -1; });
    });
    if (inComponents) return true;
    return imprint.animus.some(function (a) {
      return norm(a.name).indexOf(query) > -1;
    });
  }

  /* ------------------------------------------------------------- toolbar -- */

  function searchBox(id, placeholder, value) {
    return '' +
      '<div class="search">' +
      '<label class="sr-only" for="' + id + '">' + esc(placeholder) + "</label>" +
      '<input id="' + id + '" type="search" autocomplete="off" spellcheck="false" ' +
      'placeholder="' + esc(placeholder) + '" value="' + esc(value || "") + '">' +
      "</div>";
  }

  /* ------------------------------------------------------- view: builds -- */

  var buildsState = { query: "", element: "", showAll: false };

  function renderBuilds() {
    var query = norm(buildsState.query);
    var elements = Object.keys(DATA.elements).map(function (id) { return DATA.elements[id]; });

    var list = DATA.animus.filter(function (a) {
      if (!buildsState.showAll && !a.buildCount) return false;
      if (buildsState.element && a.element !== buildsState.element) return false;
      return animusMatches(a, query);
    });

    var chips = elements.map(function (el) {
      var on = buildsState.element === el.name;
      return '<button class="chip" type="button" data-element="' + esc(el.name) +
        '" data-filter="' + esc(el.name) + '" aria-pressed="' + on + '">' +
        (has(el.icon) ? '<img src="' + esc(el.icon) + '" alt="">' : "") +
        esc(el.name) + "</button>";
    }).join("");

    var withBuilds = DATA.meta.animusWithBuilds;

    view.innerHTML = '' +
      '<div class="page-head">' +
      '<p class="eyebrow">Section 01</p>' +
      "<h1>Animus Builds</h1>" +
      "<p>" + withBuilds + " Animus have a recommended build. Pick one to see its options.</p>" +
      "</div>" +

      '<div class="toolbar">' +
      searchBox("animus-search", "Search Animus by name or element…", buildsState.query) +
      '<div class="chips">' +
      '<button class="chip" type="button" data-filter="" aria-pressed="' + (!buildsState.element) + '">All</button>' +
      chips +
      "</div>" +
      '<button class="chip" type="button" data-toggle-all aria-pressed="' + buildsState.showAll + '">' +
      "Include Animus without builds</button>" +
      "</div>" +

      (list.length
        ? '<div class="roster">' + list.map(animusCard).join("") + "</div>"
        : '<p class="empty"><strong>No Animus matches that search.</strong>' +
          "Try a different name, or clear the element filter.</p>");

    var input = document.getElementById("animus-search");
    input.addEventListener("input", debounce(function () {
      buildsState.query = input.value;
      var atEnd = document.activeElement === input;
      renderBuilds();
      if (atEnd) {
        var next = document.getElementById("animus-search");
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
    }, 140));

    view.querySelectorAll("[data-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        buildsState.element = chip.getAttribute("data-filter");
        renderBuilds();
      });
    });

    var toggle = view.querySelector("[data-toggle-all]");
    toggle.addEventListener("click", function () {
      buildsState.showAll = !buildsState.showAll;
      renderBuilds();
    });
  }

  function animusCard(animus) {
    var count = animus.buildCount;
    var label = count === 1 ? "1 Build" : count + " Builds";
    return '' +
      '<a class="a-card" href="#build/' + encodeURIComponent(animus.id) + '"' +
      (has(animus.element) ? ' data-element="' + esc(animus.element) + '"' : "") + ">" +
      '<span class="a-count' + (count ? "" : " is-empty") + '">' +
      (count ? label : "No build") + "</span>" +
      (has(animus.elementIcon)
        ? '<img class="a-el" src="' + esc(animus.elementIcon) + '" alt="' + esc(animus.element) + '" loading="lazy">'
        : "") +
      '<span class="a-art">' + art(animus.card || animus.portrait, animus.name, initials(animus.name)) + "</span>" +
      '<span class="a-meta">' +
      '<span class="a-name">' + esc(animus.name) + "</span>" +
      (has(animus.element) ? '<span class="a-el-name">' + esc(animus.element) + "</span>" : "") +
      "</span></a>";
  }

  /* ------------------------------------------------------ view: profile -- */

  function renderProfile(animusId, optionId) {
    var animus = DATA.animus.filter(function (a) { return a.id === animusId; })[0];
    if (!animus) {
      view.innerHTML = '<a class="back-link" href="#builds">← All Animus</a>' +
        '<p class="empty"><strong>That Animus is not in the data.</strong>' +
        "It may have been renamed in core_data.xlsx.</p>";
      return;
    }

    var index = 0;
    if (optionId) {
      animus.builds.forEach(function (b, i) {
        if (String(b.option) === String(optionId)) index = i;
      });
    }

    var tabs = animus.builds.length > 1
      ? '<div class="options" role="tablist" aria-label="Build options">' +
        animus.builds.map(function (b, i) {
          return '<a class="opt" role="tab" href="#build/' + encodeURIComponent(animus.id) +
            "/" + encodeURIComponent(b.option) + '" aria-selected="' + (i === index) + '">' +
            "Option " + esc(b.option) + "</a>";
        }).join("") + "</div>"
      : "";

    view.innerHTML = '' +
      '<a class="back-link" href="#builds">← All Animus</a>' +
      '<div class="profile"' + (has(animus.element) ? ' data-element="' + esc(animus.element) + '"' : "") + ">" +

      '<div class="p-side">' +
      '<div class="p-art">' + art(animus.card || animus.portrait, animus.name, initials(animus.name)) + "</div>" +
      '<div class="p-id"><h1>' + esc(animus.name) + "</h1>" +
      (has(animus.element)
        ? '<span class="p-el">' + icon(animus.elementIcon, "") + esc(animus.element) + "</span>"
        : "") +
      "</div>" + tabs +
      "</div>" +

      '<div class="p-main">' +
      (animus.builds.length ? buildPanels(animus.builds[index]) : noBuildPanel()) +
      "</div></div>";
  }

  function noBuildPanel() {
    return '<div class="panel"><h2>Build</h2>' +
      "<p>No build has been added for this Animus yet. Add a row to the " +
      "<code>Build</code> sheet in core_data.xlsx and it will show up here.</p></div>";
  }

  function buildPanels(build) {
    return "" + skillPanel(build) + matrixPanel(build) + shellPanel(build) +
      statsPanel(build) + remarkPanel(build);
  }

  function skillPanel(build) {
    var parts = build.skillParts && build.skillParts.length ? build.skillParts : [];
    var boxes = parts.length
      ? parts.map(function (value, i) {
          return '<span class="skill-box">' + esc(value) +
            "<span>Skill " + (i + 1) + "</span></span>";
        }).join("")
      : '<span class="skill-box">—<span>SKILL</span></span>';
    return '<section class="panel"><h2>Recommended skill</h2>' +
      '<div class="skills">' + boxes + "</div></section>";
  }

  function matrixPanel(build) {
    if (!build.matrices.length) {
      return '<section class="panel"><h2>Matrix</h2><p class="dash">—</p></section>';
    }
    var rows = build.matrices.map(function (m) {
      var full = parseInt(m.full, 10);
      var fill = parseInt(m.fill, 10);
      var meter = "";
      if (full > 0) {
        var pips = "";
        for (var i = 0; i < full; i++) {
          pips += "<i" + (i < fill ? ' class="on"' : "") + "></i>";
        }
        meter = '<span class="meter" aria-hidden="true">' + pips + "</span>";
      }
      var value = has(m.fill)
        ? esc(m.fill) + (full > 0 ? ' <small>/ ' + esc(m.full) + "</small>" : "")
        : '<span class="dash">—</span>';
      return '<div class="matrix-row">' +
        '<span class="m-icon">' + art(m.icon, m.name, "") + "</span>" +
        "<span><span class=\"m-name\">" + dash(m.name) + "</span>" + meter + "</span>" +
        '<span class="m-fill">' + value + "</span></div>";
    }).join("");
    return '<section class="panel"><h2>Matrix &amp; fill</h2>' + rows + "</section>";
  }

  function shellPanel(build) {
    var shell = build.shell;
    var passives = build.passives.length
      ? build.passives.map(function (p) {
          return '<span class="passive">' + icon(p.icon, "") + esc(p.name) + "</span>";
        }).join("")
      : '<span class="dash">—</span>';
    return '<section class="panel"><h2>Shell</h2>' +
      '<div class="shell">' +
      '<span class="shell-art">' + art(shell && shell.icon, (shell && shell.name) || "", "") + "</span>" +
      "<span><span class=\"shell-name\">" + dash(shell && shell.name) + "</span>" +
      '<span class="passives">' + passives + "</span></span>" +
      "</div></section>";
  }

  function statList(values, label) {
    if (!values.length) return '<p class="dash">—</p>';
    return '<ul class="stat-list">' + values.map(function (value, i) {
      return "<li><b>" + label + " " + (i + 1) + "</b>" + esc(value) + "</li>";
    }).join("") + "</ul>";
  }

  function statsPanel(build) {
    return '<div class="pair">' +
      '<section class="panel"><h2>Major stat</h2>' + statList(build.majorStats, "M") + "</section>" +
      '<section class="panel"><h2>Minor stat</h2>' + statList(build.minorStats, "m") + "</section>" +
      "</div>";
  }

  function remarkPanel(build) {
    if (!has(build.remark)) return "";
    return '<section class="panel remark"><h2>Remark</h2><p>' + esc(build.remark) + "</p></section>";
  }

  /* ---------------------------------------------------------- view: gvg -- */

  var gvgState = { query: "" };

  function renderGVG(targetId) {
    var query = norm(gvgState.query);
    var list = DATA.teams.filter(function (t) { return teamMatches(t, query); });

    view.innerHTML = '' +
      '<div class="page-head">' +
      '<p class="eyebrow">Section 03</p>' +
      "<h1>GVG Teams</h1>" +
      "<p>" + DATA.teams.length + " recommended compositions. Tap any Animus to open its build.</p>" +
      "</div>" +

      '<div class="toolbar">' +
      searchBox("team-search", "Search team name or Animus…", gvgState.query) +
      '<span class="toolbar-note">Showing ' + list.length + " of " + DATA.teams.length + "</span>" +
      "</div>" +

      (list.length
        ? '<div class="teams">' + list.map(function (t) { return teamCard(t, targetId); }).join("") + "</div>"
        : '<p class="empty"><strong>No team matches that search.</strong>' +
          "Search by team name or by an Animus inside the team.</p>");

    var input = document.getElementById("team-search");
    input.addEventListener("input", debounce(function () {
      gvgState.query = input.value;
      renderGVG();
      var next = document.getElementById("team-search");
      next.focus();
      next.setSelectionRange(next.value.length, next.value.length);
    }, 140));

    if (targetId) {
      var node = document.getElementById("team-" + targetId);
      if (node) node.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  function teamCard(team, targetId) {
    return '' +
      '<article class="team' + (team.id === targetId ? " is-target" : "") +
      '" id="team-' + esc(team.id) + '">' +
      '<div class="team-head"><h2>' + esc(team.name) + "</h2></div>" +
      '<div class="slots">' + team.slots.map(teamSlot).join("") + "</div>" +
      (has(team.remark)
        ? '<p class="team-remark">' + esc(team.remark) + "</p>"
        : "") +
      "</article>";
  }

  function teamSlot(slot) {
    var open = slot.animusId ? "#build/" + encodeURIComponent(slot.animusId) : "#gvg";

    return '' +
      '<a class="slot" href="' + open + '"' +
      (has(slot.element) ? ' data-element="' + esc(slot.element) + '"' : "") + ">" +
      (has(slot.elementIcon)
        ? '<img class="a-el" src="' + esc(slot.elementIcon) + '" alt="' + esc(slot.element) + '" loading="lazy">'
        : "") +
      '<span class="slot-art">' + art(slot.card || slot.portrait, slot.name, initials(slot.name)) + "</span>" +
      '<span class="slot-name">' + esc(slot.name) +
      (has(slot.element) ? "<span>" + esc(slot.element) + "</span>" : "") +
      "</span></a>";
  }

  /* ----------------------------------------------------- view: imprints -- */

  var imprintState = { query: "" };

  function imprints() {
    return DATA.imprints || [];
  }

  function renderImprints() {
    var query = norm(imprintState.query);
    var all = imprints();
    var list = all.filter(function (i) { return imprintMatches(i, query); });
    var filled = (DATA.meta && DATA.meta.imprintsWithData) != null
      ? DATA.meta.imprintsWithData
      : all.filter(function (i) { return i.hasData; }).length;

    view.innerHTML = '' +
      '<div class="page-head">' +
      '<p class="eyebrow">Section 02</p>' +
      "<h1>Imprints</h1>" +
      "<p>" + all.length + " imprints, " + filled +
      " with recommended component options. Pick one to see its details.</p>" +
      "</div>" +

      '<div class="toolbar">' +
      searchBox("imprint-search", "Search imprint, component option or Animus…", imprintState.query) +
      '<span class="toolbar-note">Showing ' + list.length + " of " + all.length + "</span>" +
      "</div>" +

      (list.length
        ? '<div class="roster roster-wide">' + list.map(imprintCard).join("") + "</div>"
        : '<p class="empty"><strong>No imprint matches that search.</strong>' +
          "Search by imprint name, a component option, or an Animus it suits.</p>");

    var input = document.getElementById("imprint-search");
    if (!input) return;
    input.addEventListener("input", debounce(function () {
      imprintState.query = input.value;
      renderImprints();
      var next = document.getElementById("imprint-search");
      next.focus();
      next.setSelectionRange(next.value.length, next.value.length);
    }, 140));
  }

  function imprintCard(imprint) {
    return '' +
      '<a class="a-card i-card" href="#imprint/' + encodeURIComponent(imprint.id) + '">' +
      '<span class="a-count' + (imprint.hasData ? "" : " is-empty") + '">' +
      (imprint.hasData ? esc(imprint.no || "Imprint") : "No data") + "</span>" +
      '<span class="a-art">' + art(imprint.card, imprint.name, initials(imprint.name)) + "</span>" +
      '<span class="a-meta">' +
      '<span class="a-name">' + esc(imprint.name) + "</span>" +
      (imprint.animus.length
        ? '<span class="a-el-name">' + imprint.animus.length + " Animus</span>"
        : "") +
      "</span></a>";
  }

  function renderImprintProfile(imprintId) {
    var imprint = imprints().filter(function (i) { return i.id === imprintId; })[0];
    if (!imprint) {
      view.innerHTML = '<a class="back-link" href="#imprints">← All Imprints</a>' +
        '<p class="empty"><strong>That imprint is not in the data.</strong>' +
        "It may have been renamed in core_data.xlsx.</p>";
      return;
    }

    view.innerHTML = '' +
      '<a class="back-link" href="#imprints">← All Imprints</a>' +
      '<div class="profile">' +

      '<div class="p-side">' +
      '<div class="p-art p-art-item">' + art(imprint.card, imprint.name, initials(imprint.name)) + "</div>" +
      '<div class="p-id">' +
      (has(imprint.no) ? '<p class="eyebrow">' + esc(imprint.no) + "</p>" : "") +
      "<h1>" + esc(imprint.name) + "</h1></div>" +
      "</div>" +

      '<div class="p-main">' +
      componentPanel(imprint) +
      remarkPanel(imprint) +
      recommendPanel(imprint) +
      "</div></div>";
  }

  function componentPanel(imprint) {
    var filled = imprint.components.filter(function (c) { return c.options.length; });
    if (!filled.length) {
      return '<section class="panel"><h2>Component option</h2>' +
        "<p>No component options have been added for this imprint yet. Fill in its " +
        "row on the <code>Imprint</code> sheet in core_data.xlsx and it will show " +
        "up here.</p></section>";
    }
    var cells = imprint.components.map(function (c) {
      var options = c.options.length
        ? '<ul class="c-options">' + c.options.map(function (o) {
            return "<li>" + esc(o) + "</li>";
          }).join("") + "</ul>"
        : '<p class="dash">—</p>';
      return '<div class="component">' +
        '<span class="c-icon">' + art(c.icon, c.name, "") + "</span>" +
        '<span class="c-name">' + esc(c.name) + "</span>" +
        options + "</div>";
    }).join("");
    return '<section class="panel"><h2>Component option</h2>' +
      '<div class="components">' + cells + "</div></section>";
  }

  function recommendPanel(imprint) {
    if (!imprint.animus.length) return "";
    var cards = imprint.animus.map(function (a) {
      var open = a.animusId ? "#build/" + encodeURIComponent(a.animusId) : "#builds";
      return '<a class="rec" href="' + open + '"' +
        (has(a.element) ? ' data-element="' + esc(a.element) + '"' : "") + ">" +
        '<span class="rec-art">' + art(a.portrait || a.card, a.name, initials(a.name)) + "</span>" +
        '<span class="rec-name">' + esc(a.name) + "</span></a>";
    }).join("");
    return '<section class="panel"><h2>Recommended for Animus</h2>' +
      '<div class="recs">' + cards + "</div></section>";
  }

  /* --------------------------------------------------- view: gvg draft -- */

  /*
   * Defence team drafter. Pick a tower, then drag Animus portraits from the
   * pool into team slots (or tap a portrait to fill the next empty slot).
   * An Animus can be placed only once per tower draft. Each tower keeps its
   * own draft in this browser, so switching towers never loses work.
   */

  var TOWERS = [
    { id: "yellow", name: "Yellow", teams: 5, color: "#E3C54B" },
    { id: "red",    name: "Red",    teams: 5, color: "#E8586C" },
    { id: "purple", name: "Purple", teams: 4, color: "#A874F0" },
    { id: "white",  name: "White",  teams: 4, color: "#E9E6F2" }
  ];
  var TEAM_SIZE = 3;
  var MATRIX_MIN = 2;
  var MATRIX_MAX = 3;
  var DRAFT_KEY = "etheria.gvgDraft.v1";

  var draft = loadDraft();
  var draftUI = { query: "", element: "", hideUsed: false, target: null };
  var gearUI = { animusId: null, pos: null };
  var drag = null;
  var suppressClick = false;

  /*
   * draft.mode  — which gear is drafted alongside each Animus:
   *               { shell: false, matrix: false }  Animus only
   *               { shell: true,  matrix: false }  Animus + Shell
   *               { shell: true,  matrix: true  }  Animus + Shell + 2–3 Matrix
   * draft.gear  — per tower, keyed by Animus id, so gear follows an Animus
   *               when it is swapped to another slot:
   *               { yellow: { areal: { shell: "halloween",
   *                                     matrices: [{ id: "bloodbath", fill: 12 }] } } }
   */
  function loadDraft() {
    var empty = { tower: "", boards: {}, gear: {}, mode: { shell: false, matrix: false } };
    try {
      var raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (raw && typeof raw === "object" && raw.boards && typeof raw.boards === "object") {
        var matrix = !!(raw.mode && raw.mode.matrix);
        return {
          tower: String(raw.tower || ""),
          boards: raw.boards,
          gear: raw.gear && typeof raw.gear === "object" ? raw.gear : {},
          mode: { shell: matrix || !!(raw.mode && raw.mode.shell), matrix: matrix }
        };
      }
    } catch (e) { /* storage blocked or corrupt — start fresh */ }
    return empty;
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* ignore */ }
  }

  function towerById(id) {
    return TOWERS.filter(function (t) { return t.id === id; })[0] || null;
  }

  function currentTower() { return towerById(draft.tower); }

  var animusIndex = null;
  function animusById(id) {
    if (!animusIndex) {
      animusIndex = {};
      DATA.animus.forEach(function (a) { animusIndex[a.id] = a; });
    }
    return animusIndex[id] || null;
  }

  /** The current tower's board, always shaped teams × TEAM_SIZE. */
  function currentBoard() {
    var tower = currentTower();
    if (!tower) return [];
    var saved = draft.boards[tower.id];
    var board = [];
    for (var t = 0; t < tower.teams; t++) {
      var row = [];
      for (var s = 0; s < TEAM_SIZE; s++) {
        var id = saved && saved[t] && saved[t][s];
        row.push(id && animusById(id) ? id : null);
      }
      board.push(row);
    }
    draft.boards[tower.id] = board;
    return board;
  }

  /** animusId -> team index, for everything already placed. */
  function usedMap(board) {
    var used = {};
    board.forEach(function (team, t) {
      team.forEach(function (id) { if (id) used[id] = t; });
    });
    return used;
  }

  function placedCount(board) {
    return board.reduce(function (n, team) {
      return n + team.filter(Boolean).length;
    }, 0);
  }

  function firstEmpty(board) {
    for (var t = 0; t < board.length; t++) {
      for (var s = 0; s < TEAM_SIZE; s++) {
        if (!board[t][s]) return { t: t, s: s };
      }
    }
    return null;
  }

  function teamLabel(t) { return "Team " + (t + 1); }

  /* ---- gear: shell and matrix per Animus ---- */

  function gearOn() { return !!draft.mode.shell; }

  function shellById(id) { return (DATA.shells && DATA.shells[id]) || null; }
  function matrixById(id) { return (DATA.matrices && DATA.matrices[id]) || null; }
  function matrixFull(m) {
    var n = parseInt(m && m.full, 10);
    return n > 0 ? n : 0;
  }

  function towerGear() {
    var tower = currentTower();
    if (!tower) return {};
    if (!draft.gear || typeof draft.gear !== "object") draft.gear = {};
    var all = draft.gear[tower.id];
    if (!all || typeof all !== "object") all = draft.gear[tower.id] = {};
    return all;
  }

  /** Clean copy of one Animus's gear: unknown names dropped, fills clamped. */
  function gearFor(animusId) {
    var saved = towerGear()[animusId];
    if (!saved || typeof saved !== "object") return { shell: null, matrices: [] };
    var seen = {};
    var matrices = (Array.isArray(saved.matrices) ? saved.matrices : [])
      .filter(function (m) {
        if (!m || !matrixById(m.id) || seen[m.id]) return false;
        seen[m.id] = true;
        return true;
      })
      .slice(0, MATRIX_MAX)
      .map(function (m) {
        var full = matrixFull(matrixById(m.id));
        var fill = parseInt(m.fill, 10);
        if (!(fill > 0)) fill = full;
        if (full && fill > full) fill = full;
        return { id: m.id, fill: fill };
      });
    return { shell: saved.shell && shellById(saved.shell) ? saved.shell : null, matrices: matrices };
  }

  function setGear(animusId, gear) { towerGear()[animusId] = gear; }

  function gearComplete(gear) {
    if (draft.mode.shell && !gear.shell) return false;
    if (draft.mode.matrix && gear.matrices.length < MATRIX_MIN) return false;
    return true;
  }

  /** Shell and matrices of one recommended build, in the draft's gear shape. */
  function gearFromBuild(build) {
    var shell = build && build.shell && build.shell.id && shellById(build.shell.id) ? build.shell.id : null;
    var seen = {};
    var matrices = ((build && build.matrices) || [])
      .filter(function (m) {
        if (!m.id || !matrixById(m.id) || seen[m.id]) return false;
        seen[m.id] = true;
        return true;
      })
      .slice(0, MATRIX_MAX)
      .map(function (m) {
        var full = matrixFull(matrixById(m.id));
        var fill = parseInt(m.fill, 10);
        if (!(fill > 0) || (full && fill > full)) fill = full;
        return { id: m.id, fill: fill };
      });
    return { shell: shell, matrices: matrices };
  }

  /** Fill empty gear from the Animus's Option 1 build, for whatever mode is on. */
  function prefillGear(animusId) {
    if (!gearOn()) return;
    var a = animusById(animusId);
    if (!a || !a.builds || !a.builds.length) return;
    var gear = gearFor(animusId);
    var rec = gearFromBuild(a.builds[0]);
    var changed = false;
    if (!gear.shell && rec.shell) { gear.shell = rec.shell; changed = true; }
    if (draft.mode.matrix && !gear.matrices.length && rec.matrices.length) {
      gear.matrices = rec.matrices;
      changed = true;
    }
    if (changed) setGear(animusId, gear);
  }

  /** Forget gear for Animus that are no longer on the board. */
  function pruneGear(board) {
    if (!currentTower()) return;
    var used = usedMap(board);
    var all = towerGear();
    Object.keys(all).forEach(function (id) {
      if (used[id] == null) delete all[id];
    });
  }

  function gearMissing(board) {
    if (!gearOn()) return 0;
    var missing = 0;
    board.forEach(function (team) {
      team.forEach(function (id) {
        if (id && !gearComplete(gearFor(id))) missing++;
      });
    });
    return missing;
  }

  function gearNeed() {
    return draft.mode.matrix ? "a Shell and " + MATRIX_MIN + "–" + MATRIX_MAX + " Matrix" : "a Shell";
  }

  /* ---- rendering ---- */

  function renderDraft() {
    closeGear(false);
    var tower = currentTower();

    view.innerHTML = '' +
      '<div class="page-head">' +
      '<p class="eyebrow">Section 04</p>' +
      "<h1>GVG Draft</h1>" +
      "<p>Plan your defence teams. Choose a tower, then drag Animus into each team. " +
      "Every Animus can be used only once per tower.</p>" +
      "</div>" +
      '<div class="toolbar tower-bar">' +
      '<span class="tower-label">Tower type</span>' +
      '<div class="towers" role="radiogroup" aria-label="Tower type">' +
      TOWERS.map(function (t) {
        var on = tower && tower.id === t.id;
        return '<button type="button" class="tower-btn" role="radio" data-tower="' + t.id +
          '" aria-checked="' + !!on + '" style="--tower:' + t.color + '">' +
          '<span class="tower-dot" aria-hidden="true"></span>' +
          "<span><b>" + esc(t.name) + "</b><small>" + t.teams + " teams · " +
          (t.teams * TEAM_SIZE) + " Animus</small></span></button>";
      }).join("") +
      "</div></div>" +
      (tower
        ? '<div class="draft" id="draft" style="--tower:' + tower.color + '">' +
          '<aside class="pool" aria-label="Animus pool">' +
          '<div class="pool-tools">' +
          searchBox("pool-search", "Search Animus…", draftUI.query) +
          '<div class="chips pool-chips">' + poolChips() + "</div>" +
          "</div>" +
          '<div class="pool-grid" id="pool-grid"></div>' +
          "</aside>" +
          '<section class="board" id="draft-board" aria-label="' + esc(tower.name) + ' tower teams"></section>' +
          "</div>" +
          '<p class="d-toast" id="draft-toast" role="status" aria-live="polite"></p>'
        : '<p class="empty"><strong>Choose a tower type to start drafting.</strong>' +
          "Yellow and Red towers take 5 teams. Purple and White towers take 4 teams. " +
          "Each team has 3 Animus.</p>");

    view.querySelectorAll("[data-tower]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        draft.tower = btn.getAttribute("data-tower");
        draftUI.target = null;
        saveDraft();
        renderDraft();
      });
    });

    if (!tower) return;

    var input = document.getElementById("pool-search");
    input.addEventListener("input", debounce(function () {
      draftUI.query = input.value;
      updatePool();
    }, 120));

    view.querySelector(".pool-chips").addEventListener("click", function (event) {
      var chip = event.target.closest("[data-pool-filter], [data-hide-used]");
      if (!chip) return;
      if (chip.hasAttribute("data-hide-used")) {
        draftUI.hideUsed = !draftUI.hideUsed;
      } else {
        draftUI.element = chip.getAttribute("data-pool-filter");
      }
      view.querySelector(".pool-chips").innerHTML = poolChips();
      updatePool();
    });

    var root = document.getElementById("draft");
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("click", onDraftClick);
    root.addEventListener("keydown", onDraftKey);
    root.addEventListener("contextmenu", function (event) {
      if (event.target.closest(".p-tile, .d-slot")) event.preventDefault();
    });

    updateBoard();
    updatePool();
  }

  function poolChips() {
    var elements = Object.keys(DATA.elements).map(function (id) { return DATA.elements[id]; });
    return '<button class="chip" type="button" data-pool-filter="" aria-pressed="' +
      (!draftUI.element) + '">All</button>' +
      elements.map(function (el) {
        return '<button class="chip chip-icon" type="button" data-element="' + esc(el.name) +
          '" data-pool-filter="' + esc(el.name) + '" aria-pressed="' +
          (draftUI.element === el.name) + '" title="' + esc(el.name) + '">' +
          (has(el.icon) ? '<img src="' + esc(el.icon) + '" alt="">' : "") +
          '<span class="sr-only">' + esc(el.name) + "</span></button>";
      }).join("") +
      '<button class="chip" type="button" data-hide-used aria-pressed="' + draftUI.hideUsed +
      '">Hide picked</button>';
  }

  function updatePool() {
    var grid = document.getElementById("pool-grid");
    if (!grid) return;
    var board = currentBoard();
    var used = usedMap(board);
    var query = norm(draftUI.query);

    var list = DATA.animus.slice().sort(function (a, b) {
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    }).filter(function (a) {
      if (draftUI.element && a.element !== draftUI.element) return false;
      if (draftUI.hideUsed && used[a.id] != null) return false;
      return animusMatches(a, query);
    });

    grid.innerHTML = list.length
      ? list.map(function (a) {
          var t = used[a.id];
          var isUsed = t != null;
          return '<button type="button" class="p-tile' + (isUsed ? " is-used" : "") +
            '" data-animus="' + esc(a.id) + '"' +
            (has(a.element) ? ' data-element="' + esc(a.element) + '"' : "") +
            ' title="' + esc(a.name) + (isUsed ? " — in " + teamLabel(t) : "") + '"' +
            ' aria-disabled="' + isUsed + '">' +
            '<span class="p-tile-art">' + art(a.portrait || a.card, "", initials(a.name)) + "</span>" +
            '<span class="p-tile-name">' + esc(a.name) + "</span>" +
            (isUsed ? '<span class="p-tile-badge">T' + (t + 1) + "</span>" : "") +
            "</button>";
        }).join("")
      : '<p class="pool-empty">No Animus matches.</p>';

    grid.querySelectorAll("img").forEach(function (img) { img.draggable = false; });
  }

  function updateBoard() {
    var host = document.getElementById("draft-board");
    if (!host) return;
    var tower = currentTower();
    var board = currentBoard();
    var total = tower.teams * TEAM_SIZE;
    var placed = placedCount(board);
    var missing = gearMissing(board);
    var filled = placed === total;
    var done = filled && !missing;
    var target = draftUI.target;
    var withGear = gearOn();

    var hint;
    if (done) {
      hint = "Draft complete. Export it as a picture to share with your guild.";
    } else if (filled) {
      hint = missing + (missing === 1 ? " Animus still needs " : " Animus still need ") + gearNeed() +
        ". Tap the gear row under a portrait to set it, or export the draft as it is.";
    } else {
      hint = "Drag a portrait into a slot, or tap a portrait to fill the next empty slot. " +
        "Tap a slot first to choose where the next pick goes. You can export at any time; empty slots show as blank." +
        (withGear ? " Tap the gear row under a portrait to change its " +
          (draft.mode.matrix ? "Shell and Matrix." : "Shell.") : "");
    }

    host.innerHTML = '' +
      '<div class="board-head">' +
      '<div class="board-title"><span class="tower-dot" aria-hidden="true"></span>' +
      "<b>" + esc(tower.name) + " Tower</b>" +
      '<span class="board-count' + (done ? " is-done" : "") + '">' + placed + " / " + total + "</span></div>" +
      '<div class="board-actions">' +
      '<button type="button" class="btn" data-clear' + (placed ? "" : " disabled") + ">Clear</button>" +
      '<button type="button" class="btn btn-gold" data-export title="Save the draft as a picture — empty slots and missing gear are shown as blanks">' +
      "Export image</button>" +
      "</div></div>" +
      '<div class="board-modes" role="group" aria-label="Gear to draft">' +
      '<span class="tower-label">Draft</span>' +
      '<span class="mode-fixed">Animus</span>' +
      '<button type="button" class="mode-btn" data-mode="shell" aria-pressed="' + !!draft.mode.shell + '">' +
      '<span class="mode-tick" aria-hidden="true"></span>Add Shell</button>' +
      '<button type="button" class="mode-btn" data-mode="matrix" aria-pressed="' + !!draft.mode.matrix + '">' +
      '<span class="mode-tick" aria-hidden="true"></span>Add Matrix</button>' +
      "</div>" +
      '<p class="board-hint">' + esc(hint) + "</p>" +
      '<div class="d-teams' + (withGear ? " has-gear" : "") + (draft.mode.matrix ? " has-matrix" : "") + '">' +
      board.map(function (team, t) {
        var count = team.filter(Boolean).length;
        return '<div class="d-team' + (count === TEAM_SIZE ? " is-full" : "") + '">' +
          '<div class="d-team-head"><b>' + teamLabel(t) + "</b><span>" + count + " / " + TEAM_SIZE + "</span></div>" +
          '<div class="d-slots">' +
          team.map(function (id, s) {
            var isTarget = target && target.t === t && target.s === s;
            var a = id ? animusById(id) : null;
            var label = teamLabel(t) + ", slot " + (s + 1) + (a ? ": " + a.name : ": empty");
            var slot;
            if (!a) {
              slot = '<div class="d-slot is-empty' + (isTarget ? " is-target" : "") +
                '" data-team="' + t + '" data-slot="' + s + '" role="button" tabindex="0"' +
                ' aria-label="' + esc(label) + '" aria-pressed="' + !!isTarget + '">' +
                '<span class="d-plus" aria-hidden="true">+</span></div>';
            } else {
              slot = '<div class="d-slot is-filled' + (isTarget ? " is-target" : "") +
                '" data-team="' + t + '" data-slot="' + s + '" data-animus-slot="' + esc(a.id) + '"' +
                (has(a.element) ? ' data-element="' + esc(a.element) + '"' : "") +
                ' role="button" tabindex="0" aria-label="' + esc(label) + '" aria-pressed="' + !!isTarget + '">' +
                '<span class="slot-art">' + art(a.card || a.portrait, "", initials(a.name)) + "</span>" +
                '<span class="slot-name">' + esc(a.name) + "</span>" +
                '<button type="button" class="d-remove" data-remove aria-label="Remove ' + esc(a.name) +
                '">×</button></div>';
            }
            if (!withGear) return slot;
            return '<div class="d-cell">' + slot +
              (a ? gearStrip(a, t, s) : '<div class="d-gear is-blank" aria-hidden="true"></div>') +
              "</div>";
          }).join("") +
          "</div></div>";
      }).join("") +
      "</div>";

    host.querySelectorAll("img").forEach(function (img) { img.draggable = false; });
  }

  /** The small Shell / Matrix row under a placed Animus. Tap it to edit. */
  function gearStrip(a, t, s) {
    var gear = gearFor(a.id);
    var shell = gear.shell ? shellById(gear.shell) : null;
    var withMatrix = draft.mode.matrix;
    var said = [];

    var html = '<span class="g-shell' + (shell ? "" : " is-missing") + '"' +
      (shell ? ' title="' + esc(shell.name) + '"' : "") + ">" +
      (shell ? icon(shell.icon, "") : '<i aria-hidden="true">+</i>') + "</span>";
    said.push(shell ? "Shell " + shell.name : "no Shell");

    if (!withMatrix) {
      html += '<span class="g-label">' + (shell ? esc(shell.name) : "Add Shell") + "</span>";
    } else {
      for (var i = 0; i < MATRIX_MAX; i++) {
        var m = gear.matrices[i];
        var ref = m ? matrixById(m.id) : null;
        if (ref) {
          var full = matrixFull(ref);
          html += '<span class="g-mx" title="' + esc(ref.name + " " + m.fill + (full ? " / " + full : "")) + '">' +
            icon(ref.icon, "") +
            '<b class="' + (full && m.fill < full ? "is-part" : "") + '">' + m.fill + "</b></span>";
          said.push(ref.name + " " + m.fill + (full ? " of " + full : ""));
        } else {
          html += '<span class="g-mx ' + (i < MATRIX_MIN ? "is-missing" : "is-optional") + '">' +
            (i < MATRIX_MIN ? '<i aria-hidden="true">+</i>' : "") + "</span>";
        }
      }
      if (!gear.matrices.length) said.push("no Matrix");
    }

    return '<button type="button" class="d-gear' + (withMatrix ? "" : " is-shell-only") +
      (gearComplete(gear) ? "" : " is-incomplete") +
      '" data-gear data-team="' + t + '" data-slot="' + s + '"' +
      ' aria-label="' + esc("Edit gear for " + a.name + ": " + said.join(", ")) + '">' +
      html + "</button>";
  }

  /* ---- gear editor (bottom sheet on phones, dialog on desktop) ---- */

  function openGear(pos) {
    var id = currentBoard()[pos.t][pos.s];
    if (!id) return;
    gearUI.animusId = id;
    gearUI.pos = pos;
    renderGearEditor(true);
  }

  function closeGear(restoreFocus) {
    var host = document.getElementById("gear-sheet");
    var pos = gearUI.pos;
    gearUI.animusId = null;
    gearUI.pos = null;
    document.body.classList.remove("g-open");
    if (!host) return;
    host.remove();
    if (restoreFocus !== false && pos) {
      var back = view.querySelector('[data-gear][data-team="' + pos.t + '"][data-slot="' + pos.s + '"]');
      if (back) back.focus();
    }
  }

  function renderGearEditor(first) {
    var a = gearUI.animusId ? animusById(gearUI.animusId) : null;
    if (!a) { closeGear(false); return; }
    var gear = gearFor(a.id);
    var pos = gearUI.pos;

    var host = document.getElementById("gear-sheet");
    var scroll = 0;
    if (!host) {
      host = document.createElement("div");
      host.id = "gear-sheet";
      host.className = "g-sheet";
      host.addEventListener("click", onGearClick);
      host.addEventListener("change", onGearChange);
      view.appendChild(host);
    } else {
      var oldBody = host.querySelector(".g-body");
      if (oldBody) scroll = oldBody.scrollTop;
    }
    document.body.classList.add("g-open");

    var builds = (a.builds || []).length
      ? '<div class="g-builds"><span class="g-builds-label">Use recommended build</span>' +
        a.builds.map(function (b, i) {
          return '<button type="button" class="chip" data-g-build="' + i + '">Option ' + esc(b.option) + "</button>";
        }).join("") + "</div>"
      : "";

    var shells = Object.keys(DATA.shells || {}).map(function (id) { return DATA.shells[id]; });
    var shellGrid = '<div class="g-grid">' + shells.map(function (sh) {
      var on = gear.shell === sh.id;
      return '<button type="button" class="g-tile" data-g-shell="' + esc(sh.id) + '" aria-pressed="' + on + '">' +
        '<span class="g-tile-art">' + icon(sh.icon, "") + "</span>" +
        '<span class="g-tile-name">' + esc(sh.name) + "</span></button>";
    }).join("") + "</div>";

    var matrixSection = "";
    if (draft.mode.matrix) {
      var picked = "";
      for (var i = 0; i < MATRIX_MAX; i++) {
        var m = gear.matrices[i];
        var ref = m ? matrixById(m.id) : null;
        if (!ref) {
          picked += '<div class="g-pick is-empty"><span class="g-pick-art" aria-hidden="true">' + (i + 1) + "</span>" +
            "<span>Matrix " + (i + 1) + (i < MATRIX_MIN ? " — pick one below" : " — optional") + "</span></div>";
          continue;
        }
        var full = matrixFull(ref);
        var options = "";
        for (var v = full; v >= 1; v--) {
          options += '<option value="' + v + '"' + (v === m.fill ? " selected" : "") + ">" + v + "</option>";
        }
        picked += '<div class="g-pick">' +
          '<span class="g-pick-art">' + icon(ref.icon, "") + "</span>" +
          '<span class="g-pick-name">' + esc(ref.name) + "</span>" +
          (full
            ? '<label class="g-fill"><span class="sr-only">' + esc(ref.name) + " fill</span>" +
              '<select data-g-fill="' + i + '">' + options + "</select><small>/ " + full + "</small></label>"
            : '<span class="g-fill">' + m.fill + "</span>") +
          '<button type="button" class="g-unpick" data-g-unpick="' + i + '" aria-label="Remove ' +
          esc(ref.name) + '">×</button></div>';
      }

      // Matrices grouped by their full node count, biggest first.
      var groups = {};
      Object.keys(DATA.matrices || {}).forEach(function (id) {
        var ref = DATA.matrices[id];
        var full = matrixFull(ref);
        (groups[full] = groups[full] || []).push(ref);
      });
      var fulls = Object.keys(groups).map(Number).sort(function (x, y) { return y - x; });
      var isFull = gear.matrices.length >= MATRIX_MAX;
      var grids = fulls.map(function (full) {
        return '<p class="g-group">' + (full ? full + "-node sets" : "Other") + "</p>" +
          '<div class="g-grid">' + groups[full].map(function (ref) {
            var at = -1;
            gear.matrices.forEach(function (m, n) { if (m.id === ref.id) at = n; });
            var on = at > -1;
            return '<button type="button" class="g-tile" data-g-matrix="' + esc(ref.id) + '" aria-pressed="' + on + '"' +
              (!on && isFull ? " disabled" : "") + ">" +
              (on ? '<span class="g-order">' + (at + 1) + "</span>" : "") +
              '<span class="g-tile-art">' + icon(ref.icon, "") + "</span>" +
              '<span class="g-tile-name">' + esc(ref.name) + "</span></button>";
          }).join("") + "</div>";
      }).join("");

      matrixSection = '<section class="g-sec">' +
        "<h3>Matrix <span>" + gear.matrices.length + " / " + MATRIX_MAX + " · pick " + MATRIX_MIN + "–" + MATRIX_MAX + "</span></h3>" +
        '<div class="g-picked">' + picked + "</div>" + grids + "</section>";
    }

    host.innerHTML = '' +
      '<div class="g-backdrop" data-g-close></div>' +
      '<div class="g-panel" role="dialog" aria-modal="true" aria-labelledby="g-title" tabindex="-1"' +
      (has(a.element) ? ' data-element="' + esc(a.element) + '"' : "") + ">" +
      '<div class="g-head">' +
      '<span class="g-portrait">' + art(a.portrait || a.card, "", initials(a.name)) + "</span>" +
      '<div class="g-title"><p class="eyebrow">' + (pos ? esc(teamLabel(pos.t) + " · Slot " + (pos.s + 1)) : "") + "</p>" +
      '<h2 id="g-title">' + esc(a.name) + "</h2></div>" +
      '<button type="button" class="g-x" data-g-close aria-label="Close">×</button>' +
      "</div>" +
      '<div class="g-body">' + builds +
      '<section class="g-sec"><h3>Shell <span>' + (gear.shell ? "1 / 1" : "pick 1") + "</span></h3>" + shellGrid + "</section>" +
      matrixSection +
      "</div>" +
      '<div class="g-foot">' +
      '<button type="button" class="btn" data-g-clear>Clear gear</button>' +
      '<button type="button" class="btn btn-gold" data-g-close>Done</button>' +
      "</div></div>";

    var body = host.querySelector(".g-body");
    if (body) body.scrollTop = scroll;
    if (first) host.querySelector(".g-panel").focus();
  }

  function commitGear(gear) {
    setGear(gearUI.animusId, gear);
    saveDraft();
    updateBoard();
    renderGearEditor(false);
  }

  function onGearClick(event) {
    var node;
    if (event.target.closest("[data-g-close]")) { closeGear(); return; }
    if (!gearUI.animusId) return;
    var gear = gearFor(gearUI.animusId);

    if ((node = event.target.closest("[data-g-build]"))) {
      var a = animusById(gearUI.animusId);
      var build = a.builds[parseInt(node.getAttribute("data-g-build"), 10)];
      var rec = gearFromBuild(build);
      gear.shell = rec.shell;
      if (draft.mode.matrix) gear.matrices = rec.matrices;
      commitGear(gear);
      toast("Applied Option " + build.option + " to " + a.name + ".");
      return;
    }
    if ((node = event.target.closest("[data-g-shell]"))) {
      var shellId = node.getAttribute("data-g-shell");
      gear.shell = gear.shell === shellId ? null : shellId;
      commitGear(gear);
      return;
    }
    if ((node = event.target.closest("[data-g-matrix]"))) {
      var matrixId = node.getAttribute("data-g-matrix");
      var at = -1;
      gear.matrices.forEach(function (m, n) { if (m.id === matrixId) at = n; });
      if (at > -1) {
        gear.matrices.splice(at, 1);
      } else if (gear.matrices.length < MATRIX_MAX) {
        gear.matrices.push({ id: matrixId, fill: matrixFull(matrixById(matrixId)) });
      } else {
        toast("An Animus takes up to " + MATRIX_MAX + " Matrix. Remove one first.");
        return;
      }
      commitGear(gear);
      return;
    }
    if ((node = event.target.closest("[data-g-unpick]"))) {
      gear.matrices.splice(parseInt(node.getAttribute("data-g-unpick"), 10), 1);
      commitGear(gear);
      return;
    }
    if (event.target.closest("[data-g-clear]")) {
      commitGear({ shell: null, matrices: [] });
    }
  }

  function onGearChange(event) {
    var select = event.target.closest("[data-g-fill]");
    if (!select || !gearUI.animusId) return;
    var gear = gearFor(gearUI.animusId);
    var m = gear.matrices[parseInt(select.getAttribute("data-g-fill"), 10)];
    if (!m) return;
    m.fill = parseInt(select.value, 10);
    commitGear(gear);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && gearUI.animusId) closeGear();
  });

  function setMode(which) {
    if (which === "shell") {
      draft.mode.shell = !draft.mode.shell;
      if (!draft.mode.shell) draft.mode.matrix = false;
    } else {
      draft.mode.matrix = !draft.mode.matrix;
      if (draft.mode.matrix) draft.mode.shell = true;
    }
    // Animus already on the board start with their recommended gear.
    if (gearOn()) {
      currentBoard().forEach(function (team) {
        team.forEach(function (id) { if (id) prefillGear(id); });
      });
    }
    refreshDraft();
    toast(draft.mode.matrix ? "Drafting Animus + Shell + Matrix."
      : draft.mode.shell ? "Drafting Animus + Shell." : "Drafting Animus only.");
  }

  function refreshDraft() {
    pruneGear(currentBoard());
    saveDraft();
    updateBoard();
    updatePool();
  }

  var toastTimer;
  function toast(message) {
    var node = document.getElementById("draft-toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove("is-on"); }, 2200);
  }

  /* ---- board changes ---- */

  /** Put an Animus into a slot. From the pool it replaces; from a slot it swaps. */
  function placeAnimus(animusId, from, t, s) {
    var board = currentBoard();
    if (from) {
      if (from.t === t && from.s === s) return;
      var other = board[t][s];
      board[t][s] = animusId;
      board[from.t][from.s] = other;
    } else {
      var used = usedMap(board);
      if (used[animusId] != null) {
        toast(animusById(animusId).name + " is already in " + teamLabel(used[animusId]) + ".");
        return;
      }
      board[t][s] = animusId;
      prefillGear(animusId);
    }
    draftUI.target = null;
    refreshDraft();
  }

  function removeAt(t, s) {
    var board = currentBoard();
    board[t][s] = null;
    if (draftUI.target && draftUI.target.t === t && draftUI.target.s === s) draftUI.target = null;
    refreshDraft();
  }

  function slotPos(node) {
    return { t: parseInt(node.getAttribute("data-team"), 10), s: parseInt(node.getAttribute("data-slot"), 10) };
  }

  /* ---- click and keyboard ---- */

  function onDraftClick(event) {
    if (suppressClick) { suppressClick = false; return; }
    var node;

    if ((node = event.target.closest("[data-remove]"))) {
      var p = slotPos(node.closest(".d-slot"));
      removeAt(p.t, p.s);
      return;
    }
    if (event.target.closest("[data-clear]")) {
      var tower = currentTower();
      if (window.confirm("Clear every team in the " + tower.name + " tower?")) {
        draft.boards[tower.id] = [];
        if (draft.gear) draft.gear[tower.id] = {};
        draftUI.target = null;
        refreshDraft();
      }
      return;
    }
    if (event.target.closest("[data-export]")) {
      exportDraft();
      return;
    }
    if ((node = event.target.closest("[data-mode]"))) {
      setMode(node.getAttribute("data-mode"));
      return;
    }
    if ((node = event.target.closest("[data-gear]"))) {
      openGear(slotPos(node));
      return;
    }
    if ((node = event.target.closest(".p-tile"))) {
      var id = node.getAttribute("data-animus");
      var board = currentBoard();
      var used = usedMap(board);
      if (used[id] != null) {
        toast(animusById(id).name + " is already in " + teamLabel(used[id]) + ".");
        return;
      }
      var spot = draftUI.target || firstEmpty(board);
      if (!spot) { toast("Every slot is filled. Remove an Animus first."); return; }
      placeAnimus(id, null, spot.t, spot.s);
      toast(animusById(id).name + " → " + teamLabel(spot.t) + ", slot " + (spot.s + 1));
      return;
    }
    if ((node = event.target.closest(".d-slot"))) {
      var pos = slotPos(node);
      var same = draftUI.target && draftUI.target.t === pos.t && draftUI.target.s === pos.s;
      draftUI.target = same ? null : pos;
      updateBoard();
      if (!same) toast("Now pick an Animus for " + teamLabel(pos.t) + ", slot " + (pos.s + 1) + ".");
    }
  }

  function onDraftKey(event) {
    var node = event.target.closest(".d-slot");
    if (!node || event.target !== node) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      node.click();
    } else if ((event.key === "Delete" || event.key === "Backspace") && node.classList.contains("is-filled")) {
      event.preventDefault();
      var p = slotPos(node);
      removeAt(p.t, p.s);
    }
  }

  /* ---- drag and drop (pointer events, so it works with mouse and touch) ---- */

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (event.target.closest("[data-remove]")) return;

    var tile = event.target.closest(".p-tile");
    var slot = event.target.closest(".d-slot.is-filled");
    var source = null;

    if (tile && tile.getAttribute("aria-disabled") !== "true") {
      source = { animusId: tile.getAttribute("data-animus"), from: null, node: tile };
    } else if (slot) {
      source = { animusId: slot.getAttribute("data-animus-slot"), from: slotPos(slot), node: slot };
    }
    if (!source) return;
    if (event.pointerType === "mouse") event.preventDefault(); // no text selection

    drag = {
      animusId: source.animusId,
      from: source.from,
      node: source.node,
      x: event.clientX,
      y: event.clientY,
      touch: event.pointerType !== "mouse",
      active: false,
      ghost: null,
      over: null,
      timer: null
    };

    // Touch: hold briefly to lift, so a normal swipe still scrolls the page.
    if (drag.touch) {
      drag.timer = setTimeout(function () { if (drag) startDrag(); }, 260);
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", cancelDrag);
  }

  function startDrag() {
    var a = animusById(drag.animusId);
    drag.active = true;
    var ghost = document.createElement("div");
    ghost.className = "d-ghost";
    if (has(a.element)) ghost.setAttribute("data-element", a.element);
    ghost.innerHTML = '<span class="p-tile-art">' + art(a.portrait || a.card, "", initials(a.name)) + "</span>" +
      '<span class="p-tile-name">' + esc(a.name) + "</span>";
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.node.classList.add("is-lifted");
    document.body.classList.add("is-dragging");
    moveGhost(drag.x, drag.y);
    if (navigator.vibrate && drag.touch) { try { navigator.vibrate(12); } catch (e) { /* ignore */ } }
  }

  function moveGhost(x, y) {
    drag.ghost.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%) rotate(-4deg)";
    var under = document.elementFromPoint(x, y);
    var slot = slotUnder(under);
    if (slot !== drag.over) {
      if (drag.over) drag.over.classList.remove("is-over");
      if (slot) slot.classList.add("is-over");
      drag.over = slot;
    }
    var pool = under && under.closest(".pool");
    document.body.classList.toggle("is-over-pool", !!(pool && drag.from));
  }

  /** The slot under the pointer; dropping on a slot's gear row counts too. */
  function slotUnder(node) {
    if (!node || !node.closest) return null;
    var slot = node.closest(".d-slot");
    if (slot) return slot;
    var cell = node.closest(".d-cell");
    return cell ? cell.querySelector(".d-slot") : null;
  }

  function onPointerMove(event) {
    if (!drag) return;
    var dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.active) {
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (drag.touch) {
        if (dist > 10) cancelDrag(); // finger moved first: it's a scroll
        return;
      }
      if (dist < 6) return;
      startDrag();
    }
    event.preventDefault();
    drag.x = event.clientX;
    drag.y = event.clientY;
    moveGhost(drag.x, drag.y);
    autoScroll(drag.y);
  }

  var scrollRaf = null;
  function autoScroll(y) {
    var edge = 70, speed = 0;
    if (y < edge + 60) speed = -Math.ceil((edge + 60 - y) / 6);
    else if (y > window.innerHeight - edge) speed = Math.ceil((y - (window.innerHeight - edge)) / 6);
    if (!speed || scrollRaf) return;
    scrollRaf = requestAnimationFrame(function () {
      scrollRaf = null;
      if (!drag || !drag.active) return;
      window.scrollBy(0, speed);
      moveGhost(drag.x, drag.y);
      autoScroll(drag.y);
    });
  }

  function onPointerUp(event) {
    if (!drag) return;
    if (drag.active) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      var under = document.elementFromPoint(event.clientX, event.clientY);
      var slot = slotUnder(under);
      var current = drag;
      cancelDrag();
      if (slot) {
        var p = slotPos(slot);
        placeAnimus(current.animusId, current.from, p.t, p.s);
      } else if (current.from && under && under.closest(".pool")) {
        removeAt(current.from.t, current.from.s);
      }
      return;
    }
    cancelDrag();
  }

  function cancelDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.ghost) drag.ghost.remove();
    if (drag.over) drag.over.classList.remove("is-over");
    if (drag.node) drag.node.classList.remove("is-lifted");
    document.body.classList.remove("is-dragging", "is-over-pool");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", cancelDrag);
    drag = null;
  }

  // While a touch drag is live, stop the page from scrolling under the finger.
  document.addEventListener("touchmove", function (event) {
    if (drag && drag.active) event.preventDefault();
  }, { passive: false });

  /* ---- export as an image ---- */

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!has(src)) { resolve(null); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var cut = text;
    while (cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth) cut = cut.slice(0, -1);
    return cut + "…";
  }

  var ELEMENT_HUES = {
    constant: "#E3C54B", disorder: "#A874F0", hollow: "#46C6AC", odd: "#6E8AF5", reason: "#E8586C"
  };

  /*
   * Export always works, whatever state the draft is in: empty teams, empty
   * slots, an Animus with no Shell, or fewer than 2 Matrix. Anything missing
   * is drawn as a blank outline or "—" so a half-finished plan can be shared.
   */
  function exportDraft() {
    var button = view.querySelector("[data-export]");
    if (button && button.disabled) return;
    if (button) { button.disabled = true; button.textContent = "Preparing…"; }
    function resetButton() {
      var again = view.querySelector("[data-export]");
      if (again) { again.disabled = false; again.textContent = "Export image"; }
    }
    try {
      exportDraftImage().catch(function (error) {
        toast("Could not create the image: " + (error && error.message || error));
      }).then(resetButton);
    } catch (error) {
      toast("Could not create the image: " + (error && error.message || error));
      resetButton();
    }
  }

  function exportDraftImage() {
    var tower = currentTower();
    var board = currentBoard();
    var placedTotal = placedCount(board);
    var slotTotal = board.length * TEAM_SIZE;

    // Layout, in CSS pixels. The canvas is drawn at 2× for a sharp picture.
    var S = 2, PAD = 36, LABEL_W = 92, CARD_W = 150, CARD_H = 200, GAP = 12;
    var ROW_GAP = 16, HEAD_H = 118, FOOT_H = 52;
    var withShell = gearOn(), withMatrix = !!draft.mode.matrix;
    var SHELL_H = 28, MX_H = 21;
    var GEAR_H = withShell ? 8 + SHELL_H + (withMatrix ? 4 + MX_H * MATRIX_MAX : 0) : 0;
    var ROW_H = CARD_H + GEAR_H;
    var W = PAD * 2 + LABEL_W + CARD_W * TEAM_SIZE + GAP * (TEAM_SIZE - 1) + 24;
    var H = HEAD_H + board.length * ROW_H + (board.length - 1) * ROW_GAP + FOOT_H + PAD;

    var fontsReady = document.fonts && document.fonts.load
      ? Promise.all([
          document.fonts.load('700 30px "Chakra Petch"'),
          document.fonts.load('600 14px "Chakra Petch"'),
          document.fonts.load('500 12px "Anuphan"')
        ]).catch(function () {})
      : Promise.resolve();

    var jobs = [];
    var imageFor = {};
    board.forEach(function (team) {
      team.forEach(function (id) {
        var a = id ? animusById(id) : null;
        if (!a) return; // empty slot: nothing to load
        jobs.push(loadImage(a.card || a.portrait).then(function (img) { imageFor[id] = img; }));
        if (a.elementIcon && !imageFor["el:" + a.element]) {
          imageFor["el:" + a.element] = true;
          jobs.push(loadImage(a.elementIcon).then(function (img) { imageFor["el:" + a.element] = img; }));
        }
        if (!withShell) return;
        var gear = gearFor(id);
        var wanted = [];
        var sh = gear.shell ? shellById(gear.shell) : null;
        if (sh && sh.icon) wanted.push(["sh:" + sh.id, sh.icon]);
        if (withMatrix) {
          gear.matrices.forEach(function (m) {
            var ref = matrixById(m.id);
            if (ref && ref.icon) wanted.push(["mx:" + ref.id, ref.icon]);
          });
        }
        wanted.forEach(function (w) {
          if (imageFor[w[0]]) return;
          imageFor[w[0]] = true;
          jobs.push(loadImage(w[1]).then(function (img) { imageFor[w[0]] = img; }));
        });
      });
    });

    function gearImage(k) {
      var img = imageFor[k];
      return img && img !== true ? img : null;
    }

    /** Shell row, then one row per Matrix, under a card. */
    function drawGear(ctx, id, x, gy) {
      var gear = gearFor(id);
      var shell = gear.shell ? shellById(gear.shell) : null;

      roundRect(ctx, x + 0.5, gy + 0.5, 25, 25, 5);
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fill();
      ctx.save();
      if (!shell) ctx.setLineDash([3, 3]);
      ctx.strokeStyle = shell ? "rgba(190,180,255,0.14)" : "rgba(190,180,255,0.26)";
      ctx.stroke();
      ctx.restore();
      var shellImg = shell && gearImage("sh:" + shell.id);
      if (shellImg) ctx.drawImage(shellImg, x + 2, gy + 2, 22, 22);
      ctx.fillStyle = shell ? "#ECE9F6" : "#7E779A";
      ctx.font = '600 12.5px "Chakra Petch", sans-serif';
      ctx.fillText(fitText(ctx, shell ? shell.name : "— No Shell", CARD_W - 34), x + 33, gy + 17.5);

      if (!withMatrix) return;
      for (var i = 0; i < MATRIX_MAX; i++) {
        var my = gy + SHELL_H + 4 + i * MX_H;
        var m = gear.matrices[i];
        var ref = m ? matrixById(m.id) : null;
        if (!ref) {
          // Missing Matrix: a dashed square plus "—" (the optional 3rd stays quiet).
          if (i >= MATRIX_MIN && gear.matrices.length >= MATRIX_MIN) continue;
          roundRect(ctx, x + 4.5, my + 0.5, 16, 16, 3);
          ctx.save();
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = "rgba(190,180,255,0.24)";
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = "#7E779A";
          ctx.font = '500 11px "Anuphan", sans-serif';
          ctx.fillText(i < MATRIX_MIN ? "— No Matrix" : "— Optional", x + 27, my + 13);
          continue;
        }
        var img = gearImage("mx:" + ref.id);
        if (img) ctx.drawImage(img, x + 4, my, 17, 17);
        var full = matrixFull(ref);

        ctx.textAlign = "right";
        ctx.font = '700 11.5px "Chakra Petch", sans-serif';
        var tail = full ? "/" + full : "";
        ctx.fillStyle = "#7E779A";
        ctx.fillText(tail, x + CARD_W - 2, my + 13);
        var tailW = ctx.measureText(tail).width;
        ctx.fillStyle = full && m.fill < full ? "#A8A1C2" : "#E5B45C";
        ctx.fillText(String(m.fill), x + CARD_W - 2 - tailW, my + 13);
        var numW = ctx.measureText(String(m.fill)).width + tailW;
        ctx.textAlign = "left";

        ctx.fillStyle = "#A8A1C2";
        ctx.font = '500 11px "Anuphan", sans-serif';
        ctx.fillText(fitText(ctx, ref.name, CARD_W - 28 - numW - 6), x + 27, my + 13);
      }
    }

    return Promise.all([fontsReady].concat(jobs)).then(function () {
      var canvas = document.createElement("canvas");
      canvas.width = W * S;
      canvas.height = H * S;
      var ctx = canvas.getContext("2d");
      ctx.scale(S, S);

      // Background
      ctx.fillStyle = "#0A0912";
      ctx.fillRect(0, 0, W, H);
      var glow = ctx.createRadialGradient(W * 0.8, -40, 10, W * 0.8, -40, W * 0.9);
      glow.addColorStop(0, hexA(tower.color, 0.28));
      glow.addColorStop(1, "rgba(10,9,18,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Header
      ctx.fillStyle = tower.color;
      ctx.fillRect(PAD, PAD + 2, 6, 58);
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#7E779A";
      ctx.font = '600 11px "Chakra Petch", sans-serif';
      drawSpaced(ctx, "GVG DEFENCE DRAFT", PAD + 20, PAD + 16, 3);
      ctx.fillStyle = "#ECE9F6";
      ctx.font = '700 32px "Chakra Petch", sans-serif';
      ctx.fillText(tower.name + " Tower", PAD + 20, PAD + 52);

      ctx.textAlign = "right";
      ctx.fillStyle = "#A8A1C2";
      ctx.font = '600 13px "Chakra Petch", sans-serif';
      ctx.fillText(board.length + " TEAMS · " + (board.length * TEAM_SIZE) + " ANIMUS" +
        (withMatrix ? " · SHELL + MATRIX" : withShell ? " · SHELL" : ""), W - PAD, PAD + 16);
      ctx.fillStyle = "#7E779A";
      ctx.font = '500 12px "Anuphan", sans-serif';
      ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
        W - PAD, PAD + 36);
      // Progress, so a shared half-finished draft is clearly marked as such.
      var gearGaps = gearMissing(board);
      var status = placedTotal === slotTotal && !gearGaps
        ? "COMPLETE"
        : "IN PROGRESS · " + placedTotal + " / " + slotTotal + " PLACED" +
          (gearGaps ? " · " + gearGaps + " NEED GEAR" : "");
      ctx.fillStyle = placedTotal === slotTotal && !gearGaps ? tower.color : "#E5B45C";
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.fillText(status, W - PAD, PAD + 56);
      ctx.textAlign = "left";

      // Teams
      board.forEach(function (team, t) {
        var y = HEAD_H + t * (ROW_H + ROW_GAP);

        // row panel
        roundRect(ctx, PAD, y - 6, W - PAD * 2, ROW_H + 12, 12);
        ctx.fillStyle = "rgba(255,255,255,0.035)";
        ctx.fill();
        ctx.strokeStyle = "rgba(190,180,255,0.11)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // label
        ctx.fillStyle = "#7E779A";
        ctx.font = '600 11px "Chakra Petch", sans-serif';
        drawSpaced(ctx, "TEAM", PAD + 18, y + 26, 2.5);
        ctx.fillStyle = tower.color;
        ctx.font = '700 44px "Chakra Petch", sans-serif';
        ctx.fillText(String(t + 1).padStart(2, "0"), PAD + 16, y + 72);

        team.forEach(function (id, s) {
          var a = id ? animusById(id) : null;
          var x = PAD + LABEL_W + 12 + s * (CARD_W + GAP);

          if (!a) {
            // Empty slot: a dashed outline with a muted label.
            roundRect(ctx, x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1, 8);
            ctx.fillStyle = "rgba(15,13,27,0.6)";
            ctx.fill();
            ctx.save();
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = "rgba(190,180,255,0.22)";
            ctx.stroke();
            ctx.restore();
            ctx.fillStyle = "#7E779A";
            ctx.textAlign = "center";
            ctx.font = '300 34px "Chakra Petch", sans-serif';
            ctx.fillText("+", x + CARD_W / 2, y + CARD_H / 2 + 4);
            ctx.font = '600 10.5px "Chakra Petch", sans-serif';
            ctx.fillText("EMPTY", x + CARD_W / 2, y + CARD_H / 2 + 26);
            ctx.textAlign = "left";
            if (withShell) {
              // Blank gear area under an empty slot, so the row stays aligned.
              roundRect(ctx, x + 0.5, y + CARD_H + 8.5, CARD_W - 1, GEAR_H - 9, 6);
              ctx.save();
              ctx.setLineDash([4, 4]);
              ctx.strokeStyle = "rgba(190,180,255,0.12)";
              ctx.stroke();
              ctx.restore();
            }
            return;
          }

          var hue = ELEMENT_HUES[norm(a.element)] || "#8F86B8";

          ctx.save();
          roundRect(ctx, x, y, CARD_W, CARD_H, 8);
          ctx.clip();
          ctx.fillStyle = "#0F0D1B";
          ctx.fillRect(x, y, CARD_W, CARD_H);
          var img = imageFor[id];
          if (img) {
            // cover, anchored near the top (matches the site's slot crop)
            var scale = Math.max(CARD_W / img.width, CARD_H / img.height);
            var dw = img.width * scale, dh = img.height * scale;
            ctx.drawImage(img, x + (CARD_W - dw) / 2, y - (dh - CARD_H) * 0.12, dw, dh);
          } else {
            ctx.fillStyle = hue;
            ctx.font = '700 28px "Chakra Petch", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText(initials(a.name), x + CARD_W / 2, y + CARD_H / 2);
            ctx.textAlign = "left";
          }
          var shade = ctx.createLinearGradient(0, y + CARD_H * 0.5, 0, y + CARD_H);
          shade.addColorStop(0, "rgba(10,9,18,0)");
          shade.addColorStop(1, "rgba(10,9,18,0.95)");
          ctx.fillStyle = shade;
          ctx.fillRect(x, y, CARD_W, CARD_H);
          ctx.fillStyle = hue;
          ctx.fillRect(x, y + CARD_H - 3, CARD_W, 3);
          ctx.restore();

          roundRect(ctx, x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1, 8);
          ctx.strokeStyle = "rgba(190,180,255,0.16)";
          ctx.stroke();

          var icon = imageFor["el:" + a.element];
          if (icon && icon !== true) {
            roundRect(ctx, x + 6, y + 6, 24, 24, 5);
            ctx.fillStyle = "rgba(10,9,18,0.72)";
            ctx.fill();
            ctx.drawImage(icon, x + 9, y + 9, 18, 18);
          }

          ctx.fillStyle = "#ECE9F6";
          ctx.font = '700 14px "Chakra Petch", sans-serif';
          ctx.fillText(fitText(ctx, a.name, CARD_W - 16), x + 9, y + CARD_H - (has(a.element) ? 22 : 12));
          if (has(a.element)) {
            ctx.fillStyle = hue;
            ctx.font = '600 9px "Anuphan", sans-serif';
            drawSpaced(ctx, a.element.toUpperCase(), x + 9, y + CARD_H - 10, 1.4);
          }

          if (withShell) drawGear(ctx, id, x, y + CARD_H + 8);
        });
      });

      // Footer
      ctx.fillStyle = "#7E779A";
      ctx.font = '600 10.5px "Chakra Petch", sans-serif';
      drawSpaced(ctx, "ETHERIA RESTART · DATABASE", PAD, H - PAD + 4, 2.5);

      var filename = "gvg-draft-" + tower.id + "-" + localDate() + ".png";
      return new Promise(function (resolve) {
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) { resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png")); }, "image/png");
        } else {
          resolve(canvas.toDataURL("image/png"));
        }
      }).then(function (url) {
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        if (url.indexOf("blob:") === 0) setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        toast("Saved " + filename + (placedTotal < slotTotal ? " (draft in progress)" : ""));
      });
    });
  }

  function localDate() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function drawSpaced(ctx, text, x, y, spacing) {
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text[i], x, y);
      x += ctx.measureText(text[i]).width + spacing;
    }
  }

  function hexA(hex, alpha) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + alpha + ")";
  }

  /* ------------------------------------------------------------- router -- */

  function setActiveTab(section) {
    document.querySelectorAll(".tab").forEach(function (tab) {
      if (tab.getAttribute("data-section") === section) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
  }

  function route() {
    cancelDrag();
    closeGear(false);
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/").map(decodeURIComponent);
    var head = parts[0] || "builds";

    if (head === "build" && parts[1]) {
      setActiveTab("builds");
      renderProfile(parts[1], parts[2]);
    } else if (head === "gvg") {
      setActiveTab("gvg");
      renderGVG(parts[1]);
    } else if (head === "imprint" && parts[1]) {
      setActiveTab("imprints");
      renderImprintProfile(parts[1]);
    } else if (head === "imprints") {
      setActiveTab("imprints");
      renderImprints();
    } else if (head === "draft") {
      setActiveTab("draft");
      renderDraft();
    } else {
      setActiveTab("builds");
      renderBuilds();
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* --------------------------------------------------------------- boot -- */

  fetch("data.json", { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      DATA = data;
      document.getElementById("foot-meta").textContent =
        "Data built " + data.meta.generated + " · " + data.meta.buildCount +
        " builds · " + data.meta.teamCount + " GVG teams · " +
        (data.imprints || []).length + " imprints";
      window.addEventListener("hashchange", route);
      route();
    })
    .catch(function (error) {
      view.innerHTML = '<p class="empty"><strong>data.json could not be loaded.</strong>' +
        "Run <code>python build.py</code>, then serve the folder over http " +
        "(<code>python -m http.server</code>) rather than opening the file directly.<br>" +
        esc(error.message) + "</p>";
    });
})();
