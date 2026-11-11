// ==UserScript==
// @name         BGA Game Stats (Ark Nova + Forest Shuffle)
// @namespace    https://github.com/bga-stats/gamestats
// @version      1.0.0
// @description  Collects finished Ark Nova and Forest Shuffle tables from Board Game Arena and posts them to your game stats server.
// @match        https://boardgamearena.com/table*
// @match        https://*.boardgamearena.com/table*
// @match        https://boardgamearena.com/gamereview*
// @match        https://*.boardgamearena.com/gamereview*
// @match        https://boardgamearena.com/lobby*
// @match        https://*.boardgamearena.com/lobby*
// @match        https://boardgamearena.com/gamestats*
// @match        https://*.boardgamearena.com/gamestats*
// @match        https://boardgamearena.com/player*
// @match        https://*.boardgamearena.com/player*
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/gergi/bga-tools/main/gamestats/bga-stats.meta.js
// @downloadURL  https://raw.githubusercontent.com/gergi/bga-tools/main/gamestats/bga-stats.user.js
// ==/UserScript==

(function () {
"use strict";
/* bga-stats-collector-core 1.0.0 */
(() => {
  // src/pyish.js
  var ExtractError = class extends Error {
    constructor(code, message) {
      super(message);
      this.name = "ExtractError";
      this.code = code;
    }
  };
  var DEC_RE = /^-?[0-9]+(\.[0-9]+)?$/;
  function pyFloat(v) {
    let out;
    if (typeof v === "number") out = v;
    else if (typeof v === "string" && DEC_RE.test(v)) out = Number(v);
    else throw new ExtractError("bad_value", `not a plain decimal number: ${JSON.stringify(v)}`);
    if (!Number.isFinite(out)) throw new ExtractError("bad_value", `not finite: ${String(v)}`);
    return out;
  }
  function pyInt(v) {
    return Math.trunc(pyFloat(v)) + 0;
  }
  var pyIntFloat = pyInt;
  function optInt(v) {
    return v === void 0 || v === null || v === "" ? null : pyIntFloat(v);
  }
  function pyRepr(v) {
    if (v === void 0 || v === null) return "None";
    if (v === true) return "True";
    if (v === false) return "False";
    if (typeof v === "string") {
      const q = v.includes("'") && !v.includes('"') ? '"' : "'";
      const body = v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      return q + (q === "'" ? body.replace(/'/g, "\\'") : body) + q;
    }
    if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
    if (typeof v === "object") return "{" + Object.entries(v).map(([k, x]) => `${pyRepr(k)}: ${pyRepr(x)}`).join(", ") + "}";
    if (typeof v === "number") return pyNumStr(v);
    return String(v);
  }
  function pyNumStr(v) {
    if (Number.isNaN(v)) return "nan";
    if (!Number.isFinite(v)) return v < 0 ? "-inf" : "inf";
    if (Number.isInteger(v)) return String(v);
    const [mant, expo] = v.toExponential().split("e");
    const e = Number(expo);
    if (e < -4 || e >= 16) return `${mant}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
    return String(v).includes("e") ? v.toFixed(Math.max(0, -e + mant.replace(/[-.]/g, "").length - 1)) : String(v);
  }
  function pyStr(v) {
    return typeof v === "string" ? v : pyRepr(v);
  }
  function truthy(v) {
    if (v === void 0 || v === null || v === false || v === 0 || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  }
  function isDict(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function pyRound(x, n) {
    return Number(x.toFixed(n));
  }
  function req(d, key) {
    if (!isDict(d) || !Object.hasOwn(d, key)) throw new ExtractError("missing_key", `missing key ${JSON.stringify(key)}`);
    return d[key];
  }
  function get(d, key) {
    if (!isDict(d)) throw new ExtractError("bad_value", `.get(${JSON.stringify(key)}) on a non-object`);
    if (!Object.hasOwn(d, key)) return null;
    const v = d[key];
    return v === void 0 ? null : v;
  }
  var LATIN1 = "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml".split(" ");
  var NAMED = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    bull: "\u2022",
    hellip: "\u2026",
    ndash: "\u2013",
    mdash: "\u2014",
    lsquo: "\u2018",
    rsquo: "\u2019",
    ldquo: "\u201C",
    rdquo: "\u201D",
    euro: "\u20AC",
    trade: "\u2122",
    larr: "\u2190",
    rarr: "\u2192",
    uarr: "\u2191",
    darr: "\u2193",
    times: "\xD7",
    hearts: "\u2665",
    check: "\u2713"
  };
  LATIN1.forEach((n, i) => {
    NAMED[n] = String.fromCodePoint(160 + i);
  });
  var CP1252 = {
    128: 8364,
    130: 8218,
    131: 402,
    132: 8222,
    133: 8230,
    134: 8224,
    135: 8225,
    136: 710,
    137: 8240,
    138: 352,
    139: 8249,
    140: 338,
    142: 381,
    145: 8216,
    146: 8217,
    147: 8220,
    148: 8221,
    149: 8226,
    150: 8211,
    151: 8212,
    152: 732,
    153: 8482,
    154: 353,
    155: 8250,
    156: 339,
    158: 382,
    159: 376,
    129: 129,
    141: 141,
    143: 143,
    144: 144,
    157: 157
  };
  var LEGACY = /* @__PURE__ */ new Set([...LATIN1, "amp", "lt", "gt", "quot", "AMP", "LT", "GT", "QUOT", "COPY", "REG"]);
  for (const n of ["AMP", "LT", "GT", "QUOT", "COPY", "REG"]) NAMED[n] = NAMED[n.toLowerCase()];
  function htmlUnescape(s) {
    if (!s.includes("&")) return s;
    return s.replace(/&(#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[^\t\n\f <&#;]{1,32};?)/g, (m, body) => {
      if (body[0] === "#") {
        const hex = body[1] === "x" || body[1] === "X";
        const num = parseInt(body.slice(hex ? 2 : 1).replace(";", ""), hex ? 16 : 10);
        if (Object.hasOwn(CP1252, num)) return String.fromCodePoint(CP1252[num]);
        if (num >= 55296 && num <= 57343 || num > 1114111) return "\uFFFD";
        if (num === 0) return "\uFFFD";
        if (num >= 1 && num <= 8 || num >= 14 && num <= 31 || num >= 127 && num <= 159 || num >= 64976 && num <= 65007 || num === 11 || (num & 65534) === 65534) return "";
        return String.fromCodePoint(num);
      }
      if (body.endsWith(";")) {
        const name = body.slice(0, -1);
        if (Object.hasOwn(NAMED, name)) return NAMED[name];
      } else if (LEGACY.has(body)) return NAMED[body];
      for (let x = body.length - 1; x > 1; x--) {
        const prefix = body.slice(0, x);
        if (LEGACY.has(prefix)) return NAMED[prefix] + body.slice(x);
      }
      return m;
    });
  }
  function htmlUnescapeAny(x) {
    if (typeof x === "string") return htmlUnescape(x);
    if (Array.isArray(x) && !x.includes("&")) return x;
    if (isDict(x) && !Object.hasOwn(x, "&")) return x;
    throw new ExtractError("bad_value", "html.unescape() of a non-string");
  }
  function pyIter(v) {
    if (Array.isArray(v)) return v;
    if (isDict(v)) return Object.keys(v);
    if (typeof v === "string") return [...v];
    throw new ExtractError("bad_value", "object is not iterable");
  }
  function pyContains(v, needle) {
    if (typeof v === "string") return v.includes(needle);
    if (Array.isArray(v)) return v.includes(needle);
    if (isDict(v)) return Object.hasOwn(v, needle);
    throw new ExtractError("bad_value", "argument is not iterable");
  }

  // src/extract.js
  var SCHEMA_VERSION = "1.2";
  var GAMES = { 1741: "arknova", 1841: "forestshuffle" };
  var SUPPORTED_GAME_IDS = [1741, 1841];
  var MODES = ["normal", "friendly", "arena"];
  var DEC_LIKE = /^-?[0-9]+(\.[0-9]+)?$/;
  var FS_POSITIONS = /* @__PURE__ */ new Set(["Tree", "onTop", "onBottom", "onLeft", "onRight", "sapling"]);
  var FS_CARD_TYPES = /* @__PURE__ */ new Set(["Tree", "hCard", "vCard"]);
  var NORMAL = "normal";
  function outcomeOf(info) {
    const gameResult = truthy(get(info, "gameResult")) ? info.gameResult : {};
    const res = req(info, "result");
    const xs = [get(gameResult, "outcome"), get(res, "endgame_reason"), "normal"];
    return xs.find(truthy) ?? "normal";
  }
  function inSet(set, x) {
    if (Array.isArray(x) || isDict(x)) throw new ExtractError("bad_value", "unhashable value");
    return set.has(x);
  }
  function iso(epoch) {
    return new Date(pyInt(epoch) * 1e3).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  function stat(stats, key, pid) {
    const node = isDict(stats) ? stats[key] : void 0;
    if (!isDict(node)) return null;
    const vals = node.values;
    if (!isDict(vals) || !Object.hasOwn(vals, pid)) return null;
    const v = vals[pid];
    return v === void 0 ? null : v;
  }
  function label(stats, key, pid) {
    const node = isDict(stats) && truthy(stats[key]) ? stats[key] : {};
    const labels = get(node, "valuelabels");
    return isDict(labels) && Object.hasOwn(labels, pid) ? labels[pid] ?? null : null;
  }
  function buildOptions(info) {
    const out = {};
    const opts = truthy(info.options) ? info.options : {};
    if (!isDict(opts)) throw new ExtractError("bad_value", "options is not an object");
    for (const [oid, o] of Object.entries(opts)) {
      const values = get(o, "values");
      const value = get(o, "value");
      let name = null;
      try {
        if (Array.isArray(values)) name = req(values.at(pyInt(value)), "name");
        else if (isDict(values)) name = req(values[pyStr(value)], "name");
      } catch {
        name = null;
      }
      const rawName = isDict(o) && Object.hasOwn(o, "name") ? o.name : "";
      out[String(oid)] = {
        name: htmlUnescape(pyStr(rawName)),
        value: value === null ? null : pyStr(value),
        value_name: name === null ? null : htmlUnescapeAny(name)
      };
    }
    return out;
  }
  function* events(logs) {
    if (!isDict(logs)) throw new ExtractError("bad_value", "logs is not an object");
    const packets = Object.hasOwn(logs, "logs") ? logs.logs : [];
    for (const packet of pyIter(packets)) {
      if (!isDict(packet)) throw new ExtractError("bad_value", "log packet is not an object");
      const data = Object.hasOwn(packet, "data") ? packet.data : [];
      for (const note of pyIter(data)) yield [packet, note];
    }
  }
  var optFloat = (v) => v === null || v === void 0 || v === "" ? null : pyFloat(v);
  function buildCommon(info, source, completeness) {
    const res = req(info, "result");
    const blank = (v) => v === null || v === void 0 || v === "";
    if (blank(get(info, "gamestart")) || blank(get(res, "time_duration")) || !Array.isArray(get(res, "player")) || res.player.length === 0) {
      throw new ExtractError("not_started", "table never started (no gamestart, duration or players)");
    }
    for (const p of pyIter(req(res, "player"))) {
      const unset = (v) => v === null || v === "";
      if (unset(get(p, "gamerank")) || unset(get(p, "score"))) throw new ExtractError("abandoned", "table has no final scores (abandoned or cancelled)");
    }
    for (const p of res.player) {
      for (const k of ["rank_after_game", "point_win", "arena_after_game", "arena_points_win"]) {
        const v = get(p, k);
        if (typeof v === "string" && v !== "" && !DEC_LIKE.test(v) && !/\p{N}/u.test(v)) {
          throw new ExtractError("login_required", `${k} is masked (${JSON.stringify(v)}): tableinfos was fetched without a login`);
        }
      }
    }
    const gid = pyStr(req(info, "game_id"));
    if (!Object.hasOwn(GAMES, gid)) throw new ExtractError("unsupported_game", `unsupported game_id ${gid}`);
    const slug = GAMES[gid];
    const started = pyInt(req(info, "gamestart"));
    const duration = pyInt(req(res, "time_duration"));
    const opts = buildOptions(info);
    const modeVal = opts["201"]?.value ?? null;
    const speed = opts["200"] ?? {};
    const players = [];
    for (const p of req(res, "player")) {
      const after = optFloat(get(p, "rank_after_game"));
      const delta = optFloat(get(p, "point_win"));
      const arenaAfter = optFloat(get(p, "arena_after_game"));
      const arenaDelta = optFloat(get(p, "arena_points_win"));
      const rank = pyInt(req(p, "gamerank"));
      players.push({
        player_id: pyStr(req(p, "player_id")),
        name: req(p, "name"),
        rank,
        score: pyInt(req(p, "score")),
        score_aux: optInt(get(p, "score_aux")),
        winner: rank === 1,
        tie: get(p, "is_tie") === "1",
        play_order: optInt(get(p, "playorder")),
        is_ai: get(p, "is_ai") === "1",
        elo_before: after === null || delta === null ? null : pyRound(after - delta, 2),
        elo_after: after,
        elo_delta: delta,
        arena_before: arenaAfter === null || arenaDelta === null ? null : pyRound(arenaAfter - arenaDelta, 4),
        arena_after: arenaAfter,
        arena_delta: arenaDelta
      });
    }
    let mode = null;
    if (modeVal !== null) {
      const mi = pyInt(modeVal);
      if (mi < MODES.length) {
        mode = MODES.at(mi);
        if (mode === void 0) throw new ExtractError("bad_value", "mode index out of range");
      }
    }
    const outcome = outcomeOf(info);
    const rec = {
      schema_version: SCHEMA_VERSION,
      source,
      completeness,
      table_id: pyStr(req(info, "id")),
      game: { slug, id: pyInt(info.game_id) },
      started_at: iso(started),
      finished_at: iso(started + duration),
      duration_seconds: duration,
      outcome,
      end_reason: get(res, "endgame_reason"),
      mode,
      speed: truthy(speed) ? { id: optInt(get(speed, "value")), name: get(speed, "value_name") } : null,
      player_count: players.length,
      table_level: optInt(get(res, "table_level")),
      table_options: opts,
      players
    };
    const unranked = get(info, "unranked");
    if (unranked === "0" || unranked === "1") rec.ranked = unranked === "0";
    return rec;
  }
  var ARK_STATS = [
    // [output path, BGA stat key]
    ["turns", "turns"],
    ["breaks_triggered", "breaksTriggered"],
    ["conservation", "conservation"],
    ["reputation", "reputation"],
    ["appeal", "appeal"],
    ["actions.build", "actionBuild"],
    ["actions.animals", "actionAnimals"],
    ["actions.cards", "actionCards"],
    ["actions.association", "actionAssociation"],
    ["actions.sponsors", "actionSponsors"],
    ["action_card_slots.animals", "actionCardAnimals"],
    ["action_card_slots.build", "actionCardBuild"],
    ["action_card_slots.association", "actionCardAssociation"],
    ["action_card_slots.cards", "actionCardCards"],
    ["action_card_slots.sponsors", "actionCardSponsors"],
    ["x_tokens.gained", "xTokenGained"],
    ["x_tokens.gained_instead_of_action", "xTokenGainedInsteadOfAction"],
    ["x_tokens.used", "xTokenUsed"],
    ["money.gained", "moneyGained"],
    ["money.gained_income", "moneyGainedIncome"],
    ["money.spent_animals", "moneyUsedAnimals"],
    ["money.spent_enclosures", "moneyUsedBuild"],
    ["money.spent_donations", "moneyUsedDonations"],
    ["money.spent_display_cards", "moneyUsedFromDisplay"],
    ["cards.drawn_from_deck", "cardsDrawn"],
    ["cards.taken_from_display", "cardsTaken"],
    ["cards.snapped", "cardsSnapped"],
    ["cards.discarded", "cardsDiscarded"],
    ["cards.sponsors_played", "sponsorsPlayed"],
    ["cards.animals_played", "animalsPlayed"],
    ["cards.animals_released", "animalsReleased"],
    ["association.workers", "associationWorkers"],
    ["association.donation", "associationDonation"],
    ["association.reputation", "associationReputation"],
    ["association.partner_zoo", "associationPartner"],
    ["association.university", "associationUniversity"],
    ["association.conservation", "associationConservation"],
    ["built.enclosures", "builtEnclosures"],
    ["built.kiosks", "builtKiosks"],
    ["built.pavilions", "builtPavilions"],
    ["built.unique_buildings", "builtUniqueStructures"],
    ["built.covered_hexes", "coveredHexes"],
    ["built.empty_hexes", "emptyHexes"],
    ["upgrades.total", "upgradedCards"],
    ["icons.africa", "iconAfrica"],
    ["icons.europe", "iconEurope"],
    ["icons.asia", "iconAsia"],
    ["icons.australia", "iconAustralia"],
    ["icons.americas", "iconAmericas"],
    ["icons.bird", "iconBird"],
    ["icons.predator", "iconPredator"],
    ["icons.herbivore", "iconHerbivore"],
    ["icons.bear", "iconBear"],
    ["icons.reptile", "iconReptile"],
    ["icons.primate", "iconPrimate"],
    ["icons.petting_zoo", "iconPet"],
    ["icons.sea_animal", "iconSeaAnimal"],
    ["icons.water", "iconWater"],
    ["icons.rock", "iconRock"],
    ["icons.science", "iconScience"]
  ];
  var ARK_UPGRADE_FLAGS = [
    ["animals", "upgradedActionAnimals"],
    ["build", "upgradedActionBuild"],
    ["cards", "upgradedActionCards"],
    ["sponsors", "upgradedActionSponsors"],
    ["association", "upgradedActionAssociation"]
  ];
  function setPath(d, path, value) {
    const parts = path.split(".");
    const leaf = parts.pop();
    for (const p of parts) {
      if (!isDict(d[p])) d[p] = {};
      d = d[p];
    }
    d[leaf] = value;
  }
  function card(cardId, name) {
    const out = { id: cardId };
    if (truthy(name)) out.name = name;
    return out;
  }
  function playerStats(info) {
    const s = req(req(info.result, "stats"), "player");
    if (Array.isArray(s) && s.length === 0) return {};
    if (!isDict(s)) throw new ExtractError("bad_value", "result.stats.player is not an object");
    return s;
  }
  function buildArknovaDetails(info, logs) {
    const stats = playerStats(info);
    const resPlayers = req(info.result, "player");
    const players = [];
    for (const p of resPlayers) {
      const pid = pyStr(req(p, "player_id"));
      const row = { player_id: pid };
      for (const [path, key] of ARK_STATS) {
        const v = stat(stats, key, pid);
        if (v !== null) setPath(row, path, pyIntFloat(v));
      }
      const gs = stat(stats, "score", pid);
      if (gs !== null) row.game_score = pyIntFloat(gs);
      const t = stat(stats, "reflexion_time", pid);
      if (t !== null) row.thinking_time_seconds = pyIntFloat(t);
      const pos = stat(stats, "position", pid);
      if (pos !== null) row.starting_position = pyInt(pos);
      const end = stat(stats, "endGameTriggered", pid);
      if (end !== null) row.triggered_end_game = end === "1";
      const mp = stat(stats, "map", pid);
      if (mp !== null) row.map = { id: pyInt(mp), name: label(stats, "map", pid) };
      const drafted = [];
      ["drafted1", "drafted2", "drafted3"].forEach((key, i) => {
        const lab = label(stats, key, pid);
        if (truthy(lab)) drafted.push({ order: i + 1, label: lab });
      });
      if (drafted.length) row.drafted_action_cards = drafted;
      const flags = {};
      for (const [k, key] of ARK_UPGRADE_FLAGS) {
        const v = stat(stats, key, pid);
        if (v !== null) flags[k] = v === "1";
      }
      if (Object.keys(flags).length) {
        if (!isDict(row.upgrades)) row.upgrades = {};
        Object.assign(row.upgrades, flags);
      }
      players.push(row);
    }
    if (logs !== null && logs !== void 0) {
      const byPid = new Map(players.map((r) => [r.player_id, r]));
      for (const r of players) {
        r.animals_played = [];
        r.sponsors_played = [];
        r.projects_supported = [];
      }
      for (const [packet, n] of events(logs)) {
        const a = get(n, "args");
        const t = get(n, "type");
        if (!isDict(a)) continue;
        const pid = pyStr(get(a, "player_id") ?? "");
        if (t === "buyAnimal" && byPid.has(pid)) {
          byPid.get(pid).animals_played.push(card(req(a, "card_id"), get(a, "card_name")));
        } else if (t === "playSponsor" && byPid.has(pid)) {
          byPid.get(pid).sponsors_played.push(card(req(a, "card_id"), get(a, "card_name")));
        } else if (t === "slideMeeples" && pyContains(Object.hasOwn(n, "log") ? n.log : "", "supports a conservation project") && byPid.has(pid)) {
          byPid.get(pid).projects_supported.push(card(req(a, "card_id"), get(a, "card_name")));
        } else if (t === "finalScoring" && byPid.has(pid)) {
          const r = byPid.get(pid);
          r.conservation_points_scored = req(a, "conservationScore");
          const hand = Object.hasOwn(a, "scoringHand") ? a.scoringHand : [];
          r.final_scoring_cards = pyIter(hand).map((c) => req(c, "id"));
        } else if (t === "updateInitialSelection") {
          const channel = Object.hasOwn(packet, "channel") ? packet.channel : "";
          if (typeof channel !== "string") throw new ExtractError("bad_value", "packet.channel is not a string");
          const m = /\/player\/p(\d+)/.exec(channel);
          const inner = truthy(get(a, "args")) ? a.args : {};
          const priv = truthy(get(inner, "_private")) ? inner._private : {};
          if (m && byPid.has(m[1]) && truthy(get(priv, "cards")) && truthy(get(priv, "selection"))) {
            byPid.get(m[1]).initial_hand = { offered: priv.cards, kept: priv.selection };
          }
        }
      }
    }
    const placeholder = outcomeOf(info) !== NORMAL;
    players.forEach((r, i) => {
      const appeal = Object.hasOwn(r, "appeal") ? r.appeal : null;
      delete r.appeal;
      const total = placeholder ? Object.hasOwn(r, "game_score") ? r.game_score : null : pyInt(req(resPlayers[i], "score"));
      if (appeal !== null && total !== null && !(placeholder && total - appeal < 0)) r.score_breakdown = { appeal, conservation_points: total - appeal };
    });
    const maps = players.filter((r) => "map" in r).map((r) => r.map);
    const opts = buildOptions(info);
    const exp = opts["111"]?.value_name ?? null;
    return {
      map: maps.length && maps.every((m) => JSON.stringify(m) === JSON.stringify(maps[0])) ? maps[0] : null,
      marine_worlds: exp !== null ? exp === "Marine Worlds" : null,
      players
    };
  }
  function buildForestshuffleDetails(info, logs) {
    const stats = playerStats(info);
    const statsNode = req(info.result, "stats");
    if (!isDict(statsNode)) throw new ExtractError("bad_value", "result.stats is not an object");
    const table = Object.hasOwn(statsNode, "table") ? statsNode.table : {};
    const players = [];
    for (const p of req(info.result, "player")) {
      const pid = pyStr(req(p, "player_id"));
      const row = { player_id: pid };
      const pts = {};
      for (const [out2, key] of [
        ["trees", "tree_points"],
        ["top_bottom", "top_bottom_points"],
        ["left_right", "left_right_points"],
        ["cave", "cave_points"]
      ]) {
        const v2 = stat(stats, key, pid);
        if (v2 !== null) pts[out2] = pyIntFloat(v2);
      }
      if (Object.keys(pts).length && outcomeOf(info) === NORMAL) row.points = pts;
      let v = stat(stats, "played_cards", pid);
      if (v !== null) row.cards_played = pyIntFloat(v);
      v = stat(stats, "reflexion_time", pid);
      if (v !== null) row.thinking_time_seconds = pyIntFloat(v);
      players.push(row);
    }
    if (logs !== null && logs !== void 0) {
      const byPid = new Map(players.map((r) => [r.player_id, r]));
      for (const r of players) r.played = [];
      for (const [, n] of events(logs)) {
        const a = get(n, "args");
        if (get(n, "type") === "playCard" && isDict(a) && byPid.has(pyStr(get(a, "player_id")))) {
          const ctype = req(a, "cardType");
          const pos = req(a, "position");
          const card2 = {
            card_id: pyInt(req(a, "cardId")),
            species: req(a, "specie"),
            card_type: inSet(FS_CARD_TYPES, ctype) ? ctype : "other",
            position: inSet(FS_POSITIONS, pos) ? pos : "other",
            cost: pyInt(req(a, "cost")),
            tree_id: optInt(get(a, "treeId"))
          };
          if (card2.card_type === "other") card2.card_type_raw = pyStr(ctype);
          if (card2.position === "other") card2.position_raw = pyStr(pos);
          byPid.get(pyStr(a.player_id)).played.push(card2);
        }
      }
    }
    const out = { players };
    if (pyContains(table, "turns_number")) out.turns = pyInt(req(table.turns_number, "value"));
    return out;
  }
  function buildRecord(info, logs, source) {
    if (!isDict(info)) throw new ExtractError("bad_input", "tableinfos data is not an object");
    const rec = buildCommon(info, source, logs !== null && logs !== void 0 ? "full" : "stats");
    rec.details = rec.game.slug === "arknova" ? buildArknovaDetails(info, logs) : buildForestshuffleDetails(info, logs);
    return rec;
  }
  function unwrapData(body) {
    if (isDict(body) && Object.hasOwn(body, "status") && Object.hasOwn(body, "data")) return body.data;
    return body;
  }
  var ID_RE = /^[1-9][0-9]{0,14}$/;
  var MIN_MS = Date.UTC(2e3, 0, 1);
  var MAX_MS = Date.UTC(2100, 0, 1);
  function recordProblems(rec) {
    const out = [];
    if (!ID_RE.test(String(rec.table_id))) out.push(`table_id ${JSON.stringify(rec.table_id)} does not match ${ID_RE}`);
    for (const p of rec.players || []) if (!ID_RE.test(String(p.player_id))) out.push(`player_id ${JSON.stringify(p.player_id)} does not match ${ID_RE}`);
    for (const [k, v] of [["started_at", rec.started_at], ["finished_at", rec.finished_at], ["source.collected_at", rec.source?.collected_at]]) {
      const t = Date.parse(v);
      if (!(t >= MIN_MS && t < MAX_MS)) out.push(`${k} ${JSON.stringify(v)} is outside 2000-01-01 .. 2100-01-01`);
    }
    return out;
  }

  // src/util.js
  var MAX_TIMER_MS = 2 ** 31 - 1;
  var clampTimer = (ms) => Math.max(0, Math.min(Number.isFinite(ms) ? ms : MAX_TIMER_MS, MAX_TIMER_MS));
  var defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, clampTimer(ms)));
  var TimeoutError = class extends Error {
    constructor(ms) {
      super(`timed out after ${ms} ms`);
      this.name = "TimeoutError";
      this.code = "timeout";
    }
  };
  function withTimeout(run, ms) {
    const ac = new AbortController();
    const work = Promise.resolve().then(() => run(ac.signal));
    work.catch(() => {
    });
    if (!(ms > 0) || ms === Infinity) return work;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        ac.abort();
        reject(new TimeoutError(ms));
      }, clampTimer(ms));
    });
    return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
  }
  var AbortedError = class extends Error {
    constructor() {
      super("aborted");
      this.name = "AbortedError";
      this.code = "aborted";
    }
  };
  function throwIfAborted(signal) {
    if (signal?.aborted) throw new AbortedError();
  }
  function backoffMs(attempt, baseMs, maxMs, random = Math.random) {
    const raw = Math.min(maxMs, baseMs * 2 ** attempt);
    return Math.round(raw * (0.8 + 0.4 * random()));
  }
  function retryAfterMs(response, nowMs) {
    const h = response?.headers?.get?.("retry-after");
    if (!h) return null;
    if (/^\d+$/.test(h.trim())) return Number(h) * 1e3;
    const t = Date.parse(h);
    return Number.isNaN(t) ? null : Math.max(0, t - nowMs);
  }
  function fetchFromGM(gmXhr, { timeoutMs = 3e4 } = {}) {
    return (url, init = {}) => new Promise((resolve, reject) => {
      let done = false;
      let handle;
      const finish = (fn, v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn(v);
      };
      const timeoutErr = () => new TimeoutError(timeoutMs);
      const timer = timeoutMs > 0 ? setTimeout(() => {
        try {
          handle?.abort?.();
        } catch {
        }
        finish(reject, timeoutErr());
      }, clampTimer(timeoutMs)) : 0;
      handle = gmXhr({
        url,
        method: init.method || "GET",
        headers: init.headers,
        data: init.body,
        timeout: timeoutMs,
        onload: (r) => {
          const hdrs = /* @__PURE__ */ new Map();
          for (const line of String(r.responseHeaders || "").split(/\r?\n/)) {
            const i = line.indexOf(":");
            if (i > 0) hdrs.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
          }
          finish(resolve, { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: (k) => hdrs.get(k.toLowerCase()) ?? null }, text: async () => r.responseText });
        },
        onerror: () => finish(reject, new TypeError("network error")),
        ontimeout: () => finish(reject, timeoutErr()),
        onabort: () => finish(reject, new TypeError("aborted"))
      });
    });
  }

  // src/bga-client.js
  var BgaError = class extends Error {
    /** code: network | timeout | http | bad_response | session | auth | not_found | archive_missing | replay_lost | replay_limit | not_premium | no_logs | rate_limited | bga_error | not_finished */
    constructor(code, message, { retryable = false, status = null, url = null } = {}) {
      super(message);
      this.name = "BgaError";
      this.code = code;
      this.retryable = retryable;
      this.status = status;
      this.url = url;
    }
  };
  function classifyBgaError(message) {
    const m = String(message || "");
    if (/invalid session information|try reloading the page/i.test(m)) return "session";
    if (/limit.*replay|replay.*limit/i.test(m)) return "replay_limit";
    if (/premium|membership|subscribe/i.test(m)) return "not_premium";
    if (/replay for this game has been lost|empty archive file/i.test(m)) return "replay_lost";
    if (/cannot find gamenotifs log file|archived table/i.test(m)) return "archive_missing";
    if (/no (replay|game ?log)|log.*not available|replay.*not available/i.test(m)) return "no_logs";
    if (/must be logged|not logged|you must be connected|please log ?in/i.test(m)) return "auth";
    if (/too many|slow down|rate ?limit|too fast|try again later/i.test(m)) return "rate_limited";
    if (/does not exist|unknown table|table not found|no such table/i.test(m)) return "not_found";
    return "bga_error";
  }
  var TOKEN_RE = /requestToken\s*[:=]\s*['"]([^'"]+)['"]/;
  function createBgaClient(adapter, options = {}) {
    const o = {
      baseUrl: "https://boardgamearena.com",
      minRequestGapMs: 2500,
      // between any two BGA requests (recon politeness: 2.5 s+ between page-ish requests)
      minArchiveGapMs: 4e3,
      // between two archive calls (requestTableArchive / logs)
      timeoutMs: 3e4,
      // per request, request + body read (0 disables); also bounds adapter.getToken()
      maxRetryAfterMs: 3e5,
      // cap for a server-provided Retry-After
      retries: 3,
      // extra attempts for transient failures
      retryBaseMs: 1500,
      retryMaxMs: 3e4,
      archiveRetries: 2,
      // extra requestTableArchive+logs rounds when the log is "not found"
      archiveMode: "always",
      // "always": B then C. "on-demand": C first, B only if C says the archive is missing
      sleep: defaultSleep,
      now: () => Date.now(),
      random: Math.random,
      signal: void 0,
      ...options
    };
    const stats = { requests: 0, archiveRequests: 0, retries: 0 };
    let token = null;
    let tokenPromise = null;
    let lastRequestAt = -Infinity;
    let lastArchiveAt = -Infinity;
    let chain = Promise.resolve();
    const serial = (fn) => {
      const run = chain.then(fn, fn);
      chain = run.catch(() => {
      });
      return run;
    };
    async function pace(archive) {
      const wait = Math.max(lastRequestAt + o.minRequestGapMs, archive ? lastArchiveAt + o.minArchiveGapMs : -Infinity) - o.now();
      if (wait > 0) await o.sleep(wait);
      throwIfAborted(o.signal);
      const t = o.now();
      lastRequestAt = t;
      if (archive) {
        lastArchiveAt = t;
        stats.archiveRequests++;
      }
      stats.requests++;
    }
    async function rawFetch(url, init, archive) {
      throwIfAborted(o.signal);
      await pace(archive);
      try {
        return await withTimeout(async (signal) => {
          const r = await adapter.fetch(url, { ...init, signal });
          const text = await r.text();
          return { status: r.status, headers: r.headers, text: async () => text };
        }, o.timeoutMs);
      } catch (e) {
        if (e instanceof TimeoutError) throw new BgaError("timeout", e.message, { retryable: true, url });
        throw new BgaError("network", `network error: ${e?.message || e}`, { retryable: true, url });
      }
    }
    async function readJson(res, url) {
      const status = res.status;
      if (status === 429 || status >= 500 || status === 408) {
        const e = new BgaError(status === 429 ? "rate_limited" : "http", `HTTP ${status}`, { retryable: true, status, url });
        e.retryAfterMs = retryAfterMs(res, o.now());
        throw e;
      }
      if (status === 401 || status === 403) throw new BgaError("auth", `HTTP ${status}`, { status, url });
      if (status >= 400) throw new BgaError("http", `HTTP ${status}`, { status, url });
      let text;
      try {
        text = await res.text();
      } catch (e) {
        throw new BgaError("network", `body read failed: ${e?.message || e}`, { retryable: true, url });
      }
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new BgaError("bad_response", "response is not JSON (maintenance or login page?)", { status, url });
      }
      if (body && typeof body === "object" && body.status !== void 0 && String(body.status) !== "1") {
        const code = classifyBgaError(body.error);
        throw new BgaError(code, `BGA error: ${body.error ?? "unknown"}`, { retryable: code === "rate_limited", status, url });
      }
      return body;
    }
    function getToken(force = false) {
      if (token && !force) return Promise.resolve(token);
      if (!tokenPromise) tokenPromise = loadToken().finally(() => {
        tokenPromise = null;
      });
      return tokenPromise;
    }
    async function loadToken() {
      let t = null;
      if (adapter.getToken) {
        try {
          t = await withTimeout(() => adapter.getToken(), o.timeoutMs);
        } catch (e) {
          if (e instanceof TimeoutError) throw new BgaError("timeout", `getToken ${e.message}`, { retryable: true });
          throw e;
        }
      }
      if (!t) {
        const url = `${o.baseUrl}/lobby`;
        const res = await serial(() => rawFetch(url, { method: "GET", credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } }, false));
        if (res.status >= 400) throw new BgaError("http", `token page HTTP ${res.status}`, { status: res.status, url, retryable: res.status >= 500 });
        const m = TOKEN_RE.exec(await res.text());
        t = m && m[1];
      }
      if (!t) throw new BgaError("session", "could not obtain BGA request token", {});
      token = t;
      return token;
    }
    async function call(path, { archive = false, method = "GET", form = null } = {}) {
      const url = `${o.baseUrl}${path}`;
      let refreshed = false;
      for (let attempt = 0; ; attempt++) {
        try {
          const tok = await getToken();
          const headers = { "X-Request-Token": tok, "X-Requested-With": "XMLHttpRequest" };
          const init = { method, headers, credentials: "include" };
          if (form) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            init.body = form;
          }
          const res = await serial(() => rawFetch(url, init, archive));
          return await readJson(res, url);
        } catch (e) {
          if (!(e instanceof BgaError)) throw e;
          if (e.code === "session" && !refreshed) {
            refreshed = true;
            token = null;
            continue;
          }
          if (e.retryable && attempt < o.retries) {
            stats.retries++;
            await o.sleep(e.retryAfterMs != null ? Math.min(e.retryAfterMs, o.maxRetryAfterMs) : backoffMs(attempt, o.retryBaseMs, o.retryMaxMs, o.random));
            continue;
          }
          throw e;
        }
      }
    }
    const q = (params) => new URLSearchParams(params).toString();
    async function tableInfos(tableId) {
      const body = await call(`/table/table/tableinfos.html?${q({ id: String(tableId) })}`);
      const d = body.data;
      if (!d || typeof d !== "object") throw new BgaError("not_found", `tableinfos for ${tableId} has no data`);
      if (!d.result || !Array.isArray(d.result.player) || d.result.time_duration === void 0) {
        throw new BgaError("not_finished", `table ${tableId} has no final result`);
      }
      return d;
    }
    async function requestArchive(tableId) {
      await call(`/gamereview/gamereview/requestTableArchive.html?${q({ table: String(tableId) })}`, { archive: true });
    }
    async function fetchLogsOnce(tableId) {
      const body = await call(`/archive/archive/logs.html?${q({ table: String(tableId), translated: "true" })}`, { archive: true });
      if (!body.data || !Array.isArray(body.data.logs)) throw new BgaError("bad_response", `logs for ${tableId} malformed`);
      return body.data;
    }
    async function logs(tableId) {
      for (let round = 0; ; round++) {
        const needArchive = o.archiveMode === "always" || round > 0;
        if (needArchive) await requestArchive(tableId);
        try {
          return await fetchLogsOnce(tableId);
        } catch (e) {
          if (!(e instanceof BgaError) || e.code !== "archive_missing" || round >= o.archiveRetries) throw e;
          if (needArchive) await o.sleep(o.minArchiveGapMs * (round + 1));
        }
      }
    }
    async function fetchTable(tableId, { withLogs = false } = {}) {
      const info = await tableInfos(tableId);
      if (!withLogs) return { info, logs: null, logsError: null };
      try {
        return { info, logs: await logs(tableId), logsError: null };
      } catch (e) {
        if (e instanceof BgaError && ["auth", "archive_missing", "replay_lost", "not_found", "bga_error", "bad_response", "replay_limit", "not_premium", "no_logs"].includes(e.code)) {
          return { info, logs: null, logsError: e };
        }
        throw e;
      }
    }
    async function getGamesPage({ playerId, gameId, page = 1 }) {
      const params = { player: String(playerId), opponent_id: "0", game_id: String(gameId), finished: "0", updateStats: "0" };
      if (page > 1) params.page = String(page);
      const body = await call(`/gamestats/gamestats/getGames.html?${q(params)}`);
      const d = body.data || {};
      const tables = Array.isArray(d.tables) ? d.tables : [];
      const g = Array.isArray(d.stats?.games) ? d.stats.games.find((x) => String(x.game_id) === String(gameId)) : null;
      return { tables, totalForGame: g ? Number(g.cnt) : null };
    }
    return { getToken, tableInfos, requestArchive, logs, fetchTable, getGamesPage, stats, options: o };
  }

  // src/server-client.js
  var ServerError = class extends Error {
    /** code: timeout | network | auth | forbidden | invalid_record | too_large | rate_limited | server | http | bad_response. Only invalid_record is a final verdict. */
    constructor(code, message, { retryable = false, status = null, details = null } = {}) {
      super(message);
      this.name = "ServerError";
      this.code = code;
      this.retryable = retryable;
      this.status = status;
      this.details = details;
    }
  };
  var INGEST_STATUSES = /* @__PURE__ */ new Set(["created", "updated", "unchanged", "ignored"]);
  function createServerClient(adapter, options) {
    const o = {
      baseUrl: void 0,
      // e.g. "http://203.0.113.10:8080" (no trailing /api/v1)
      token: void 0,
      // string or () => string | Promise<string>
      retries: 1,
      timeoutMs: 3e4,
      // per request including the body read (0 disables)
      maxRetryAfterMs: 3e5,
      // cap on a server-provided Retry-After
      maxInlineWaitMs: 1e4,
      // longer waits are not slept inside the call: the error carries retryAfterMs and the queue schedules the retry
      retryBaseMs: 1e3,
      retryMaxMs: 15e3,
      sleep: defaultSleep,
      now: () => Date.now(),
      random: Math.random,
      signal: void 0,
      ...options
    };
    if (!o.baseUrl) throw new Error("createServerClient: baseUrl is required");
    const base = o.baseUrl.replace(/\/+$/, "") + "/api/v1";
    async function request(method, path, body) {
      const url = base + path;
      for (let attempt = 0; ; attempt++) {
        throwIfAborted(o.signal);
        try {
          const tok = typeof o.token === "function" ? await withTimeout(() => o.token(), o.timeoutMs) : o.token;
          const headers = { Accept: "application/json" };
          if (tok) headers.Authorization = `Bearer ${tok}`;
          const init = { method, headers };
          if (body !== void 0) {
            headers["Content-Type"] = "application/json; charset=utf-8";
            init.body = JSON.stringify(body);
          }
          let res;
          try {
            res = await withTimeout(async (signal) => {
              const r = await adapter.fetch(url, { ...init, signal });
              let text = "";
              try {
                text = await r.text();
              } catch (e) {
                if (e?.name === "TimeoutError") throw e;
              }
              return { status: r.status, headers: r.headers, text: async () => text };
            }, o.timeoutMs);
          } catch (e) {
            if (e instanceof TimeoutError || e?.name === "TimeoutError") throw new ServerError("timeout", e.message, { retryable: true });
            throw new ServerError("network", `network error: ${e?.message || e}`, { retryable: true });
          }
          return await interpret(res);
        } catch (e) {
          if (!(e instanceof ServerError) || !e.retryable || attempt >= o.retries) throw e;
          const wait = e.retryAfterMs ?? backoffMs(attempt, o.retryBaseMs, o.retryMaxMs, o.random);
          if (wait > o.maxInlineWaitMs) throw e;
          await o.sleep(wait);
        }
      }
    }
    async function interpret(res) {
      const status = res.status;
      let text = "";
      try {
        text = await res.text();
      } catch {
      }
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (status >= 200 && status < 300) {
        if (json === null || typeof json !== "object") throw new ServerError("bad_response", `HTTP ${status} with a non-JSON body (proxy or login page?)`, { status, retryable: true });
        return json;
      }
      const err = json?.error;
      const msg = err?.message || `HTTP ${status}`;
      const details = err?.details ?? null;
      let e;
      if (status === 401) e = new ServerError("auth", msg, { status, details });
      else if (status === 403) e = new ServerError("forbidden", msg, { status, details });
      else if (status === 413) e = new ServerError("too_large", msg, { status, details });
      else if (status === 422 && err && typeof err === "object") e = new ServerError("invalid_record", msg, { status, details });
      else if (status === 429) {
        e = new ServerError("rate_limited", msg, { status, details, retryable: true });
        const ra = retryAfterMs(res, o.now());
        if (ra != null) e.retryAfterMs = Math.min(ra, o.maxRetryAfterMs);
      } else if (status >= 500 || status === 408) e = new ServerError("server", msg, { status, details, retryable: true });
      else e = new ServerError("http", msg, { status, details });
      throw e;
    }
    async function postRecord(record) {
      const body = await request("POST", "/records", record);
      if (!INGEST_STATUSES.has(body.status)) throw new ServerError("bad_response", `unexpected ingest status ${JSON.stringify(body.status)}`);
      return { status: body.status, table_id: String(body.table_id ?? record.table_id) };
    }
    async function known(tableIds) {
      const ids = [...new Set(tableIds.map(String))];
      const out = /* @__PURE__ */ new Map();
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const body = await request("GET", `/records/known?table_ids=${encodeURIComponent(chunk.join(","))}`);
        for (const id of chunk) {
          const v = Object.hasOwn(body, id) ? body[id] : null;
          out.set(id, v === "stats" || v === "full" ? v : null);
        }
      }
      return out;
    }
    async function health() {
      return request("GET", "/health");
    }
    return { postRecord, known, health };
  }

  // src/validate.js
  var ID_RE2 = /^[1-9][0-9]{0,14}$/;
  var MIN_MS2 = Date.UTC(2e3, 0, 1);
  var MAX_MS2 = Date.UTC(2100, 0, 1);
  var LOG_FIELDS = ["animals_played", "sponsors_played", "projects_supported", "played", "initial_hand"];
  var isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  function nonFinite(node, path = "") {
    if (typeof node === "number" && !Number.isFinite(node)) return [path || "<root>"];
    if (Array.isArray(node)) return node.flatMap((v, i) => nonFinite(v, `${path}/${i}`));
    if (isObj(node)) return Object.entries(node).flatMap(([k, v]) => nonFinite(v, `${path}/${k}`));
    return [];
  }
  function localProblems(rec) {
    const out = [];
    const add = (rule, message) => out.push({ rule, message });
    if (!isObj(rec)) return [{ rule: "not_an_object", message: "record is not an object" }];
    for (const p of nonFinite(rec)) add("non_finite", `${p}: non-finite number`);
    if (!ID_RE2.test(String(rec.table_id))) add("id_pattern", `table_id ${JSON.stringify(rec.table_id)} does not match ${ID_RE2}`);
    const players = Array.isArray(rec.players) ? rec.players : [];
    for (const p of players) if (!ID_RE2.test(String(p?.player_id))) add("id_pattern", `player_id ${JSON.stringify(p?.player_id)} does not match ${ID_RE2}`);
    if (rec.player_count !== players.length) add("player_count", "player_count != players.length");
    const ids = players.map((p) => p?.player_id);
    if (new Set(ids).size !== ids.length) add("duplicate_player_id", "duplicate player_id in players");
    for (const p of players) if (p?.winner !== (p?.rank === 1)) add("winner_rank", `player ${p?.player_id}: winner must equal (rank == 1)`);
    const det = Array.isArray(rec.details?.players) ? rec.details.players : [];
    if (det.some((d) => !ids.includes(d?.player_id))) add("details_unknown_player", "details.players references an unknown player_id");
    const inst = {};
    for (const [name, val] of [["started_at", rec.started_at], ["finished_at", rec.finished_at], ["source.collected_at", rec.source?.collected_at]]) {
      const t = typeof val === "string" ? Date.parse(val) : NaN;
      if (Number.isNaN(t)) add("instant", `${name}: not a valid RFC 3339 instant`);
      else if (!(t >= MIN_MS2 && t < MAX_MS2)) add("instant_range", `${name} ${JSON.stringify(val)}: outside 2000-01-01 .. 2100-01-01`);
      else inst[name] = t;
    }
    if (inst.started_at !== void 0 && inst.finished_at !== void 0 && inst.finished_at < inst.started_at) add("finished_before_started", "finished_at before started_at");
    const placeholder = rec.outcome !== "normal";
    for (const d of det) {
      const p = players.find((x) => x?.player_id === d?.player_id);
      if (!p) continue;
      if (placeholder && "points" in d) add("placeholder_points", `player ${p.player_id}: outcome=${rec.outcome} must not carry points (placeholder BGA scores)`);
      if (rec.game?.slug === "arknova" && isObj(d.score_breakdown)) {
        const b = d.score_breakdown;
        if (placeholder && !("game_score" in d)) add("placeholder_breakdown_needs_game_score", `player ${p.player_id}: non-normal outcome: score_breakdown requires game_score`);
        else {
          if (b.appeal + b.conservation_points !== (placeholder ? d.game_score : p.score)) add("breakdown_sum", `player ${p.player_id}: appeal + conservation_points != ${placeholder ? "game_score" : "score"}`);
          if (placeholder && b.conservation_points < 0) add("negative_conservation_points", `player ${p.player_id}: non-normal outcome: negative conservation_points is not a real breakdown (omit score_breakdown)`);
        }
      }
      if (rec.game?.slug === "forestshuffle" && isObj(d.points) && !placeholder && Object.values(d.points).reduce((a, b) => a + b, 0) !== p.score) add("points_sum", `player ${p.player_id}: points breakdown does not sum to score`);
      if (rec.completeness === "stats") {
        for (const k of LOG_FIELDS) if (k in d) add("stats_log_fields", `completeness=stats must not carry log field ${k}`);
      }
    }
    return out;
  }

  // src/queue.js
  function memoryStorage(initial = { rev: 0, items: [], rejected: [] }) {
    let state = structuredClone(initial);
    return {
      load: () => structuredClone(state),
      save: (next, expectedRev) => {
        if ((state.rev ?? 0) !== expectedRev) return false;
        state = structuredClone(next);
        return true;
      }
    };
  }
  function storageFromKeyValue({ get: get2, set }, key = "bga-stats-queue") {
    return { load: async () => await get2(key) || void 0, save: async (state) => {
      await set(key, state);
    } };
  }
  var RANK = { stats: 0, full: 1 };
  var SYSTEMIC = /* @__PURE__ */ new Set(["network", "timeout", "server", "rate_limited", "auth", "forbidden", "bad_response"]);
  var norm = (raw) => {
    if (Array.isArray(raw)) return { rev: 0, items: raw, rejected: [] };
    return { rev: raw?.rev ?? 0, items: raw?.items ?? [], rejected: raw?.rejected ?? [] };
  };
  var errInfo = (e) => ({ code: e.code, message: e.message, status: e.status ?? null });
  function createUploader(server, options = {}) {
    const o = {
      storage: memoryStorage(),
      maxItems: 200,
      maxRejected: 50,
      maxAttempts: 10,
      retryBaseMs: 3e4,
      retryMaxMs: 6 * 36e5,
      now: () => Date.now(),
      random: Math.random,
      onRejected: () => {
      },
      // (record, ServerError): the server said the record itself is invalid (422)
      onDropped: () => {
      },
      // (item, reason): removed from the live queue (moved to rejected() with that reason)
      ...options
    };
    let lock = Promise.resolve();
    const exclusive = (fn) => {
      const run = lock.then(fn, fn);
      lock = run.catch(() => {
      });
      return run;
    };
    async function mutate(change) {
      for (let i = 0; ; i++) {
        const state = norm(await o.storage.load());
        const expected = state.rev;
        const result = change(state);
        state.rev = expected + 1;
        const fired = state.droppedNow || [];
        delete state.droppedNow;
        const ok = await o.storage.save(state, expected);
        if (ok !== false || i >= 3) {
          for (const [item, why] of fired) o.onDropped(item, why);
          return result;
        }
      }
    }
    const park = (state, item, reason, error) => {
      state.rejected.push({ table_id: item.table_id, record: item.record, reason, error, at: o.now() });
      while (state.rejected.length > o.maxRejected) state.rejected.shift();
    };
    const enqueue = (state, record, e) => {
      const t = o.now();
      const i = state.items.findIndex((x) => x.table_id === record.table_id);
      if (i >= 0 && RANK[state.items[i].record.completeness] > RANK[record.completeness]) return;
      const item = { table_id: record.table_id, record, attempts: i >= 0 ? state.items[i].attempts : 0, next_attempt_at: t + Math.max(backoffMs(0, o.retryBaseMs, o.retryMaxMs, o.random), e.retryAfterMs ?? 0), enqueued_at: i >= 0 ? state.items[i].enqueued_at : t, last_error: errInfo(e) };
      if (i >= 0) state.items[i] = item;
      else state.items.push(item);
      while (state.items.length > o.maxItems) {
        const dropped = state.items.shift();
        park(state, dropped, "queue_full", dropped.last_error);
        state.droppedNow = (state.droppedNow || []).concat([[dropped, "queue_full"]]);
      }
    };
    const reject = async (record, e) => {
      await mutate((state) => {
        park(state, { table_id: record.table_id, record }, e.code, { ...errInfo(e), details: e.details ?? null, rule: e.rule ?? null });
        state.items = state.items.filter((x) => x.table_id !== record.table_id);
      });
      o.onRejected(record, e);
    };
    const isFinal = (e) => e.code === "invalid_record" || e.code === "too_large";
    function submit(record) {
      return exclusive(async () => {
        const problems = localProblems(record);
        if (problems.length) {
          const e = Object.assign(new Error(problems.map((p) => `${p.rule}: ${p.message}`).join("; ")), { name: "ServerError", code: "invalid_record_local", rule: problems[0].rule, rules: problems.map((p) => p.rule), retryable: false });
          await reject(record, e);
          return { outcome: "rejected", table_id: record?.table_id, error: e };
        }
        try {
          const r = await server.postRecord(record);
          await mutate((state) => {
            const i = state.items.findIndex((x) => x.table_id === record.table_id);
            if (i >= 0 && RANK[state.items[i].record.completeness] <= RANK[record.completeness]) state.items.splice(i, 1);
          });
          return { outcome: r.status, table_id: r.table_id };
        } catch (e) {
          if (e?.name !== "ServerError") throw e;
          if (isFinal(e)) {
            await reject(record, e);
            return { outcome: "rejected", table_id: record.table_id, error: e };
          }
          await mutate((state) => enqueue(state, record, e));
          return { outcome: "queued", table_id: record.table_id, error: e };
        }
      });
    }
    function flush({ force = false } = {}) {
      return exclusive(async () => {
        const snapshot = norm(await o.storage.load()).items;
        const summary = { delivered: 0, rejected: 0, dropped: 0, deferred: 0, stoppedBy: null, remaining: 0 };
        for (const item of snapshot) {
          if (summary.stoppedBy || !force && item.next_attempt_at > o.now()) {
            summary.deferred++;
            continue;
          }
          try {
            await server.postRecord(item.record);
            await mutate((state) => {
              state.items = state.items.filter((x) => !(x.table_id === item.table_id && x.enqueued_at === item.enqueued_at));
            });
            summary.delivered++;
          } catch (e) {
            if (e?.name !== "ServerError") throw e;
            if (isFinal(e)) {
              await reject(item.record, e);
              summary.rejected++;
              continue;
            }
            const authLike = e.code === "auth" || e.code === "forbidden";
            const outcome = await mutate((state) => {
              const cur = state.items.find((x) => x.table_id === item.table_id);
              if (!cur) return "gone";
              cur.attempts += authLike ? 0 : 1;
              cur.last_error = errInfo(e);
              if (cur.attempts >= o.maxAttempts) {
                state.items = state.items.filter((x) => x !== cur);
                park(state, cur, "max_attempts", cur.last_error);
                state.droppedNow = (state.droppedNow || []).concat([[cur, "max_attempts"]]);
                return "dropped";
              }
              cur.next_attempt_at = o.now() + Math.max(backoffMs(cur.attempts, o.retryBaseMs, o.retryMaxMs, o.random), e.retryAfterMs ?? 0);
              return "kept";
            });
            if (outcome === "dropped") summary.dropped++;
            if (SYSTEMIC.has(e.code)) summary.stoppedBy = e.code;
          }
        }
        summary.remaining = norm(await o.storage.load()).items.length;
        return summary;
      });
    }
    function requeueRejected({ reasons } = {}) {
      return exclusive(() => mutate((state) => {
        const take = state.rejected.filter((r) => !reasons || reasons.includes(r.reason));
        state.rejected = state.rejected.filter((r) => !take.includes(r));
        for (const r of take) enqueue(state, r.record, { code: "requeued", message: `requeued from ${r.reason}` });
        return take.length;
      }));
    }
    const view = async () => norm(await o.storage.load());
    return {
      submit,
      flush,
      requeueRejected,
      size: async () => (await view()).items.length,
      pending: async () => (await view()).items,
      rejected: async () => (await view()).rejected,
      status: async () => {
        const s = await view();
        return { queued: s.items.length, rejected: s.rejected.length, lastErrors: s.items.map((i) => ({ table_id: i.table_id, attempts: i.attempts, ...i.last_error })) };
      }
    };
  }

  // src/discovery.js
  function parseGamesRow(t) {
    if (!t || t.table_id === void 0) return null;
    if (String(t.cancelled) === "1") return { skip: "cancelled" };
    if (!t.end) return { skip: "unfinished" };
    const ranked = typeof t.ranks === "string" && t.ranks.trim() !== "";
    if (!ranked) return { skip: "abandoned" };
    return {
      table_id: String(t.table_id),
      game_id: Number(t.game_id),
      game_name: t.game_name ?? null,
      start: t.start === void 0 ? null : Number(t.start),
      end: Number(t.end),
      normalend: String(t.normalend) === "1",
      outcome: t.gameResult?.outcome ?? (String(t.concede) === "1" ? "concede" : null)
    };
  }
  async function scanHistory({ bga, playerId, gameIds = SUPPORTED_GAME_IDS, cursor = {}, budget = {}, signal, now = () => Date.now(), onPage = async () => "continue" } = {}) {
    const out = { cursor: { ...cursor }, exhausted: {}, caughtUp: {}, pages: 0, reason: "exhausted", anomalies: [] };
    const startedAt = now();
    const startReq = bga.stats.requests;
    const overBudget = () => {
      if (budget.maxPages && out.pages >= budget.maxPages) return "max_pages";
      if (budget.maxBgaRequests && bga.stats.requests - startReq >= budget.maxBgaRequests) return "max_requests";
      if (budget.maxMs && now() - startedAt >= budget.maxMs) return "max_time";
      return null;
    };
    for (const gameId of gameIds) {
      let page = out.cursor[gameId] || 1;
      let prevFirst = null;
      for (; ; ) {
        const stop = overBudget();
        if (stop) {
          out.reason = stop;
          return out;
        }
        throwIfAborted(signal);
        out.cursor[gameId] = page;
        let tables;
        try {
          ({ tables } = await bga.getGamesPage({ playerId, gameId, page }));
        } catch (e) {
          if (e instanceof AbortedError || e?.name !== "BgaError") throw e;
          out.reason = "error";
          out.error = { code: e.code, message: e.message, status: e.status ?? null, retryable: !!e.retryable };
          return out;
        }
        out.pages++;
        if (tables.length === 0) {
          out.exhausted[gameId] = true;
          break;
        }
        const first = String(tables[0].table_id);
        if (first === prevFirst) {
          out.exhausted[gameId] = true;
          out.anomalies.push(`game ${gameId}: page ${page} repeats page ${page - 1}; BGA may ignore the page parameter`);
          break;
        }
        prevFirst = first;
        const rows = [];
        const skipped = { cancelled: 0, unfinished: 0, abandoned: 0 };
        for (const t of tables) {
          const r = parseGamesRow(t);
          if (!r) continue;
          if (r.skip) skipped[r.skip]++;
          else rows.push(r);
        }
        const verdict = await onPage({ gameId, page, rows, skipped }) || "continue";
        if (verdict === "stop") {
          out.reason = "consumer_stop";
          return out;
        }
        if (verdict === "next_game") {
          out.caughtUp[gameId] = true;
          out.cursor[gameId] = 1;
          break;
        }
        page += 1;
        out.cursor[gameId] = page;
      }
    }
    return out;
  }
  async function discoverHistory({ isKnown, withLogs = false, stopWhenPageKnown = false, budget = {}, ...scan } = {}) {
    const candidates = [];
    let capGame = null;
    const res = await scanHistory({
      ...scan,
      budget,
      onPage: async ({ gameId, rows }) => {
        const known = isKnown && rows.length ? await isKnown(rows.map((r) => r.table_id)) : /* @__PURE__ */ new Map();
        const need = rows.filter((r) => {
          const k = known.get(r.table_id) ?? null;
          return k === null || k === "stats" && withLogs;
        });
        for (const r of need) candidates.push({ ...r, known: known.get(r.table_id) ?? null });
        if (stopWhenPageKnown && rows.length > 0 && need.length === 0) return "next_game";
        if (budget.maxTables && candidates.length >= budget.maxTables) {
          capGame = gameId;
          return "stop";
        }
        return "continue";
      }
    });
    if (capGame !== null) {
      res.reason = "max_tables";
      res.cursor[capGame] += 1;
    }
    return { candidates, ...res };
  }

  // src/version.js
  var VERSION = "1.0.0";

  // src/logs-state.js
  var DAY = 24 * 36e5;
  var LOGS_RETRY_MS = { no_logs: 30 * DAY, archive_missing: 30 * DAY, replay_limit: DAY, not_premium: 7 * DAY };
  var LOGS_REASONS = Object.keys(LOGS_RETRY_MS);
  function memoryStateStorage(initial) {
    let state = initial ? structuredClone(initial) : void 0;
    return { load: () => state === void 0 ? void 0 : structuredClone(state), save: (s) => {
      state = structuredClone(s);
    } };
  }
  var fresh = () => ({ v: 1, tables: {}, replay_blocked_until: 0 });
  var norm2 = (raw) => raw && typeof raw === "object" && raw.v === 1 && raw.tables ? raw : fresh();
  function createLogsState({ storage = memoryStateStorage(), now = () => Date.now(), retryMs = {}, maxEntries = 5e3 } = {}) {
    const policy = { ...LOGS_RETRY_MS, ...retryMs };
    let lock = Promise.resolve();
    const exclusive = (fn) => {
      const run = lock.then(fn, fn);
      lock = run.catch(() => {
      });
      return run;
    };
    const read = async () => norm2(await storage.load());
    const prune = (state) => {
      const t = now();
      for (const [id, e] of Object.entries(state.tables)) if (e.retry_after <= t) delete state.tables[id];
      const ids = Object.keys(state.tables);
      if (ids.length > maxEntries) for (const id of ids.sort((a, b) => state.tables[a].at - state.tables[b].at).slice(0, ids.length - maxEntries)) delete state.tables[id];
      if (state.replay_blocked_until <= t) state.replay_blocked_until = 0;
    };
    const write = async (change) => {
      const state = await read();
      change(state);
      prune(state);
      await storage.save(state);
    };
    return {
      /** Reason the logs of this table must not be requested right now, or null. */
      skipReason: (id) => exclusive(async () => {
        const e = (await read()).tables[String(id)];
        return e && e.retry_after > now() ? e.reason : null;
      }),
      /** ms epoch until which every logs request is suspended (replay allowance exhausted), or 0. */
      replayBlockedUntil: () => exclusive(async () => {
        const until = (await read()).replay_blocked_until;
        return until > now() ? until : 0;
      }),
      mark: (id, reason, message = "") => exclusive(() => {
        if (!Object.hasOwn(policy, reason)) throw new Error(`unknown logs reason ${reason}`);
        return write((s) => {
          s.tables[String(id)] = { reason, at: now(), retry_after: now() + policy[reason], message: String(message).slice(0, 200) };
        });
      }),
      /** BGA said the replay limit is reached: nothing may ask for logs until the policy window has passed. */
      markReplayLimit: () => exclusive(() => write((s) => {
        s.replay_blocked_until = now() + policy.replay_limit;
      })),
      clear: (id) => exclusive(() => write((s) => {
        delete s.tables[String(id)];
      })),
      status: () => exclusive(async () => {
        const s = await read();
        prune(s);
        return { tables: s.tables, replay_blocked_until: s.replay_blocked_until };
      })
    };
  }

  // src/collector.js
  function isSystemic(err) {
    if (!err) return false;
    if (["rate_limited", "session", "auth", "network", "timeout", "bad_response"].includes(err.code)) return true;
    return err.code === "http" && Number(err.status) >= 500;
  }
  var isoNow = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  function createCollector({ bga, server, uploader, collector, collectorVersion, playerId, now = () => Date.now(), logsState = createLogsState({ now }) }) {
    const source = () => {
      const s = { collector, collector_version: collectorVersion || `core-${VERSION}`, collected_at: isoNow(now()) };
      if (playerId) s.collected_by_player_id = String(playerId);
      return s;
    };
    async function collectTable(tableId, { withLogs = false, skipIfKnown = true, knownCompleteness } = {}) {
      const id = String(tableId);
      try {
        let wantLogs = withLogs;
        let logsSkipped = null;
        if (wantLogs) {
          logsSkipped = await logsState.replayBlockedUntil() ? "replay_limit" : await logsState.skipReason(id);
          if (logsSkipped) wantLogs = false;
        }
        if (skipIfKnown) {
          const k = knownCompleteness !== void 0 ? knownCompleteness : (await server.known([id])).get(id) ?? null;
          if (k === "full" || k === "stats" && !wantLogs) return { table_id: id, outcome: "skipped", reason: "known", known: k, logsSkipped };
        }
        const fetched = await bga.fetchTable(id, { withLogs: wantLogs });
        const { info } = fetched;
        let { logs, logsError } = fetched;
        if (logs && Array.isArray(logs.logs) && logs.logs.length === 0) {
          logs = null;
          logsError = new BgaError("no_logs", "BGA returned an empty log for this table");
        }
        let record;
        try {
          record = buildRecord(info, logs, source());
        } catch (e) {
          if (e instanceof ExtractError && e.code === "unsupported_game") return { table_id: id, outcome: "skipped", reason: "unsupported" };
          if (e instanceof ExtractError && (e.code === "login_required" || e.code === "not_started")) return { table_id: id, outcome: "skipped", reason: e.code };
          if (e instanceof ExtractError && e.code === "abandoned") return { table_id: id, outcome: "skipped", reason: "abandoned" };
          throw e;
        }
        if (wantLogs) {
          if (logs) await logsState.clear(id);
          else if (logsError?.code === "replay_limit") await logsState.markReplayLimit();
          else if (["no_logs", "archive_missing", "not_premium"].includes(logsError?.code)) await logsState.mark(id, logsError.code, logsError.message);
        }
        const problems = localProblems(record);
        if (problems.length) return { table_id: id, outcome: "error", error: { code: "invalid_record_local", rule: problems[0].rule, rules: problems.map((p) => p.rule), message: problems.map((p) => `${p.rule}: ${p.message}`).join("; ") } };
        const delivered = await uploader.submit(record);
        return { table_id: id, outcome: delivered.outcome, completeness: record.completeness, logsError: logsError ? { code: logsError.code, message: logsError.message } : null, logsSkipped, error: delivered.error ? { code: delivered.error.code, message: delivered.error.message, details: delivered.error.details, rule: delivered.error.rule } : null };
      } catch (e) {
        if (e instanceof AbortedError) throw e;
        if (e instanceof BgaError && e.code === "not_finished") return { table_id: id, outcome: "skipped", reason: "not_finished" };
        return { table_id: id, outcome: "error", error: { code: e.code || e.name, message: e.message, status: e.status ?? null } };
      }
    }
    async function backfill({ playerId: pid = playerId, gameIds, withLogs = false, budget = {}, cursor = {}, stopWhenPageKnown = false, signal, onProgress, maxConsecutiveErrors = 3 } = {}) {
      if (!pid) throw new Error("backfill: playerId is required");
      if (withLogs) {
        const until = await logsState.replayBlockedUntil();
        if (until) return { cursor, exhausted: {}, caughtUp: {}, pages: 0, reason: "replay_limit", blockedUntil: until, error: null, breaker: null, collected: 0, counts: {}, results: [], elapsedMs: 0, bgaRequests: 0, anomalies: [] };
      }
      let replayStop = null;
      const startedAt = now();
      const startReq = bga.stats.requests;
      const counts = {};
      let collected = 0;
      const tally = (o) => {
        counts[o] = (counts[o] || 0) + 1;
      };
      let consecutive = 0;
      let breaker = null;
      const noteError = (err) => {
        if (!isSystemic(err)) {
          consecutive = 0;
          return false;
        }
        consecutive++;
        if (consecutive >= maxConsecutiveErrors) {
          breaker = { code: err.code, status: err.status ?? null, consecutive };
          return true;
        }
        return false;
      };
      const results = [];
      let serverError = null;
      const scan = await scanHistory({
        bga,
        playerId: pid,
        gameIds,
        cursor,
        signal,
        now,
        budget: { maxPages: budget.maxPages, maxBgaRequests: budget.maxBgaRequests, maxMs: budget.maxMs },
        onPage: async ({ gameId, page, rows }) => {
          let known;
          try {
            known = rows.length ? await server.known(rows.map((r) => r.table_id)) : /* @__PURE__ */ new Map();
          } catch (e) {
            if (e?.name !== "ServerError") throw e;
            serverError = { code: e.code, message: e.message, status: e.status ?? null };
            return "stop";
          }
          let needed = 0;
          for (const r of rows) {
            const k = known.get(r.table_id) ?? null;
            if (k === "full" || k === "stats" && !withLogs) {
              tally("skipped_known");
              continue;
            }
            if (k === "stats" && withLogs) {
              const why = await logsState.skipReason(r.table_id);
              if (why) {
                tally(`skipped_${why}`);
                continue;
              }
            }
            if (breaker) return "stop";
            needed++;
            const overTables = budget.maxTables && collected >= budget.maxTables;
            const overReq = budget.maxBgaRequests && bga.stats.requests - startReq >= budget.maxBgaRequests;
            const overTime = budget.maxMs && now() - startedAt >= budget.maxMs;
            if (overTables || overReq || overTime) return "stop";
            throwIfAborted(signal);
            const res = await collectTable(r.table_id, { withLogs, skipIfKnown: false });
            collected++;
            tally(res.outcome === "skipped" ? `skipped_${res.reason}` : res.outcome);
            results.push(res);
            if (res.outcome === "error" ? noteError(res.error) : (consecutive = 0, false)) return "stop";
            if (res.logsError?.code === "replay_limit") {
              replayStop = await logsState.replayBlockedUntil();
              return "stop";
            }
            onProgress?.({ gameId, page, result: res });
          }
          if (stopWhenPageKnown && rows.length > 0 && needed === 0) return "next_game";
          return "continue";
        }
      });
      let error = scan.error || null;
      if (scan.reason === "error") {
        if (noteError(scan.error) || isSystemic(scan.error)) breaker = breaker || { code: scan.error.code, status: scan.error.status, consecutive: Math.max(consecutive, 1), during: "getGames" };
      }
      if (serverError) {
        error = serverError;
        scan.reason = "server_error";
      }
      if (breaker) scan.reason = "circuit_breaker";
      if (replayStop) scan.reason = "replay_limit";
      return { ...scan, error, breaker, ...replayStop ? { blockedUntil: replayStop } : {}, collected, counts, results, elapsedMs: now() - startedAt, bgaRequests: bga.stats.requests };
    }
    return { collectTable, backfill, logsState, discover: (opts) => discoverHistory({ bga, playerId, ...opts }), source };
  }

  // src/iife-entry.js
  globalThis.BgaStatsCore = Object.freeze({ createLogsState, memoryStateStorage, LOGS_RETRY_MS, localProblems, buildRecord, buildCommon, buildArknovaDetails, buildForestshuffleDetails, unwrapData, recordProblems, ExtractError, SCHEMA_VERSION, GAMES, SUPPORTED_GAME_IDS, createBgaClient, BgaError, classifyBgaError, createServerClient, ServerError, createUploader, memoryStorage, storageFromKeyValue, scanHistory, discoverHistory, parseGamesRow, createCollector, fetchFromGM, AbortedError, VERSION });
})();

(() => {
  // <define:__BUILD__>
  var define_BUILD_default = { variant: "combined", version: "1.0.0", gameIds: [1741, 1841], defaultServerUrl: "" };

  // src/pages.js
  function classifyPage(href) {
    let u;
    try {
      u = new URL(href);
    } catch {
      return { kind: "other", tableId: null };
    }
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const t = u.searchParams.get("table");
    const tableId = t && /^\d{1,15}$/.test(t) ? t : null;
    if (/^\/\d+\/[^/]+/.test(path)) return { kind: "game", tableId };
    if (path === "/table") return { kind: tableId ? "table" : "other", tableId };
    if (path === "/gamereview") return { kind: tableId ? "gamereview" : "other", tableId };
    if (path === "/lobby" || path === "/") return { kind: "lobby", tableId: null };
    if (path === "/gamestats" || path === "/player") return { kind: "history", tableId: null };
    return { kind: "other", tableId: null };
  }
  var isCollectPage = (p) => p.kind === "table" || p.kind === "gamereview";

  // src/settings.js
  var DEFAULTS = Object.freeze({
    serverUrl: "",
    ingestToken: "",
    autoCollect: true,
    requestGapMs: 2500,
    // minimum gap between two BGA requests
    archiveGapMs: 4e3,
    // minimum gap between two archive/log requests
    backfill: Object.freeze({ maxTables: 20, maxMinutes: 10, withLogs: false, mode: "catchup" })
  });
  var KEYS = { settings: "settings", queue: "queue", seen: "seen", cursor: "backfillCursor", events: "events", lock: "lock", pendingLogin: "pendingLogin" };
  function normalizeServerUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    let u;
    try {
      u = new URL(s);
    } catch {
      throw new Error("Server URL is not a valid URL");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Server URL must start with http:// or https://");
    return (u.origin + u.pathname).replace(/\/+$/, "");
  }
  var int = (v, lo, hi, d) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  function loadSettings(gm2, build2 = {}) {
    let raw = {};
    try {
      raw = gm2.getValue(KEYS.settings, {}) || {};
    } catch {
      raw = {};
    }
    const b = { ...DEFAULTS.backfill, ...raw.backfill || {} };
    return {
      serverUrl: typeof raw.serverUrl === "string" && raw.serverUrl ? raw.serverUrl : build2.defaultServerUrl || "",
      ingestToken: typeof raw.ingestToken === "string" ? raw.ingestToken : "",
      autoCollect: raw.autoCollect !== false,
      requestGapMs: int(raw.requestGapMs, 400, 6e4, DEFAULTS.requestGapMs),
      archiveGapMs: int(raw.archiveGapMs, 2e3, 12e4, DEFAULTS.archiveGapMs),
      backfill: {
        maxTables: int(b.maxTables, 1, 500, DEFAULTS.backfill.maxTables),
        maxMinutes: int(b.maxMinutes, 1, 120, DEFAULTS.backfill.maxMinutes),
        withLogs: !!b.withLogs,
        mode: b.mode === "historic" ? "historic" : "catchup"
      }
    };
  }
  function saveSettings(gm2, patch, current) {
    const next = { ...current, ...patch, backfill: { ...current.backfill, ...patch.backfill || {} } };
    if (patch.serverUrl !== void 0) next.serverUrl = normalizeServerUrl(patch.serverUrl);
    if (patch.ingestToken !== void 0) next.ingestToken = String(patch.ingestToken).trim();
    gm2.setValue(KEYS.settings, next);
    return loadSettings(gm2, { defaultServerUrl: next.serverUrl });
  }
  var isConfigured = (s) => !!(s.serverUrl && s.ingestToken);
  function loadSeen(gm2) {
    const v = gm2.getValue(KEYS.seen, {});
    return v && typeof v === "object" ? v : {};
  }
  function rememberSeen(gm2, tableId, completeness, now, limit = 500) {
    const seen = loadSeen(gm2);
    seen[tableId] = { completeness, at: now };
    const ids = Object.keys(seen);
    if (ids.length > limit) {
      ids.sort((a, b) => seen[a].at - seen[b].at).slice(0, ids.length - limit).forEach((id) => delete seen[id]);
    }
    gm2.setValue(KEYS.seen, seen);
  }

  // src/status.js
  function badgeFor({ configured, phase, last, queueSize = 0, queueMax = 100, parked = 0, progress, yielded, peers = [], replayUntil = 0 }) {
    const note = peers.length ? ` (${peers.join(", ")} script also installed; it stays inactive.)` : "";
    if (yielded) return { kind: "idle", label: "inactive", title: "A per-game BGA stats script is active; this combined script stays inactive." };
    if (!configured) return { kind: "setup", label: "set up", title: "Open the panel and set the server URL and ingest token." + note };
    if (phase === "identifying") return { kind: "working", label: "checking login", title: "Waiting for BGA to finish loading" };
    if (phase === "collecting") return { kind: "working", label: "collecting", title: "Collecting this table" };
    if (phase === "backfill") {
      const p = progress || {};
      return { kind: "working", label: `backfill ${p.done ?? 0}/${p.max ?? "?"}`, title: p.note || "Backfilling history" };
    }
    if (parked > 0) return { kind: "error", label: `parked ${parked}`, title: `${parked} record(s) parked (rejected by the server, or dropped over the queue cap). Open the panel to requeue, export or dismiss them.` };
    if (last?.kind === "error") return { kind: "error", label: "error", title: last.message || "Error" };
    if (last?.kind === "paused" || replayUntil > 0) {
      const until = replayUntil > 0 ? new Date(replayUntil).toLocaleString() : "later";
      return { kind: "paused", label: "logs paused", title: `BGA replay limit reached, logs paused until ${until}. Stats-only records are still collected.${note}` };
    }
    if (last?.kind === "login") return { kind: "login", label: "log in to collect", title: last.message || "Log in to BGA to collect this table; it is retried automatically." };
    if (queueSize >= Math.ceil(queueMax * 0.8)) return { kind: "queued", label: `queue ${queueSize}/${queueMax}`, title: `Queue nearly full (${queueSize}/${queueMax}). Records over the cap are parked, not lost; fix the server connection.` };
    if (last?.kind === "offline" || queueSize > 0 && last?.error === "network") {
      return { kind: "offline", label: queueSize ? `offline ${queueSize}` : "offline", title: `Server unreachable. ${queueSize} record(s) queued; they are retried until delivered.` };
    }
    if (queueSize > 0) return { kind: "queued", label: `queued ${queueSize}`, title: `${queueSize} record(s) waiting for delivery${last?.message ? ": " + last.message : ""}` };
    if (last?.kind === "collected") return { kind: "collected", label: last.statsOnly ? "stats only" : "collected", title: (last.message || "Collected") + note };
    return { kind: "idle", label: "stats", title: (last?.message || "BGA game stats collector") + note };
  }
  function lastFromResult(res) {
    const err = res.error;
    switch (res.outcome) {
      case "created":
      case "updated":
      case "unchanged":
      case "ignored":
        return { kind: "collected", message: `Table ${res.table_id}: ${res.outcome}${res.completeness === "stats" && res.logsError ? " (no logs: " + res.logsError.code + ")" : ""}${res.logsSkipped ? " (logs skipped: " + res.logsSkipped + ")" : ""}` };
      case "skipped":
        switch (res.reason) {
          case "known":
            return { kind: "collected", message: `Table ${res.table_id}: already on the server` };
          case "unsupported":
            return { kind: "idle", message: `Table ${res.table_id}: game not tracked` };
          case "not_finished":
            return { kind: "idle", message: `Table ${res.table_id}: not finished` };
          case "login_required":
            return { kind: "login", message: `Table ${res.table_id}: BGA hides the results from visitors. Log in to BGA to collect it (retried automatically).` };
          case "not_started":
            return { kind: "idle", message: `Table ${res.table_id}: never started, nothing to collect` };
          case "abandoned":
            return { kind: "idle", message: `Table ${res.table_id}: abandoned game, not collected` };
          case "game":
            return { kind: "idle", message: `Table ${res.table_id}: game not handled by this script` };
          default:
            return { kind: "idle", message: `Table ${res.table_id}: skipped (${res.reason})` };
        }
      case "queued":
        if (err?.code === "network") return { kind: "offline", error: "network", message: `Table ${res.table_id} queued: server unreachable` };
        if (err?.code === "auth" || err?.code === "forbidden") return { kind: "error", message: `Ingest token rejected (${err.code}). Fix it in settings; the record stays queued.` };
        return { kind: "queued", error: err?.code, message: `Table ${res.table_id} queued (${err?.code || "retry"})` };
      case "rejected":
        return { kind: "error", message: `Server rejected table ${res.table_id}: ${err?.message || err?.code}` };
      case "error":
        if (err?.code === "auth") return { kind: "error", message: "Not logged in to BGA" };
        if (err?.code === "network") return { kind: "offline", error: "network", message: err.message };
        return { kind: "error", message: `Table ${res.table_id}: ${err?.code}: ${err?.message}` };
      default:
        return { kind: "idle", message: String(res.outcome) };
    }
  }

  // src/gm-fetch.js
  function serverFetchFromGM(gmXhr, { getBaseUrl, timeoutMs = 3e4 }) {
    return (url, init = {}) => new Promise((resolve, reject) => {
      const base = new URL(getBaseUrl());
      const target = new URL(url);
      if (target.origin !== base.origin) return reject(new TypeError(`refusing to contact ${target.origin}: not the configured server`));
      const headers = { ...init.headers || {} };
      if (/\/api\/v1\/health$/.test(target.pathname)) delete headers.Authorization;
      gmXhr({
        url,
        method: init.method || "GET",
        headers,
        data: init.body,
        timeout: timeoutMs,
        anonymous: true,
        redirect: "error",
        onload: (r) => {
          if (r.status >= 300 && r.status < 400) return reject(new TypeError(`redirect refused (HTTP ${r.status})`));
          const hdrs = /* @__PURE__ */ new Map();
          for (const line of String(r.responseHeaders || "").split(/\r?\n/)) {
            const i = line.indexOf(":");
            if (i > 0) hdrs.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
          }
          if (r.finalUrl && new URL(r.finalUrl).origin !== base.origin) return reject(new TypeError("redirect refused (final URL on another origin)"));
          resolve({ status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: (k) => hdrs.get(k.toLowerCase()) ?? null }, text: async () => r.responseText });
        },
        onerror: () => reject(new TypeError("network error")),
        ontimeout: () => reject(new TypeError("network timeout")),
        onabort: () => reject(new TypeError("aborted"))
      });
    });
  }

  // src/app.js
  var EVENT_LIMIT = 30;
  var QUEUE_MAX = 100;
  var PARKED_MAX = 500;
  var LOCK_KEY = "bga-stats:lock";
  var PRESENCE = "bga-stats:presence:";
  var PRESENCE_TTL = 6e4;
  var LOGS_KEY = "bga-stats-logs";
  var PER_GAME = ["arknova", "forestshuffle"];
  function createApp(env) {
    const { core, build: build2, gm: gm2 } = env;
    const now = env.now || (() => Date.now());
    const sleep = env.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const setIv = env.setInterval || setInterval;
    const clearIv = env.clearInterval || clearInterval;
    const tabId = Math.random().toString(36).slice(2);
    const allowed = new Set((build2.gameIds || []).map(Number));
    const shared2 = env.shared || { get: (k) => gm2.getValue(k, null), set: (k, v) => gm2.setValue(k, v) };
    const identityWaitMs = env.identityWaitMs ?? 15e3;
    let settings = loadSettings(gm2, build2);
    let page = classifyPage(env.getHref());
    const st = { phase: "idle", last: null, progress: null, queueSize: 0, parked: 0, abort: null, yielded: false, identity: null, replayUntil: 0 };
    let clients = null;
    let chain = Promise.resolve();
    let timers = [];
    let started = false;
    const inflight = /* @__PURE__ */ new Set();
    const track = (p) => {
      inflight.add(p);
      const done = () => inflight.delete(p);
      p.then(done, done);
      return p;
    };
    const events = () => gm2.getValue(KEYS.events, []) || [];
    function logEvent(kind, message) {
      const list = events();
      list.push({ at: now(), kind, message });
      gm2.setValue(KEYS.events, list.slice(-EVENT_LIMIT));
    }
    function rebuild(playerId = null) {
      const bga = core.createBgaClient(
        { fetch: env.bgaFetch, getToken: env.getToken },
        { baseUrl: env.origin, minRequestGapMs: settings.requestGapMs, minArchiveGapMs: settings.archiveGapMs, sleep, now }
      );
      const server = settings.serverUrl ? core.createServerClient({ fetch: env.serverFetch || serverFetchFromGM(gm2.xhr, { getBaseUrl: () => settings.serverUrl }) }, { baseUrl: settings.serverUrl, token: () => settings.ingestToken, sleep, now }) : null;
      const uploader = server ? core.createUploader(server, {
        storage: core.storageFromKeyValue({ get: (k) => gm2.getValue(k, null), set: (k, v) => gm2.setValue(k, v) }, KEYS.queue),
        maxItems: QUEUE_MAX,
        maxRejected: PARKED_MAX,
        maxAttempts: Infinity,
        // transient failures (outage, 5xx, 429, bad token) are retried forever, with capped backoff
        retryMaxMs: 30 * 6e4,
        now,
        onRejected: (rec, e) => logEvent("error", `Server rejected table ${rec.table_id}: ${e.code}: ${e.message}`),
        onDropped: (item, why) => logEvent("error", `Parked queued table ${item.table_id} (${why}); see the panel to requeue or export`)
      }) : null;
      const gated = gateGames(bga);
      const logsState = core.createLogsState({
        storage: { load: () => shared2.get(LOGS_KEY) ?? void 0, save: (s) => {
          shared2.set(LOGS_KEY, s);
        } },
        now,
        maxEntries: 2e3
      });
      const collector = server ? core.createCollector({ bga: gated, server, uploader, collector: "userscript", collectorVersion: `us-${build2.version}`, playerId: playerId || void 0, now, logsState }) : null;
      clients = { bga, gated, server, uploader, collector, playerId, logsState };
    }
    const ensureClients = (playerId) => {
      if (!clients || clients.playerId !== (playerId || null)) rebuild(playerId || null);
    };
    function gateGames(bga) {
      return {
        ...bga,
        async fetchTable(id, { withLogs = false } = {}) {
          const info = await bga.tableInfos(id);
          if (!allowed.has(Number(info.game_id))) throw new core.BgaError("game_filtered", `game ${info.game_id} is not handled by ${build2.variant}`);
          if (!withLogs) return { info, logs: null, logsError: null };
          try {
            return { info, logs: await bga.logs(id), logsError: null };
          } catch (e) {
            if (e instanceof core.BgaError && ["auth", "archive_missing", "replay_lost", "not_found", "bga_error", "bad_response", "replay_limit", "not_premium", "no_logs"].includes(e.code)) return { info, logs: null, logsError: e };
            throw e;
          }
        }
      };
    }
    async function resolveIdentity() {
      const t0 = now();
      const deadline = t0 + identityWaitMs;
      let announced = false;
      const done = (id) => {
        if (announced || now() > t0) logEvent("progress", id.state === "pending" ? `BGA login state still unknown after ${now() - t0} ms` : `BGA login state ready after ${now() - t0} ms (${id.state})`);
        return id;
      };
      for (; ; ) {
        const id = env.getIdentity();
        if (id.state !== "pending" && id.token) return done(id);
        if (now() >= deadline) return done(id);
        if (!announced && st.phase === "idle") {
          announced = true;
          st.phase = "identifying";
          render();
        }
        await sleep(250);
      }
    }
    async function refreshQueue() {
      try {
        st.queueSize = clients?.uploader ? await clients.uploader.size() : 0;
        st.parked = clients?.uploader ? (await clients.uploader.rejected()).length : 0;
      } catch {
        st.queueSize = 0;
        st.parked = 0;
      }
      try {
        st.replayUntil = clients?.logsState ? await clients.logsState.replayBlockedUntil() : 0;
      } catch {
        st.replayUntil = 0;
      }
    }
    const fresh = (v) => {
      const t = Number(shared2.get(PRESENCE + v));
      return Number.isFinite(t) && now() - t < PRESENCE_TTL;
    };
    const peers = () => build2.variant === "combined" ? PER_GAME.filter(fresh) : fresh("combined") ? ["combined"] : [];
    const mustYield = () => build2.variant === "combined" && PER_GAME.some(fresh);
    const beat = () => {
      try {
        shared2.set(PRESENCE + build2.variant, now());
      } catch {
      }
    };
    async function acquireLock(ttlMs, waitMs = 0) {
      const deadline = now() + waitMs;
      for (; ; ) {
        const l = shared2.get(LOCK_KEY);
        if (!l || l.until < now() || l.id === tabId) {
          shared2.set(LOCK_KEY, { id: tabId, until: now() + ttlMs, by: build2.variant });
          await sleep(50);
          if (shared2.get(LOCK_KEY)?.id === tabId) return true;
        }
        if (now() >= deadline) return false;
        await sleep(5e3);
      }
    }
    const releaseLock = () => {
      if (shared2.get(LOCK_KEY)?.id === tabId) shared2.set(LOCK_KEY, null);
    };
    function view() {
      return {
        badge: badgeFor({ configured: isConfigured(settings), phase: st.phase, last: st.last, queueSize: st.queueSize, queueMax: QUEUE_MAX, parked: st.parked, progress: st.progress, yielded: st.yielded, peers: peers(), replayUntil: st.replayUntil }),
        settings: { ...settings, ingestToken: settings.ingestToken ? "set" : "" },
        page,
        loggedIn: (st.identity ?? env.getIdentity()).state === "user",
        identity: (st.identity ?? env.getIdentity()).state,
        queueSize: st.queueSize,
        queueMax: QUEUE_MAX,
        parked: st.parked,
        replayUntil: st.replayUntil,
        progress: st.progress,
        events: events().slice().reverse(),
        busy: st.phase !== "idle",
        variant: build2.variant,
        version: build2.version,
        cursor: gm2.getValue(KEYS.cursor, null),
        yielded: st.yielded,
        peers: peers()
      };
    }
    const render = () => env.ui.render(view());
    const setLast = (res) => {
      st.last = lastFromResult(res);
      logEvent(st.last.kind, st.last.message);
    };
    const exclusive = (fn) => {
      const run = chain.then(fn, fn);
      chain = run.catch(() => {
      });
      return run;
    };
    function guardLive() {
      if (classifyPage(env.getHref()).kind === "game") {
        st.abort?.abort();
        return false;
      }
      return true;
    }
    function collect(opts = {}) {
      return track(collectInner(opts));
    }
    async function collectInner({ tableId, auto = false, force = false, upgrade = false } = {}) {
      if (st.yielded) return { outcome: "yielded" };
      if (!isConfigured(settings)) {
        st.last = { kind: "idle", message: "Set the server URL and ingest token first" };
        render();
        if (!auto) env.ui.openPanel("settings");
        return { outcome: "not_configured" };
      }
      let id = tableId || page.tableId;
      if (!id && !auto) id = await env.ui.askTableId();
      if (!id) return { outcome: "no_table" };
      id = String(id);
      if (!guardLive()) return { outcome: "live_game_page" };
      return exclusive(async () => {
        const ident = await resolveIdentity();
        st.identity = ident;
        if (st.phase === "identifying") st.phase = "idle";
        const playerId = ident.state === "user" ? ident.playerId : null;
        const unknownLogin = ident.state === "pending";
        const withLogs = !!playerId;
        if (!force) {
          const s = loadSeen(gm2)[id];
          if (s && (s.completeness === "full" || !withLogs)) {
            st.last = { kind: "collected", statsOnly: s.completeness !== "full", message: `Table ${id}: already delivered (${s.completeness})` };
            render();
            return { table_id: id, outcome: "skipped", reason: "seen" };
          }
        }
        if (!await acquireLock(5 * 6e4, auto ? 12e4 : 0)) {
          st.last = { kind: "idle", message: "Another tab or script is collecting; try again shortly" };
          render();
          return { table_id: id, outcome: "locked" };
        }
        st.abort = new AbortController();
        st.phase = "collecting";
        render();
        try {
          ensureClients(playerId);
          let kc = null;
          if (!force) {
            try {
              kc = (await clients.server.known([id])).get(id) ?? null;
            } catch (e) {
              if (e.code === "auth" || e.code === "forbidden") {
                st.last = { kind: "error", message: `Ingest token rejected (${e.code}). Fix it in settings.` };
                logEvent("error", st.last.message);
                return { table_id: id, outcome: "token_rejected", error: { code: e.code, message: e.message } };
              }
              kc = null;
            }
          }
          const res = await clients.collector.collectTable(id, { withLogs, knownCompleteness: kc, skipIfKnown: !force });
          if (res.outcome === "error" && res.error?.code === "game_filtered") {
            res.outcome = "skipped";
            res.reason = "game";
          }
          setLast(res);
          if (["created", "updated", "unchanged", "ignored"].includes(res.outcome) && res.completeness === "stats" && !withLogs) {
            st.last.statsOnly = true;
            st.last.message += unknownLogin ? " (stats only: BGA login state unknown, will upgrade)" : " (stats only: not logged in)";
            logEvent("collected", st.last.message);
          }
          if (["created", "updated", "unchanged", "ignored"].includes(res.outcome) || res.outcome === "skipped" && res.reason === "known") {
            rememberSeen(gm2, id, res.completeness || (res.known === "full" ? "full" : "stats"), now());
            removePendingLogin(id);
          }
          if (res.outcome === "skipped" && res.reason === "login_required") {
            addPendingLogin(id);
            watchLoginForRetry(id);
          } else if (res.outcome === "skipped" && res.reason !== "game") {
            removePendingLogin(id);
          }
          if (unknownLogin && res.completeness === "stats" && !upgrade) watchIdentityForUpgrade(id);
          return res;
        } catch (e) {
          const res = { table_id: id, outcome: "error", error: { code: e.code || e.name, message: e.message } };
          setLast(res);
          return res;
        } finally {
          st.phase = "idle";
          st.abort = null;
          releaseLock();
          await refreshQueue();
          render();
        }
      });
    }
    const pendingLogin = () => gm2.getValue(KEYS.pendingLogin, {}) || {};
    function addPendingLogin(id) {
      const p = pendingLogin();
      p[id] = p[id] || now();
      const keys = Object.keys(p).sort((x, y) => p[x] - p[y]);
      for (const k of keys.slice(0, Math.max(0, keys.length - 50))) delete p[k];
      gm2.setValue(KEYS.pendingLogin, p);
    }
    function removePendingLogin(id) {
      const p = pendingLogin();
      if (id in p) {
        delete p[id];
        gm2.setValue(KEYS.pendingLogin, p);
      }
    }
    function watchLoginForRetry(id) {
      track((async () => {
        const deadline = now() + 10 * 6e4;
        while (now() < deadline && !st.yielded && classifyPage(env.getHref()).kind !== "game") {
          await sleep(3e3);
          if (env.getIdentity().state === "user") return collectInner({ tableId: id, auto: true, force: true, upgrade: true });
        }
        return null;
      })());
    }
    async function resumePendingLogin() {
      const ids = Object.keys(pendingLogin());
      if (!ids.length || !isConfigured(settings)) return;
      const ident = await resolveIdentity();
      if (ident.state !== "user") return;
      for (const id of ids.slice(0, 5)) if (!st.yielded && guardLive() && id !== page.tableId) await collectInner({ tableId: id, auto: true, force: true, upgrade: true });
    }
    function watchIdentityForUpgrade(id) {
      track((async () => {
        const deadline = now() + 12e4;
        while (now() < deadline && !st.yielded && classifyPage(env.getHref()).kind !== "game") {
          await sleep(2e3);
          const ident = env.getIdentity();
          if (ident.state === "user") return collectInner({ tableId: id, auto: true, force: true, upgrade: true });
          if (ident.state === "anonymous") return null;
        }
        return null;
      })());
    }
    function backfill(opts = {}) {
      return track(backfillInner(opts));
    }
    async function backfillInner(opts = {}) {
      if (st.yielded) return { outcome: "yielded" };
      if (!isConfigured(settings)) {
        env.ui.openPanel("settings");
        return { outcome: "not_configured" };
      }
      if (!guardLive()) return { outcome: "live_game_page" };
      const b = { ...settings.backfill, ...opts };
      settings = saveSettings(gm2, { backfill: b }, settings);
      return exclusive(async () => {
        const ident = await resolveIdentity();
        st.identity = ident;
        if (st.phase === "identifying") st.phase = "idle";
        if (ident.state !== "user") {
          st.last = { kind: "error", message: ident.state === "pending" ? "BGA has not finished loading (login state unknown); try again" : "Backfill needs a logged-in BGA session" };
          render();
          return { outcome: ident.state === "pending" ? "identity_unknown" : "not_logged_in" };
        }
        const playerId = ident.playerId;
        if (!await acquireLock((b.maxMinutes + 3) * 6e4, 0)) {
          st.last = { kind: "idle", message: "Another tab or script is collecting; try again shortly" };
          render();
          return { outcome: "locked" };
        }
        st.abort = new AbortController();
        st.phase = "backfill";
        st.progress = { done: 0, max: b.maxTables, note: "scanning history" };
        ensureClients(playerId);
        render();
        let out;
        try {
          const historic = b.mode === "historic";
          const r = await clients.collector.backfill({
            playerId,
            gameIds: [...allowed],
            withLogs: b.withLogs,
            budget: { maxTables: b.maxTables, maxMs: b.maxMinutes * 6e4 },
            cursor: historic ? gm2.getValue(KEYS.cursor, {}) || {} : {},
            stopWhenPageKnown: !historic,
            signal: st.abort.signal,
            onProgress: ({ gameId, page: pg, result }) => {
              st.progress = { done: (st.progress?.done || 0) + 1, max: b.maxTables, note: `game ${gameId} page ${pg}, last table ${result.table_id}: ${result.outcome}${result.reason ? " " + result.reason : ""}${result.logsSkipped ? " (logs skipped: " + result.logsSkipped + ")" : ""}` };
              logEvent("progress", `Backfill table ${result.table_id}: ${result.outcome}${result.reason ? " " + result.reason : ""}`);
              if (["created", "updated", "unchanged", "ignored"].includes(result.outcome) && result.completeness) rememberSeen(gm2, result.table_id, result.completeness, now());
              render();
            }
          });
          if (historic) gm2.setValue(KEYS.cursor, r.cursor);
          const counts = Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(", ") || "nothing to do";
          out = { outcome: "done", ...r };
          if (r.reason === "replay_limit") {
            st.last = { kind: "paused", message: `Backfill stopped: BGA replay limit reached, logs paused until ${new Date(r.blockedUntil || st.replayUntil).toLocaleString()}; ${r.collected} collected (${counts})` };
          } else if (r.breaker) {
            st.last = { kind: "error", message: `Backfill stopped (circuit breaker: ${r.breaker.code} x${r.breaker.consecutive}); ${r.collected} collected. Try again later.` };
          } else {
            st.last = { kind: "collected", message: `Backfill finished (${r.reason}): ${r.collected} collected (${counts})` };
          }
          logEvent(st.last.kind, `${st.last.message}; ${r.pages} pages, ${r.bgaRequests} BGA requests`);
        } catch (e) {
          if (e.name === "AbortedError") {
            st.last = { kind: "idle", message: "Backfill cancelled" };
            out = { outcome: "cancelled" };
          } else if (e.name === "ServerError") {
            st.last = e.code === "network" ? { kind: "offline", error: "network", message: e.message } : { kind: "error", message: `Server: ${e.code}: ${e.message}` };
            out = { outcome: "error", error: { code: e.code, message: e.message } };
          } else {
            st.last = { kind: "error", message: `Backfill failed: ${e.code || e.name}: ${e.message}` };
            out = { outcome: "error", error: { code: e.code || e.name, message: e.message } };
          }
          logEvent(st.last.kind, st.last.message);
        } finally {
          st.phase = "idle";
          st.abort = null;
          releaseLock();
          await refreshQueue();
          render();
        }
        return out;
      });
    }
    async function flush({ force = true } = {}) {
      if (st.yielded) return null;
      ensureClients(clients?.playerId ?? null);
      if (!clients?.uploader) return null;
      try {
        const s = await clients.uploader.flush({ force });
        await refreshQueue();
        if (s.delivered) {
          st.last = { kind: "collected", message: `Delivered ${s.delivered} queued record(s)` };
          logEvent("collected", st.last.message);
        } else if (s.stoppedBy) {
          st.last = s.stoppedBy === "network" || s.stoppedBy === "server" ? { kind: "offline", error: "network", message: `Server unreachable (${s.stoppedBy})` } : { kind: "error", message: `Queue blocked: ${s.stoppedBy}` };
        }
        render();
        return s;
      } catch (e) {
        logEvent("error", `Queue flush failed: ${e.message}`);
        return null;
      }
    }
    async function requeueParked() {
      ensureClients(clients?.playerId ?? null);
      if (!clients?.uploader) return 0;
      const n = await clients.uploader.requeueRejected();
      await refreshQueue();
      logEvent("collected", `Requeued ${n} parked record(s)`);
      render();
      if (n) flush({ force: true });
      return n;
    }
    async function exportParked() {
      ensureClients(clients?.playerId ?? null);
      const parked = clients?.uploader ? await clients.uploader.rejected() : [];
      const text = JSON.stringify({ exported_at: new Date(now()).toISOString(), parked }, null, 1);
      env.ui.download?.(`bga-stats-parked-${new Date(now()).toISOString().slice(0, 10)}.json`, text);
      return text;
    }
    async function dismissParked() {
      const raw = gm2.getValue(KEYS.queue, null);
      if (raw && !Array.isArray(raw)) gm2.setValue(KEYS.queue, { ...raw, rev: (raw.rev || 0) + 1, rejected: [] });
      await refreshQueue();
      logEvent("idle", "Dismissed parked records");
      render();
    }
    async function testConnection() {
      ensureClients(clients?.playerId ?? null);
      if (!clients?.server) return { ok: false, message: "Server URL is not set" };
      try {
        const h = await clients.server.health();
        await clients.server.known(["0"]);
        return { ok: true, message: `Server ok, schema versions ${(h.schema_versions || []).join(", ") || "?"}` };
      } catch (e) {
        return { ok: false, message: `${e.code || e.name}: ${e.message}` };
      }
    }
    function updateSettings(patch) {
      settings = saveSettings(gm2, patch, settings);
      rebuild(clients?.playerId ?? null);
      refreshQueue().then(render);
      return settings;
    }
    const cancel = () => st.abort?.abort();
    function resetCursor() {
      gm2.setValue(KEYS.cursor, null);
      render();
    }
    function yieldNow() {
      if (st.yielded) return;
      st.yielded = true;
      st.abort?.abort();
      env.ui.render?.(view());
      env.ui.hide();
    }
    function onNavigate() {
      const next = classifyPage(env.getHref());
      if (next.kind === page.kind && next.tableId === page.tableId) return;
      page = next;
      if (page.kind === "game") {
        st.abort?.abort();
        env.ui.hide();
        return;
      }
      if (st.yielded) return;
      env.ui.show();
      render();
      if (isCollectPage(page) && settings.autoCollect) collect({ auto: true });
    }
    async function start() {
      if (started) return { active: true };
      if (page.kind === "game") return { active: false, reason: "live game page" };
      started = true;
      beat();
      const settle = env.variantSettleMs ?? (build2.variant === "combined" ? 1500 : 0);
      if (settle) await sleep(settle);
      if (mustYield()) {
        st.yielded = true;
        return { active: false, reason: "per-game script present" };
      }
      rebuild(null);
      env.ui.mount({ collect: (o) => collect({ force: true, ...o }), backfill, flush, cancel, testConnection, updateSettings, resetCursor, requeueParked, exportParked, dismissParked, getView: view });
      for (const [label, fn] of [
        ["Collect this table now", () => collect({ force: true })],
        ["Backfill history...", () => env.ui.openPanel("backfill")],
        ["Retry queued records", () => flush()],
        ["Requeue parked records", () => requeueParked()],
        ["Settings (server, token)", () => env.ui.openPanel("settings")]
      ]) gm2.registerMenuCommand?.(`BGA Stats: ${label}`, fn);
      await refreshQueue();
      render();
      timers.push(setIv(onNavigate, 2e3));
      timers.push(setIv(() => {
        beat();
        if (mustYield()) return yieldNow();
        if (guardLive() && isConfigured(settings) && st.phase === "idle") flush({ force: false });
        render();
      }, 2e4));
      if (isConfigured(settings)) {
        await flush({ force: false });
        if (isCollectPage(page) && settings.autoCollect) collect({ auto: true });
        track(resumePendingLogin());
      }
      return { active: true };
    }
    function stop() {
      timers.forEach(clearIv);
      timers = [];
      st.abort?.abort();
    }
    async function whenIdle() {
      while (inflight.size) await Promise.allSettled([...inflight]);
    }
    return { start, stop, collect, backfill, flush, testConnection, updateSettings, cancel, view, onNavigate, requeueParked, exportParked, dismissParked, whenIdle, get settings() {
      return settings;
    } };
  }

  // src/ui.js
  var COLORS = { idle: "#6b7280", working: "#2563eb", collected: "#15803d", queued: "#b45309", offline: "#b45309", error: "#b91c1c", setup: "#6d28d9", login: "#6d28d9", paused: "#b45309" };
  var MAX_Z = 2147483647;
  var CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { position: fixed; left: 12px; bottom: var(--y, 12px); z-index: ${MAX_Z}; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 13px; color: #111827; pointer-events: none; }
.wrap > * { pointer-events: auto; }
.wrap.right { align-items: flex-end; }
.badge { display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 4px 11px; border-radius: 999px; background: rgba(17,24,39,.92); color: #f9fafb; border: 1px solid rgba(255,255,255,.25); cursor: grab; font-size: 12px; line-height: 16px; opacity: .8; transition: opacity .15s; touch-action: none; user-select: none; }
.badge:hover, .badge:focus-visible { opacity: 1; }
.badge:focus-visible, .row button:focus-visible, .tabs button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
.badge.dragging { cursor: grabbing; opacity: 1; }
.badge.mini .label { display: none; }
.badge.mini { padding: 4px 7px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 1px rgba(255,255,255,.5); }
.working .dot { animation: pulse 1s infinite ease-in-out; }
@keyframes pulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .working .dot { animation: none; } }
.panel { width: 340px; max-width: calc(100vw - 24px); max-height: max(160px, calc(100vh - var(--y, 12px) - 84px)); overflow: auto; background: #fff; border: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 10px 12px; }
.panel[hidden] { display: none; }
.panel h3 { margin: 0 0 6px; font-size: 14px; }
.tabs { display: flex; gap: 4px; margin-bottom: 8px; }
.tabs button { flex: 1; min-height: 28px; padding: 4px; border: 1px solid #9ca3af; background: #f9fafb; color: #111827; border-radius: 5px; cursor: pointer; font-size: 13px; }
.tabs button[aria-selected="true"] { background: #111827; color: #fff; border-color: #111827; }
label { display: block; margin: 6px 0 2px; color: #374151; }
input[type=text], input[type=password], input[type=number], select { width: 100%; min-height: 28px; padding: 4px 6px; border: 1px solid #6b7280; border-radius: 4px; font-size: 13px; }
.row { display: flex; gap: 6px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
.row button { min-height: 28px; padding: 4px 10px; border: 1px solid #111827; background: #111827; color: #fff; border-radius: 5px; cursor: pointer; font-size: 13px; }
.row button.secondary { background: #fff; color: #111827; }
.row button:disabled { opacity: .5; cursor: default; }
.muted { color: #4b5563; }
.warn { color: #92400e; font-weight: 600; }
.ev { margin: 6px 0 0; padding: 0; list-style: none; font-size: 12px; }
.ev li { padding: 2px 0; border-top: 1px solid #f3f4f6; word-break: break-word; }
.ev .error { color: #b91c1c; }
.msg { margin-top: 6px; min-height: 16px; }
/* Touch screens and narrow viewports: 44 px targets and 14+ px text. */
@media (pointer: coarse), (max-width: 640px) {
  .wrap { font-size: 14px; }
  .badge { min-height: 44px; padding: 8px 16px; font-size: 14px; line-height: 20px; }
  .badge.mini { padding: 8px 14px; }
  .dot { width: 12px; height: 12px; }
  .panel { font-size: 14px; }
  .panel h3 { font-size: 16px; }
  .tabs button, .row button { min-height: 44px; font-size: 14px; padding: 8px 12px; }
  input[type=text], input[type=password], input[type=number], select { min-height: 44px; font-size: 16px; }
  input[type=checkbox] { width: 24px; height: 24px; vertical-align: middle; }
  .ev { font-size: 13px; }
}
`;
  var el = (doc, tag, props = {}, ...kids) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null) e.append(k);
    return e;
  };
  function createUi(doc, { hostId = "bga-stats-host", storage = null, autoMiniMs = 8e3, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    let host, root, wrapEl, badgeBtn, panel, body, actions, tab = "status", view = null, open = false, miniTimer = null, msg = "";
    let pos = null;
    const win = doc.defaultView;
    const loadPos = () => {
      try {
        const p = storage?.get("badgePos", null);
        return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
      } catch {
        return null;
      }
    };
    const savePos = () => {
      try {
        storage?.set("badgePos", pos);
      } catch {
      }
    };
    function bannerLift(vh) {
      try {
        const n = doc.querySelector("#didomi-notice, .didomi-popup-container");
        if (!n) return 0;
        const r = n.getBoundingClientRect();
        const ch = doc.documentElement?.clientHeight || vh;
        if (r.height < 20 || r.top >= ch || r.bottom < ch * 0.5) return 0;
        return Math.ceil(ch - r.top) + 8;
      } catch {
        return 0;
      }
    }
    function applyPos() {
      if (!wrapEl) return;
      const vw = win?.innerWidth || 1280, vh = win?.innerHeight || 800;
      const lift = pos ? 0 : bannerLift(vh);
      const p = pos || { x: 12, y: 12 + lift };
      const x = Math.min(Math.max(0, p.x), Math.max(0, vw - 40));
      const y = Math.min(Math.max(0, p.y), Math.max(0, vh - 40));
      const right = x > vw / 2;
      const bw = badgeBtn?.offsetWidth || 60;
      wrapEl.style.setProperty("--x", `${x}px`);
      wrapEl.style.setProperty("--y", `${y}px`);
      wrapEl.style.left = right ? "auto" : `${x}px`;
      wrapEl.style.right = right ? `${Math.max(0, vw - x - bw)}px` : "auto";
      wrapEl.classList.toggle("right", right);
    }
    function setMsg(m) {
      msg = m;
      const n = root?.querySelector(".msg");
      if (n) n.textContent = m;
    }
    function renderBody() {
      if (!view) return;
      body.replaceChildren();
      const tabs = el(
        doc,
        "div",
        { class: "tabs", role: "tablist" },
        ...["status", "backfill", "settings"].map((t) => el(doc, "button", { type: "button", role: "tab", "aria-selected": String(tab === t), onclick: () => {
          tab = t;
          renderBody();
        } }, t[0].toUpperCase() + t.slice(1)))
      );
      body.append(el(doc, "h3", {}, `BGA stats (${view.variant}) v${view.version}`), tabs);
      if (tab === "status") renderStatus();
      else if (tab === "backfill") renderBackfill();
      else renderSettings();
      body.append(el(doc, "div", { class: "msg muted", role: "status" }, msg));
    }
    const add = (...kids) => body.append(...kids.flat().filter((k) => k != null));
    const btn = (label, onclick, { secondary = false, disabled = false } = {}) => el(doc, "button", { type: "button", class: secondary ? "secondary" : "", disabled, onclick }, label);
    function renderStatus() {
      add(
        el(doc, "div", {}, view.badge.title),
        el(doc, "div", { class: "muted" }, `Queue: ${view.queueSize}/${view.queueMax}. ${view.identity === "user" ? "Logged in to BGA." : view.identity === "pending" ? "BGA login state not known yet." : "Not logged in: stats-only records."}`),
        view.peers.length ? el(doc, "div", { class: "muted" }, `Note: the ${view.peers.join(", ")} script is also installed; install only one.`) : null,
        view.replayUntil ? el(doc, "div", { class: "warn" }, `BGA replay limit reached, logs paused until ${new Date(view.replayUntil).toLocaleString()}.`) : null,
        view.parked ? el(doc, "div", { class: "warn" }, `${view.parked} parked record(s): rejected by the server or over the queue cap.`) : null,
        el(
          doc,
          "div",
          { class: "row" },
          btn("Collect this table", () => actions.collect(), { disabled: view.busy }),
          btn("Retry queue", async () => {
            setMsg("Retrying queue...");
            const s = await actions.flush();
            setMsg(s ? `Delivered ${s.delivered}, remaining ${s.remaining}` : "Nothing to flush");
          }, { secondary: true, disabled: view.busy })
        ),
        view.parked ? el(
          doc,
          "div",
          { class: "row" },
          btn("Requeue parked", async () => {
            const n = await actions.requeueParked();
            setMsg(`Requeued ${n}`);
          }, { secondary: true }),
          btn("Export parked (JSON)", () => {
            actions.exportParked();
            setMsg("Exported");
          }, { secondary: true }),
          btn("Dismiss parked", async () => {
            await actions.dismissParked();
            setMsg("Dismissed");
          }, { secondary: true })
        ) : null,
        el(doc, "ul", { class: "ev" }, ...view.events.slice(0, 8).map((e) => el(doc, "li", { class: e.kind }, `${new Date(e.at).toLocaleTimeString()} ${e.message}`)))
      );
    }
    function renderBackfill() {
      const b = view.settings.backfill;
      const mt = el(doc, "input", { type: "number", id: "bf-max", min: "1", max: "500", value: String(b.maxTables) });
      const mm = el(doc, "input", { type: "number", id: "bf-min", min: "1", max: "120", value: String(b.maxMinutes) });
      const wl = el(doc, "input", { type: "checkbox", id: "bf-logs" });
      wl.checked = b.withLogs;
      const mode = el(doc, "select", { id: "bf-mode" }, el(doc, "option", { value: "catchup" }, "Catch up (newest first, stop at known)"), el(doc, "option", { value: "historic" }, "Historic (resume where it stopped)"));
      mode.value = b.mode;
      const p = view.progress;
      add(
        el(doc, "label", { for: "bf-max" }, "Max tables to collect"),
        mt,
        el(doc, "label", { for: "bf-min" }, "Max minutes"),
        mm,
        el(doc, "label", { for: "bf-mode" }, "Mode"),
        mode,
        el(doc, "label", {}, wl, " Include logs (3+ requests and up to MBs per table)"),
        view.replayUntil ? el(doc, "div", { class: "warn" }, `Logs paused until ${new Date(view.replayUntil).toLocaleString()} (BGA replay limit). A backfill with logs stops immediately; without logs it runs normally.`) : null,
        p ? el(doc, "div", { class: "muted" }, `Progress ${p.done}/${p.max}: ${p.note}`) : null,
        el(
          doc,
          "div",
          { class: "row" },
          btn("Start backfill", () => actions.backfill({ maxTables: +mt.value, maxMinutes: +mm.value, withLogs: wl.checked, mode: mode.value }), { disabled: view.busy || view.identity !== "user" }),
          btn("Cancel", () => actions.cancel(), { secondary: true, disabled: view.progress == null || !view.busy }),
          btn("Reset cursor", () => actions.resetCursor(), { secondary: true, disabled: view.busy })
        ),
        el(doc, "div", { class: "muted" }, view.identity === "user" ? `Cursor: ${view.cursor ? JSON.stringify(view.cursor) : "none"}` : "Log in to BGA to backfill.")
      );
    }
    function renderSettings() {
      const s = view.settings;
      const url = el(doc, "input", { type: "text", id: "st-url", value: s.serverUrl, placeholder: "http://203.0.113.10:8080", autocomplete: "off" });
      const tok = el(doc, "input", { type: "password", id: "st-tok", placeholder: s.ingestToken ? "(unchanged, enter to replace)" : "ingest token", autocomplete: "off" });
      const auto = el(doc, "input", { type: "checkbox", id: "st-auto" });
      auto.checked = s.autoCollect;
      const patch = () => {
        const p = { serverUrl: url.value, autoCollect: auto.checked };
        if (tok.value) p.ingestToken = tok.value;
        return p;
      };
      add(
        el(doc, "label", { for: "st-url" }, "Server URL"),
        url,
        el(doc, "label", { for: "st-tok" }, "Ingest token"),
        tok,
        el(doc, "label", {}, auto, " Collect finished tables automatically"),
        el(
          doc,
          "div",
          { class: "row" },
          btn("Save", () => {
            try {
              actions.updateSettings(patch());
              setMsg("Saved");
            } catch (e) {
              setMsg(e.message);
            }
          }),
          btn("Save and test", async () => {
            try {
              actions.updateSettings(patch());
            } catch (e) {
              return setMsg(e.message);
            }
            setMsg("Testing...");
            const r = await actions.testConnection();
            setMsg((r.ok ? "OK: " : "Failed: ") + r.message);
          }, { secondary: true })
        )
      );
    }
    function applyBadge() {
      if (!view) return;
      const b = view.badge;
      badgeBtn.className = `badge ${b.kind}`;
      badgeBtn.style.setProperty("--c", COLORS[b.kind] || COLORS.idle);
      badgeBtn.title = b.title;
      badgeBtn.setAttribute("aria-label", `BGA stats: ${b.label}. ${b.title}`);
      badgeBtn.dataset.kind = b.kind;
      badgeBtn.querySelector(".label").textContent = b.label;
      clearTimer(miniTimer);
      badgeBtn.classList.remove("mini");
      if (!open && (b.kind === "collected" || b.kind === "idle")) miniTimer = setTimer(() => {
        if (!open) badgeBtn.classList.add("mini");
      }, autoMiniMs);
    }
    function enableDrag() {
      let start = null;
      badgeBtn.addEventListener("pointerdown", (e) => {
        if (e.button !== void 0 && e.button !== 0) return;
        const r = wrapEl.getBoundingClientRect();
        start = { px: e.clientX, py: e.clientY, x: parseFloat(wrapEl.style.getPropertyValue("--x")) || 12, y: parseFloat(wrapEl.style.getPropertyValue("--y")) || 12, moved: false, bottom: r.bottom };
        badgeBtn.setPointerCapture?.(e.pointerId);
      });
      badgeBtn.addEventListener("pointermove", (e) => {
        if (!start) return;
        const dx = e.clientX - start.px, dy = e.clientY - start.py;
        if (!start.moved && Math.hypot(dx, dy) < 6) return;
        start.moved = true;
        badgeBtn.classList.add("dragging");
        pos = { x: start.x + dx, y: start.y - dy };
        applyPos();
      });
      const end = () => {
        if (start?.moved) {
          savePos();
          badgeBtn.dataset.justDragged = "1";
          setTimer(() => delete badgeBtn.dataset.justDragged, 0);
        }
        badgeBtn.classList.remove("dragging");
        start = null;
      };
      badgeBtn.addEventListener("pointerup", end);
      badgeBtn.addEventListener("pointercancel", end);
    }
    return {
      mount(acts) {
        actions = acts;
        pos = loadPos();
        host = el(doc, "div", { id: hostId, "data-bga-stats": "1" });
        root = host.attachShadow({ mode: "open" });
        const style = el(doc, "style");
        style.textContent = CSS;
        badgeBtn = el(doc, "button", { class: "badge", type: "button", "aria-haspopup": "dialog", onclick: () => {
          if (badgeBtn.dataset.justDragged) return;
          this.openPanel(open ? null : tab);
        } }, el(doc, "span", { class: "dot" }), el(doc, "span", { class: "label" }, "stats"));
        body = el(doc, "div", {});
        panel = el(doc, "div", { class: "panel", role: "dialog", "aria-label": "BGA stats", hidden: true }, body);
        wrapEl = el(doc, "div", { class: "wrap" }, panel, badgeBtn);
        root.append(style, wrapEl);
        root.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && open) {
            this.openPanel(null);
            badgeBtn.focus();
          }
        });
        (doc.body || doc.documentElement).append(host);
        applyPos();
        enableDrag();
        if (win) {
          const watch = () => {
            if (!pos) applyPos();
            setTimer(watch, 1500);
          };
          setTimer(watch, 1500);
        }
        win?.addEventListener?.("resize", applyPos);
      },
      render(v) {
        view = v;
        if (!root) return;
        applyBadge();
        applyPos();
        if (open) renderBody();
      },
      openPanel(t) {
        if (!root) return;
        open = !!t;
        if (t) tab = t;
        panel.hidden = !open;
        if (open) renderBody();
        applyBadge();
      },
      hide() {
        if (host) host.style.display = "none";
      },
      show() {
        if (host) host.style.display = "";
      },
      async askTableId() {
        const v = (typeof prompt === "function" ? prompt("BGA table id to collect:") : null) || "";
        return /^\d{1,15}$/.test(v.trim()) ? v.trim() : null;
      },
      download(name, text) {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = doc.createElement("a");
        a.href = url;
        a.download = name;
        doc.body.append(a);
        a.click();
        a.remove();
        setTimer(() => URL.revokeObjectURL(url), 1e4);
      },
      get hostElement() {
        return host;
      }
    };
  }

  // src/identity.js
  function readIdentity(w2, doc) {
    let id = Number(w2?.globalUserInfos?.id);
    let known = w2?.globalUserInfos != null && Number.isFinite(id);
    if (!known && doc) {
      try {
        for (const s of doc.scripts || []) {
          const m = /globalUserInfos\s*=\s*\{[^}]*?["']?id["']?\s*:\s*["']?(-?\d+)["']?/.exec(s.textContent || "");
          if (m) {
            id = Number(m[1]);
            known = true;
            break;
          }
        }
      } catch {
      }
    }
    const token = w2?.bgaConfig?.requestToken || null;
    if (!known) return { state: "pending", playerId: null, token };
    return id > 0 ? { state: "user", playerId: id, token } : { state: "anonymous", playerId: null, token };
  }

  // src/main.js
  var build = define_BUILD_default;
  var w = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  var gm = {
    getValue: (k, d) => GM_getValue(k, d),
    setValue: (k, v) => GM_setValue(k, v),
    registerMenuCommand: typeof GM_registerMenuCommand === "function" ? GM_registerMenuCommand : void 0,
    xhr: GM_xmlhttpRequest
  };
  var memory = /* @__PURE__ */ new Map();
  var shared = {
    get(k) {
      try {
        const v = window.localStorage.getItem(k);
        return v === null ? null : JSON.parse(v);
      } catch {
        return memory.get(k) ?? null;
      }
    },
    set(k, v) {
      try {
        window.localStorage.setItem(k, JSON.stringify(v));
      } catch {
        memory.set(k, v);
      }
    }
  };
  var app = createApp({
    core: BgaStatsCore,
    build,
    gm,
    shared,
    getHref: () => location.href,
    origin: location.origin,
    bgaFetch: window.fetch.bind(window),
    getToken: () => w.bgaConfig?.requestToken,
    getIdentity: () => readIdentity(w, document),
    ui: createUi(document, { hostId: `bga-stats-host-${build.variant}`, storage: { get: (k, d) => GM_getValue(k, d), set: (k, v) => GM_setValue(k, v) } })
  });
  app.start().catch((e) => console.error("[bga-stats] start failed", e));
})();
})();
