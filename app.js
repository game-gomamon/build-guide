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
    return team.slots.some(function (slot) {
      return norm(slot.name).indexOf(query) > -1;
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
      '<p class="eyebrow">Section 02</p>' +
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
      "</article>";
  }

  function teamSlot(slot) {
    var matrices = [0, 1, 2].map(function (i) {
      var m = slot.matrices[i];
      if (!m) return '<span class="gear-row"><span class="ph-mini"></span><span class="dash">—</span></span>';
      return '<span class="gear-row">' + icon(m.icon, "") + "<span>" + esc(m.name) + "</span></span>";
    }).join("");

    var shell = slot.shell
      ? '<span class="gear-row gear-shell">' + icon(slot.shell.icon, "") +
        "<span>" + esc(slot.shell.name) + "</span></span>"
      : '<span class="gear-row gear-shell"><span class="ph-mini"></span><span class="dash">—</span></span>';

    var open = slot.animusId ? "#build/" + encodeURIComponent(slot.animusId) : "#gvg";

    return '' +
      '<a class="slot" href="' + open + '"' +
      (has(slot.element) ? ' data-element="' + esc(slot.element) + '"' : "") + ">" +
      '<span class="slot-art">' + art(slot.card || slot.portrait, slot.name, initials(slot.name)) + "</span>" +
      '<span class="slot-info">' +
      '<span class="slot-name">' + esc(slot.name) +
      (has(slot.element) ? "<span>" + esc(slot.element) + "</span>" : "") +
      "</span>" +
      '<span class="slot-gear">' + matrices + shell + "</span>" +
      "</span></a>";
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
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/").map(decodeURIComponent);
    var head = parts[0] || "builds";

    if (head === "build" && parts[1]) {
      setActiveTab("builds");
      renderProfile(parts[1], parts[2]);
    } else if (head === "gvg") {
      setActiveTab("gvg");
      renderGVG(parts[1]);
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
        " builds · " + data.meta.teamCount + " GVG teams";
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
