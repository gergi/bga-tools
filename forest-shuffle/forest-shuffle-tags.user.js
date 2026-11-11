// ==UserScript==
// @name         BGA Forest Shuffle: symbol counts in player panels
// @namespace    https://github.com/gergi/bga-tools
// @version      0.2.0
// @description  Shows per-player tag and tree-symbol counts for Forest Shuffle on Board Game Arena, like the Smoky Mountains version does.
// @match        *://boardgamearena.com/*
// @match        *://*.boardgamearena.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/gergi/bga-tools/main/forest-shuffle/forest-shuffle-tags.meta.js
// @downloadURL  https://raw.githubusercontent.com/gergi/bga-tools/main/forest-shuffle/forest-shuffle-tags.user.js
// ==/UserScript==

(function () {
  "use strict";

  // Only run on Forest Shuffle game pages (e.g. /8/forestshuffle?table=123).
  if (!/\/forestshuffle\b/.test(location.pathname)) return;

  const ICON_PX = 26; // displayed icon size

  // Card sprite sheets used by the game, at the size the coordinates below were measured on.
  // Icons are drawn straight from these sheets with CSS, so no image data lives in this script.
  const SHEETS = {
    trees: ["trees.jpg", 1500, 2330],
    vCards: ["vCards.jpg", 2100, 3269],
    hCards: ["hCards.jpg", 2100, 3262],
    mountain: ["mountain.jpg", 2100, 1864],
    woodlands: ["woodlands.Jpg", 1800, 2796],
  };

  // Tag -> [sheet, x, y] of the 30px tag square on some card that shows it. Order is display order.
  const BASE_TAGS = [
    ["Tree", "trees", 17, 334],
    ["Bird", "vCards", 17, 135],
    ["Paw", "vCards", 1517, 1303],
    ["Bat", "hCards", 467, 297],
    ["Cloven-hoofed animal", "hCards", 1967, 254],
    ["Deer", "hCards", 1967, 290],
    ["Insect", "vCards", 617, 90],
    ["Butterfly", "vCards", 617, 127],
    ["Amphibian", "vCards", 317, 836],
    ["Mushroom", "vCards", 17, 369],
    ["Plant", "vCards", 1517, 369],
  ];
  // Expansion tags: only shown once any player has one.
  const EXTRA_TAGS = [
    ["Mountain", "mountain", 17, 326],
    ["Woodland Edge", "woodlands", 17, 311],
    ["Shrub", "woodlands", 17, 345],
  ];
  const TAG_SIZE = 30;

  // Tree symbol -> [sheet, x, y] of the 34px round symbol in the top-right corner of that tree's card.
  const BASE_SYMBOLS = [
    ["Linden", "trees", 251, 21],
    ["Oak", "trees", 551, 21],
    ["Silver Fir", "trees", 851, 21],
    ["Birch", "trees", 1151, 21],
    ["Beech", "trees", 1451, 21],
    ["Sycamore", "trees", 251, 487],
    ["Douglas Fir", "trees", 551, 487],
    ["Horse Chestnut", "trees", 851, 487],
  ];
  const EXTRA_SYMBOLS = [
    ["Larix", "mountain", 251, 21],
    ["Pinus", "mountain", 551, 21],
  ];
  const SYMBOL_SIZE = 34;

  let data = null; // { CARDS_DATA, SPECIES_DATA }

  // The game defines CARDS_DATA / SPECIES_DATA as top-level consts in
  // modules/js/card.js, so they are reachable by bare name from page context.
  // If the userscript manager sandboxes us, fall back to loading card.js ourselves.
  async function loadData() {
    try {
      // eslint-disable-next-line no-undef
      if (typeof CARDS_DATA !== "undefined" && typeof SPECIES_DATA !== "undefined") {
        // eslint-disable-next-line no-undef
        return { CARDS_DATA, SPECIES_DATA };
      }
    } catch (e) {}
    const base = window.g_gamethemeurl;
    if (!base) return null;
    const src = await (await fetch(base + "modules/js/card.js")).text();
    return new Function(src + "\n;return { CARDS_DATA, SPECIES_DATA };")();
  }

  function speciesInfo(name) {
    return data.SPECIES_DATA[name.replace(/[()-\s']/g, "")];
  }

  // Which half of a two-species card is in play depends on where it sits:
  // the bottom/right slot uses the second species (mirrors the game's getIdCard).
  function halfIndex(el) {
    const pos = el.dataset.position;
    return pos === "onBottom" || pos === "onRight" ? 1 : 0;
  }

  function countForPlayer(playerId) {
    const tags = {};
    const symbols = {};
    let saplings = 0;
    const seen = new Set();
    const cards = document.querySelectorAll(`#FOStable_${playerId} .treeContainer .card[data-id]`);
    for (const el of cards) {
      const card = data.CARDS_DATA[el.dataset.id];
      if (!card || seen.has(el.dataset.id)) continue;
      seen.add(el.dataset.id);
      const idx = halfIndex(el);
      const species = card.species[idx];
      if (!species) {
        if (card.type === "wCard") saplings++;
        continue;
      }
      const symbol = card.tree_symbol[idx];
      if (symbol) symbols[symbol] = (symbols[symbol] || 0) + 1;
      const info = speciesInfo(species);
      for (const tag of info?.tags || []) tags[tag] = (tags[tag] || 0) + 1;
    }
    return { tags, symbols, saplings };
  }

  function playerIds() {
    return [...document.querySelectorAll('[id^="FOStable_"]')].map((el) => el.id.slice("FOStable_".length));
  }

  // A div showing one region of a card sprite sheet, scaled to ICON_PX.
  function iconStyle(sheet, x, y, size) {
    const [file, w, h] = SHEETS[sheet];
    const k = ICON_PX / size;
    const url = (window.g_gamethemeurl || "") + "img/" + file;
    return (
      `background-image:url('${url}');` +
      `background-size:${w * k}px ${h * k}px;` +
      `background-position:${-x * k}px ${-y * k}px;`
    );
  }

  function cell(name, n, style, cls, title) {
    return (
      `<span class="fstags-cell${n ? "" : " fstags-zero"}" title="${title || name}">` +
      `<span class="fstags-icon ${cls}" style="${style}"></span><b>${n}</b></span>`
    );
  }

  function render() {
    const ids = playerIds();
    const all = Object.fromEntries(ids.map((id) => [id, countForPlayer(id)]));
    const anyHas = (key, name) => ids.some((id) => all[id][key][name] > 0);
    const tags = BASE_TAGS.concat(EXTRA_TAGS.filter(([t]) => anyHas("tags", t)));
    const symbols = BASE_SYMBOLS.concat(EXTRA_SYMBOLS.filter(([s]) => anyHas("symbols", s)));

    for (const id of ids) {
      const board = document.getElementById(`player_board_${id}`) || document.getElementById(`overall_player_board_${id}`);
      if (!board) continue;
      let box = document.getElementById(`fstags_${id}`);
      if (!box) {
        box = document.createElement("div");
        box.id = `fstags_${id}`;
        box.className = "fstags";
        board.appendChild(box);
      }
      const c = all[id];
      const tagCells = tags.map(([tag, sheet, x, y]) => {
        let title = tag;
        if (tag === "Tree" && c.saplings) title += ` (+${c.saplings} sapling${c.saplings > 1 ? "s" : ""} not counted)`;
        return cell(tag, c.tags[tag] || 0, iconStyle(sheet, x, y, TAG_SIZE), "fstags-tag", title);
      });
      const symbolCells = symbols.map(([sym, sheet, x, y]) =>
        cell(sym, c.symbols[sym] || 0, iconStyle(sheet, x, y, SYMBOL_SIZE), "fstags-symbol", `${sym} symbol`)
      );
      box.innerHTML =
        `<div class="fstags-row">${tagCells.join("")}</div>` +
        `<div class="fstags-row fstags-symbols">${symbolCells.join("")}</div>`;
    }
  }

  let timer = null;
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  }

  function addStyle() {
    const s = document.createElement("style");
    s.textContent = `
      .fstags { margin-top: 6px; }
      .fstags-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 6px; }
      .fstags-symbols { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.12); }
      .fstags-cell { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; font-size: 16px; }
      .fstags-cell b { min-width: 1ch; }
      .fstags-icon { display: inline-block; flex: none; width: ${ICON_PX}px; height: ${ICON_PX}px; background-repeat: no-repeat; }
      .fstags-tag { border-radius: ${Math.round((5 * ICON_PX) / TAG_SIZE)}px; }
      .fstags-symbol { border-radius: 50%; }
      .fstags-zero { opacity: 0.3; }
    `;
    document.head.appendChild(s);
  }

  async function start() {
    // Wait for the game UI to build the tableaus.
    for (let i = 0; i < 120 && !document.querySelector('[id^="FOStable_"]'); i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
    data = await loadData();
    if (!data) {
      console.warn("[fstags] could not find Forest Shuffle card data");
      return;
    }
    addStyle();
    render();
    // Cards are added/moved into #tables as the game progresses (also during replays).
    const tables = document.getElementById("tables") || document.body;
    new MutationObserver(scheduleRender).observe(tables, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-position", "data-id"],
    });
  }

  start();
})();

