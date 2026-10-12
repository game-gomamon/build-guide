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
  var DRAFT_KEY = "etheria.gvgDraft.v1";

  var draft = loadDraft();
  var draftUI = { query: "", element: "", hideUsed: false, target: null };
  var drag = null;
  var suppressClick = false;

  function loadDraft() {
    var empty = { tower: "", boards: {} };
    try {
      var raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (raw && typeof raw === "object" && raw.boards && typeof raw.boards === "object") {
        return { tower: String(raw.tower || ""), boards: raw.boards };
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

  /* ---- rendering ---- */

  function renderDraft() {
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
    var done = placed === total;
    var target = draftUI.target;

    host.innerHTML = '' +
      '<div class="board-head">' +
      '<div class="board-title"><span class="tower-dot" aria-hidden="true"></span>' +
      "<b>" + esc(tower.name) + " Tower</b>" +
      '<span class="board-count' + (done ? " is-done" : "") + '">' + placed + " / " + total + "</span></div>" +
      '<div class="board-actions">' +
      '<button type="button" class="btn" data-clear' + (placed ? "" : " disabled") + ">Clear</button>" +
      '<button type="button" class="btn btn-gold" data-export' + (done ? "" : " disabled") +
      ' title="' + (done ? "Save the draft as a picture" : "Fill every slot to export") + '">' +
      "Export image</button>" +
      "</div></div>" +
      '<p class="board-hint">' +
      (done
        ? "Draft complete. Export it as a picture to share with your guild."
        : "Drag a portrait into a slot, or tap a portrait to fill the next empty slot. " +
          "Tap a slot first to choose where the next pick goes.") +
      "</p>" +
      '<div class="d-teams">' +
      board.map(function (team, t) {
        var count = team.filter(Boolean).length;
        return '<div class="d-team' + (count === TEAM_SIZE ? " is-full" : "") + '">' +
          '<div class="d-team-head"><b>' + teamLabel(t) + "</b><span>" + count + " / " + TEAM_SIZE + "</span></div>" +
          '<div class="d-slots">' +
          team.map(function (id, s) {
            var isTarget = target && target.t === t && target.s === s;
            var a = id ? animusById(id) : null;
            var label = teamLabel(t) + ", slot " + (s + 1) + (a ? ": " + a.name : ": empty");
            if (!a) {
              return '<div class="d-slot is-empty' + (isTarget ? " is-target" : "") +
                '" data-team="' + t + '" data-slot="' + s + '" role="button" tabindex="0"' +
                ' aria-label="' + esc(label) + '" aria-pressed="' + !!isTarget + '">' +
                '<span class="d-plus" aria-hidden="true">+</span></div>';
            }
            return '<div class="d-slot is-filled' + (isTarget ? " is-target" : "") +
              '" data-team="' + t + '" data-slot="' + s + '" data-animus-slot="' + esc(a.id) + '"' +
              (has(a.element) ? ' data-element="' + esc(a.element) + '"' : "") +
              ' role="button" tabindex="0" aria-label="' + esc(label) + '" aria-pressed="' + !!isTarget + '">' +
              '<span class="slot-art">' + art(a.card || a.portrait, "", initials(a.name)) + "</span>" +
              '<span class="slot-name">' + esc(a.name) + "</span>" +
              '<button type="button" class="d-remove" data-remove aria-label="Remove ' + esc(a.name) +
              '">×</button></div>';
          }).join("") +
          "</div></div>";
      }).join("") +
      "</div>";

    host.querySelectorAll("img").forEach(function (img) { img.draggable = false; });
  }

  function refreshDraft() {
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
        draftUI.target = null;
        refreshDraft();
      }
      return;
    }
    if (event.target.closest("[data-export]")) {
      exportDraft();
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
    var slot = under && under.closest(".d-slot");
    if (slot !== drag.over) {
      if (drag.over) drag.over.classList.remove("is-over");
      if (slot) slot.classList.add("is-over");
      drag.over = slot;
    }
    var pool = under && under.closest(".pool");
    document.body.classList.toggle("is-over-pool", !!(pool && drag.from));
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
      var slot = under && under.closest(".d-slot");
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

  function exportDraft() {
    var tower = currentTower();
    var board = currentBoard();
    var button = view.querySelector("[data-export]");
    if (button) { button.disabled = true; button.textContent = "Preparing…"; }

    // Layout, in CSS pixels. The canvas is drawn at 2× for a sharp picture.
    var S = 2, PAD = 36, LABEL_W = 92, CARD_W = 150, CARD_H = 200, GAP = 12;
    var NAME_H = 0, ROW_GAP = 16, HEAD_H = 118, FOOT_H = 52;
    var ROW_H = CARD_H + NAME_H;
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
        var a = animusById(id);
        jobs.push(loadImage(a.card || a.portrait).then(function (img) { imageFor[id] = img; }));
        if (a.elementIcon && !imageFor["el:" + a.element]) {
          imageFor["el:" + a.element] = true;
          jobs.push(loadImage(a.elementIcon).then(function (img) { imageFor["el:" + a.element] = img; }));
        }
      });
    });

    Promise.all([fontsReady].concat(jobs)).then(function () {
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
      ctx.fillText(board.length + " TEAMS · " + (board.length * TEAM_SIZE) + " ANIMUS", W - PAD, PAD + 16);
      ctx.fillStyle = "#7E779A";
      ctx.font = '500 12px "Anuphan", sans-serif';
      ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
        W - PAD, PAD + 36);
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
          var a = animusById(id);
          var x = PAD + LABEL_W + 12 + s * (CARD_W + GAP);
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
        });
      });

      // Footer
      ctx.fillStyle = "#7E779A";
      ctx.font = '600 10.5px "Chakra Petch", sans-serif';
      drawSpaced(ctx, "ETHERIA RESTART · DATABASE", PAD, H - PAD + 4, 2.5);
      ctx.textAlign = "right";
      ctx.font = '500 11px "Anuphan", sans-serif';
      ctx.fillText(location.host || "", W - PAD, H - PAD + 4);
      ctx.textAlign = "left";

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
        toast("Saved " + filename);
      });
    }).catch(function (error) {
      toast("Could not create the image: " + error.message);
    }).then(function () {
      var again = view.querySelector("[data-export]");
      if (again) { again.disabled = false; again.textContent = "Export image"; }
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
