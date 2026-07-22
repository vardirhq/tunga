/* Tunga landing page — self-contained vanilla JS.
   Ported from the original design template (DCLogic component) to a
   framework-free implementation so it can be served statically. */
(function () {
  "use strict";

  var strings = {
    en: { nav_features:"Features", nav_how:"How it works", nav_docs:"Docs", badge:"i18n migration tool", hero_title:"Localize your codebase without the busywork.", hero_sub:"Tunga scans your TypeScript / React app, finds hardcoded UI strings, generates stable i18n keys, and rewrites your source with reviewable codemods.", cta_primary:"Get started", cta_secondary:"View on GitHub", p_label:"// the problem", p_title:"Hardcoded strings feel harmless — until you need translations.", p_body:"The work isn't conceptually hard, but it's tedious, repetitive, and easy to do inconsistently across a whole codebase. Tunga automates the migration while keeping you in control.", before:"before", after:"after", h_label:"// three commands", h_title:"The 30-second version", scan_desc:"Find candidate user-facing strings — JSX text, attributes, literals — grouped by confidence.", extract_desc:"Generate stable i18n keys and update locale JSON — with a --dry-run preview first.", apply_desc:"Rewrite source with reviewable codemods that emit your configured t(...) calls.", also_label:"also:", f_label:"// coverage", f_title:"What Tunga finds", fp_label:"// precision", fp_title:"It skips the false positives", fp_body:"Routes, class names, API paths, event names, MIME types, SVG data, CSS values — Tunga downgrades or ignores the strings that aren't user-facing copy, so your review stays signal-heavy.", s_label:"// trust", s_title:"Tunga edits code, so it earns trust", safe1_t:"Preview everything", safe1_b:"See exactly which source and locale changes will happen before a single file is written.", safe2_t:"Reviewable codemods", safe2_b:"Tunga rewrites normal source files instead of hiding changes behind a service. Diff it, revert it.", safe3_t:"Locales stay safe", safe3_b:"Existing locale values are never silently overwritten unless you explicitly ask for it.", safe4_t:"No blind replaces", safe4_b:"Position metadata avoids replacing every identical string across the project blindly.", rm_now:"Current MVP", rm_soon:"On the roadmap", ph_label:"// philosophy", ph_quote:"Tunga should not be magical. Every change should be visible. Every modification should be explainable.", ph_body:"A good migration tool should feel boring in the best way: predictable, inspectable, and easy to revert. It removes repetitive work — it doesn't take control away from the developer.", cta_title:"Start your i18n migration", cta_body:"Run Tunga on a clean branch, preview the diff, and merge with confidence.", cta_button:"★ Star on GitHub", foot_tag:"An i18n migration tool — not a platform, not SaaS, not AI translation.", fp_chips:["routes & paths","Tailwind classes","CSS values","SVG path data","URLs & emails","API endpoints","HTTP methods","event names","MIME types","env vars","existing i18n keys"], rm_now_items:["React & TypeScript","JSX text, attribute, literal & template scanning","Locale JSON generation","Babel-powered codemods","Dry-run previews","Interactive review with persisted manifest","Config denylists & inline ignore directives"], rm_soon_items:["next-intl, react-i18next & FormatJS presets","Grouped duplicate string review","Stronger component & route awareness","Format-preserving (recast-style) codemods","HTML & Markdown reports"] },
    es: { nav_features:"Funciones", nav_how:"Cómo funciona", nav_docs:"Docs", badge:"herramienta de migración i18n", hero_title:"Internacionaliza tu código sin el trabajo tedioso.", hero_sub:"Tunga analiza tu app de TypeScript / React, encuentra cadenas de UI incrustadas, genera claves i18n estables y reescribe tu código con codemods revisables.", cta_primary:"Empezar", cta_secondary:"Ver en GitHub", p_label:"// el problema", p_title:"Las cadenas incrustadas parecen inofensivas — hasta que necesitas traducciones.", p_body:"El trabajo no es difícil en sí, pero es tedioso, repetitivo y fácil de hacer de forma inconsistente en todo el código. Tunga automatiza la migración manteniéndote en control.", before:"antes", after:"después", h_label:"// tres comandos", h_title:"La versión de 30 segundos", scan_desc:"Encuentra cadenas candidatas de cara al usuario — texto JSX, atributos, literales — agrupadas por confianza.", extract_desc:"Genera claves i18n estables y actualiza el JSON de locales — con vista previa --dry-run primero.", apply_desc:"Reescribe el código con codemods revisables que emiten tus llamadas t(...) configuradas.", also_label:"además:", f_label:"// cobertura", f_title:"Lo que Tunga encuentra", fp_label:"// precisión", fp_title:"Ignora los falsos positivos", fp_body:"Rutas, nombres de clase, rutas de API, nombres de eventos, tipos MIME, datos SVG, valores CSS — Tunga degrada o ignora las cadenas que no son texto de cara al usuario, para que tu revisión tenga más señal.", s_label:"// confianza", s_title:"Tunga edita código, así que se gana tu confianza", safe1_t:"Previsualiza todo", safe1_b:"Ve exactamente qué cambios de código y de locales ocurrirán antes de escribir un solo archivo.", safe2_t:"Codemods revisables", safe2_b:"Tunga reescribe archivos de código normales en lugar de ocultar cambios tras un servicio. Compáralo, reviértelo.", safe3_t:"Los locales están a salvo", safe3_b:"Los valores de locale existentes nunca se sobrescriben en silencio a menos que lo pidas explícitamente.", safe4_t:"Sin reemplazos ciegos", safe4_b:"Los metadatos de posición evitan reemplazar a ciegas cada cadena idéntica del proyecto.", rm_now:"MVP actual", rm_soon:"En la hoja de ruta", ph_label:"// filosofía", ph_quote:"Tunga no debería ser mágico. Cada cambio debe ser visible. Cada modificación debe ser explicable.", ph_body:"Una buena herramienta de migración debería sentirse aburrida en el buen sentido: predecible, inspeccionable y fácil de revertir. Elimina el trabajo repetitivo — no le quita el control al desarrollador.", cta_title:"Comienza tu migración i18n", cta_body:"Ejecuta Tunga en una rama limpia, previsualiza el diff y fusiona con confianza.", cta_button:"★ Marca con estrella en GitHub", foot_tag:"Una herramienta de migración i18n — no una plataforma, ni SaaS, ni traducción por IA.", fp_chips:["rutas y paths","clases de Tailwind","valores CSS","datos de path SVG","URLs y correos","endpoints de API","métodos HTTP","nombres de eventos","tipos MIME","variables de entorno","claves i18n existentes"], rm_now_items:["React y TypeScript","Escaneo de texto JSX, atributos, literales y plantillas","Generación de JSON de locales","Codemods con Babel","Vistas previas dry-run","Revisión interactiva con manifiesto persistente","Listas de exclusión y directivas de ignorado en línea"], rm_soon_items:["Presets de next-intl, react-i18next y FormatJS","Revisión agrupada de cadenas duplicadas","Mayor conciencia de componentes y rutas","Codemods que preservan formato (estilo recast)","Informes HTML y Markdown"] },
    fr: { nav_features:"Fonctionnalités", nav_how:"Comment ça marche", nav_docs:"Docs", badge:"outil de migration i18n", hero_title:"Internationalisez votre code sans la corvée.", hero_sub:"Tunga analyse votre app TypeScript / React, repère les chaînes d'interface codées en dur, génère des clés i18n stables et réécrit votre code avec des codemods vérifiables.", cta_primary:"Commencer", cta_secondary:"Voir sur GitHub", p_label:"// le problème", p_title:"Les chaînes codées en dur semblent inoffensives — jusqu'au jour où il faut des traductions.", p_body:"Le travail n'est pas difficile en soi, mais il est fastidieux, répétitif et facile à faire de façon incohérente dans tout le code. Tunga automatise la migration tout en vous laissant le contrôle.", before:"avant", after:"après", h_label:"// trois commandes", h_title:"La version en 30 secondes", scan_desc:"Repère les chaînes candidates destinées à l'utilisateur — texte JSX, attributs, littéraux — regroupées par confiance.", extract_desc:"Génère des clés i18n stables et met à jour le JSON de locales — avec un aperçu --dry-run d'abord.", apply_desc:"Réécrit le code avec des codemods vérifiables qui émettent vos appels t(...) configurés.", also_label:"aussi :", f_label:"// couverture", f_title:"Ce que Tunga trouve", fp_label:"// précision", fp_title:"Il évite les faux positifs", fp_body:"Routes, noms de classe, chemins d'API, noms d'événements, types MIME, données SVG, valeurs CSS — Tunga rétrograde ou ignore les chaînes qui ne sont pas du texte destiné à l'utilisateur, pour que votre revue reste pertinente.", s_label:"// confiance", s_title:"Tunga modifie le code, il gagne donc votre confiance", safe1_t:"Prévisualisez tout", safe1_b:"Voyez exactement quels changements de code et de locales auront lieu avant d'écrire le moindre fichier.", safe2_t:"Codemods vérifiables", safe2_b:"Tunga réécrit des fichiers source normaux au lieu de cacher les changements derrière un service. Comparez, annulez.", safe3_t:"Les locales restent sûres", safe3_b:"Les valeurs de locale existantes ne sont jamais écrasées en silence sauf demande explicite.", safe4_t:"Pas de remplacements aveugles", safe4_b:"Les métadonnées de position évitent de remplacer aveuglément chaque chaîne identique du projet.", rm_now:"MVP actuel", rm_soon:"Feuille de route", ph_label:"// philosophie", ph_quote:"Tunga ne devrait pas être magique. Chaque changement doit être visible. Chaque modification doit être explicable.", ph_body:"Un bon outil de migration devrait sembler ennuyeux dans le bon sens : prévisible, inspectable et facile à annuler. Il supprime le travail répétitif — il ne retire pas le contrôle au développeur.", cta_title:"Commencez votre migration i18n", cta_body:"Lancez Tunga sur une branche propre, prévisualisez le diff et fusionnez en confiance.", cta_button:"★ Mettre une étoile sur GitHub", foot_tag:"Un outil de migration i18n — pas une plateforme, pas un SaaS, pas de traduction par IA.", fp_chips:["routes & chemins","classes Tailwind","valeurs CSS","données de path SVG","URLs & e-mails","endpoints d'API","méthodes HTTP","noms d'événements","types MIME","variables d'env","clés i18n existantes"], rm_now_items:["React & TypeScript","Analyse du texte JSX, attributs, littéraux & templates","Génération du JSON de locales","Codemods propulsés par Babel","Aperçus dry-run","Revue interactive avec manifeste persistant","Denylists de config & directives d'ignorance en ligne"], rm_soon_items:["Presets next-intl, react-i18next & FormatJS","Revue groupée des chaînes en double","Meilleure conscience des composants & routes","Codemods préservant le format (style recast)","Rapports HTML & Markdown"] },
    de: { nav_features:"Funktionen", nav_how:"So funktioniert's", nav_docs:"Doku", badge:"i18n-Migrationstool", hero_title:"Lokalisiere deinen Code ohne die Fleißarbeit.", hero_sub:"Tunga scannt deine TypeScript-/React-App, findet fest codierte UI-Strings, erzeugt stabile i18n-Schlüssel und schreibt deinen Quellcode mit überprüfbaren Codemods um.", cta_primary:"Loslegen", cta_secondary:"Auf GitHub ansehen", p_label:"// das Problem", p_title:"Fest codierte Strings wirken harmlos — bis du Übersetzungen brauchst.", p_body:"Die Arbeit ist nicht konzeptionell schwer, aber mühsam, repetitiv und leicht inkonsistent über eine ganze Codebasis hinweg. Tunga automatisiert die Migration und lässt dir die Kontrolle.", before:"vorher", after:"nachher", h_label:"// drei Befehle", h_title:"Die 30-Sekunden-Version", scan_desc:"Findet kandidatische, nutzerseitige Strings — JSX-Text, Attribute, Literale — gruppiert nach Konfidenz.", extract_desc:"Erzeugt stabile i18n-Schlüssel und aktualisiert das Locale-JSON — mit --dry-run-Vorschau zuerst.", apply_desc:"Schreibt den Quellcode mit überprüfbaren Codemods um, die deine konfigurierten t(...)-Aufrufe erzeugen.", also_label:"außerdem:", f_label:"// abdeckung", f_title:"Was Tunga findet", fp_label:"// präzision", fp_title:"Es überspringt die Fehlalarme", fp_body:"Routen, Klassennamen, API-Pfade, Event-Namen, MIME-Typen, SVG-Daten, CSS-Werte — Tunga stuft Strings herab oder ignoriert sie, wenn sie kein nutzerseitiger Text sind, damit deine Prüfung signalstark bleibt.", s_label:"// vertrauen", s_title:"Tunga bearbeitet Code — und verdient sich dein Vertrauen", safe1_t:"Alles vorab ansehen", safe1_b:"Sieh genau, welche Code- und Locale-Änderungen passieren, bevor eine einzige Datei geschrieben wird.", safe2_t:"Überprüfbare Codemods", safe2_b:"Tunga schreibt normale Quelldateien um, statt Änderungen hinter einem Dienst zu verstecken. Diffe es, mach es rückgängig.", safe3_t:"Locales bleiben sicher", safe3_b:"Bestehende Locale-Werte werden nie stillschweigend überschrieben, außer du verlangst es ausdrücklich.", safe4_t:"Keine blinden Ersetzungen", safe4_b:"Positions-Metadaten verhindern das blinde Ersetzen jedes identischen Strings im Projekt.", rm_now:"Aktuelles MVP", rm_soon:"Auf der Roadmap", ph_label:"// philosophie", ph_quote:"Tunga sollte nicht magisch sein. Jede Änderung sollte sichtbar sein. Jede Modifikation sollte erklärbar sein.", ph_body:"Ein gutes Migrationstool sollte im besten Sinne langweilig sein: vorhersehbar, inspizierbar und leicht rückgängig zu machen. Es nimmt repetitive Arbeit ab — nicht die Kontrolle vom Entwickler.", cta_title:"Starte deine i18n-Migration", cta_body:"Führe Tunga auf einem sauberen Branch aus, prüfe den Diff und merge mit Vertrauen.", cta_button:"★ Auf GitHub mit Stern versehen", foot_tag:"Ein i18n-Migrationstool — keine Plattform, kein SaaS, keine KI-Übersetzung.", fp_chips:["Routen & Pfade","Tailwind-Klassen","CSS-Werte","SVG-Pfaddaten","URLs & E-Mails","API-Endpunkte","HTTP-Methoden","Event-Namen","MIME-Typen","Umgebungsvariablen","bestehende i18n-Schlüssel"], rm_now_items:["React & TypeScript","Scannen von JSX-Text, Attributen, Literalen & Templates","Locale-JSON-Generierung","Babel-basierte Codemods","Dry-run-Vorschauen","Interaktive Prüfung mit persistiertem Manifest","Config-Denylists & Inline-Ignore-Direktiven"], rm_soon_items:["next-intl-, react-i18next- & FormatJS-Presets","Gruppierte Prüfung doppelter Strings","Stärkeres Komponenten- & Routen-Bewusstsein","Formaterhaltende (recast-artige) Codemods","HTML- & Markdown-Berichte"] },
    ja: { nav_features:"機能", nav_how:"使い方", nav_docs:"ドキュメント", badge:"i18n 移行ツール", hero_title:"面倒な作業なしでコードをローカライズ。", hero_sub:"Tunga は TypeScript / React アプリをスキャンし、ハードコードされた UI 文字列を検出、安定した i18n キーを生成し、レビュー可能な codemod でソースを書き換えます。", cta_primary:"はじめる", cta_secondary:"GitHub で見る", p_label:"// 課題", p_title:"ハードコードされた文字列は無害に見える — 翻訳が必要になるまでは。", p_body:"作業自体は難しくありませんが、退屈で反復的、そしてコードベース全体で不統一になりがちです。Tunga はあなたに主導権を残したまま移行を自動化します。", before:"変更前", after:"変更後", h_label:"// 3つのコマンド", h_title:"30秒版", scan_desc:"ユーザー向け文字列の候補（JSXテキスト、属性、リテラル）を信頼度別にまとめて検出します。", extract_desc:"安定した i18n キーを生成しロケール JSON を更新 — まず --dry-run でプレビュー。", apply_desc:"設定した t(...) 呼び出しを出力する、レビュー可能な codemod でソースを書き換えます。", also_label:"その他:", f_label:"// 対応範囲", f_title:"Tunga が検出するもの", fp_label:"// 精度", fp_title:"誤検出はスキップ", fp_body:"ルート、クラス名、API パス、イベント名、MIME タイプ、SVG データ、CSS 値 — Tunga はユーザー向けでない文字列を降格または無視し、レビューの精度を保ちます。", s_label:"// 信頼", s_title:"Tunga はコードを編集するからこそ信頼を得る", safe1_t:"すべてプレビュー", safe1_b:"ファイルを1つ書き込む前に、どのソースとロケールが変わるかを正確に確認できます。", safe2_t:"レビュー可能な codemod", safe2_b:"Tunga は変更をサービスの裏に隠さず、通常のソースファイルを書き換えます。差分を見て、元に戻せます。", safe3_t:"ロケールは安全", safe3_b:"既存のロケール値は、明示的に指定しない限り黙って上書きされることはありません。", safe4_t:"盲目的な置換なし", safe4_b:"位置メタデータにより、プロジェクト内の同一文字列を盲目的に置換しません。", rm_now:"現在の MVP", rm_soon:"ロードマップ", ph_label:"// 哲学", ph_quote:"Tunga は魔法であるべきではない。すべての変更は見えるべきだ。すべての修正は説明できるべきだ。", ph_body:"良い移行ツールは良い意味で退屈であるべきです。予測可能で、検査可能で、元に戻しやすい。反復作業を取り除きますが、開発者から主導権を奪いません。", cta_title:"i18n 移行を始めよう", cta_body:"クリーンなブランチで Tunga を実行し、差分を確認して、安心してマージ。", cta_button:"★ GitHub でスターを付ける", foot_tag:"i18n 移行ツール — プラットフォームでも SaaS でも AI 翻訳でもありません。", fp_chips:["ルートとパス","Tailwind クラス","CSS 値","SVG パスデータ","URL とメール","API エンドポイント","HTTP メソッド","イベント名","MIME タイプ","環境変数","既存の i18n キー"], rm_now_items:["React と TypeScript","JSX テキスト・属性・リテラル・テンプレートのスキャン","ロケール JSON の生成","Babel による codemod","dry-run プレビュー","永続マニフェストによる対話的レビュー","設定の denylist とインライン無視ディレクティブ"], rm_soon_items:["next-intl・react-i18next・FormatJS プリセット","重複文字列のグループ化レビュー","コンポーネントとルートの認識強化","フォーマット保持（recast 方式）codemod","HTML・Markdown レポート"] }
  };

  var langLabels = [["en","EN"],["es","ES"],["fr","FR"],["de","DE"],["ja","JA"]];

  // Keys that get the scramble animation on language switch (text nodes only;
  // lists are re-rendered instantly).
  var scrambleKeys = ["nav_how","nav_features","nav_docs","badge","hero_title","hero_sub","cta_primary","cta_secondary","p_label","p_title","p_body","before","after","h_label","h_title","scan_desc","extract_desc","apply_desc","f_label","f_title","fp_label","fp_title","fp_body","s_label","s_title","safe1_t","safe1_b","safe2_t","safe2_b","safe3_t","safe3_b","safe4_t","safe4_b","rm_now","rm_soon","ph_label","ph_quote","ph_body","cta_title","cta_body","cta_button","foot_tag"];
  var glyphs = "ｦｧｨｩｪｫｬｭｮｯ01<>-_/\\[]{}=+*#$%&アイウエオカキ";

  var script = [
    { kind:"cmd", text:"tunga scan" },
    { kind:"out", text:"Found 3 candidate strings", color:"#8b98a8" },
    { kind:"out", text:'Header.tsx:12   JSX text       "Save"', color:"#6b7684" },
    { kind:"out", text:'SearchBox.tsx:8 JSX attribute  "Search products"', color:"#6b7684" },
    { kind:"out", text:'Settings.tsx:8  JSX text       "Account settings"', color:"#6b7684" },
    { kind:"blank" },
    { kind:"cmd", text:"tunga extract" },
    { kind:"out", text:'+ ui.header.save = "Save"', color:"#57d38c" },
    { kind:"out", text:'+ ui.search_box.search_products = "Search products"', color:"#57d38c" },
    { kind:"out", text:'+ ui.settings.account_settings = "Account settings"', color:"#57d38c" },
    { kind:"blank" },
    { kind:"cmd", text:"tunga apply" },
    { kind:"out", text:"✓ Rewrote 3 files with t(...) calls", color:"#57d38c" },
    { kind:"out", text:"✓ locales/en.json updated", color:"#57d38c" }
  ];

  var state = { lang: "en" };
  var raf = null;

  function rc() { return glyphs[Math.floor(Math.random() * glyphs.length)]; }

  function i18nNodes() { return document.querySelectorAll("[data-i18n]"); }

  function setText(key, value) {
    var nodes = document.querySelectorAll('[data-i18n="' + key + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  }

  function renderLists(data) {
    var chips = document.getElementById("fp-chips");
    chips.innerHTML = "";
    data.fp_chips.forEach(function (c) {
      var s = document.createElement("span");
      s.style.cssText = "font-family:'JetBrains Mono',monospace; font-size:12.5px; color:#8b98a8; background:#0e141c; border:1px solid #1e2632; border-radius:100px; padding:7px 13px;";
      s.textContent = c;
      chips.appendChild(s);
    });
    fillRoadmap("rm-now", data.rm_now_items, "✓", "#57d38c");
    fillRoadmap("rm-soon", data.rm_soon_items, "○", "#5c6773");
  }

  function fillRoadmap(id, items, mark, color) {
    var el = document.getElementById(id);
    el.innerHTML = "";
    items.forEach(function (item) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:9px;";
      var m = document.createElement("span");
      m.style.color = color;
      m.textContent = mark;
      row.appendChild(m);
      row.appendChild(document.createTextNode(" " + item));
      el.appendChild(row);
    });
  }

  function applyInstant(data) {
    i18nNodes().forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (data[key] != null) node.textContent = data[key];
    });
    renderLists(data);
  }

  function startScramble(target) {
    if (raf) cancelAnimationFrame(raf);
    var dur = 700;
    var start = performance.now();
    var plan = {};
    scrambleKeys.forEach(function (k) {
      plan[k] = Array.from(target[k] || "").map(function (ch) {
        return { ch: ch, s: Math.random() * 0.45, e: 0.4 + Math.random() * 0.6 };
      });
    });
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      scrambleKeys.forEach(function (k) {
        var out = plan[k].map(function (c) {
          if (c.ch === " " || c.ch === "\n") return c.ch;
          if (p >= c.e) return c.ch;
          return rc();
        }).join("");
        setText(k, out);
      });
      if (p < 1) raf = requestAnimationFrame(step);
      else scrambleKeys.forEach(function (k) { setText(k, target[k]); });
    }
    raf = requestAnimationFrame(step);
  }

  function selectLang(code) {
    if (code === state.lang && document.querySelector('[data-i18n="hero_title"]').textContent) {
      // still allow re-scramble but keep it simple: ignore no-op reselect
    }
    state.lang = code;
    var data = strings[code];
    // Update non-scrambled keys + lists instantly, scramble the animated set.
    i18nNodes().forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (data[key] != null && scrambleKeys.indexOf(key) === -1) node.textContent = data[key];
    });
    renderLists(data);
    updateLangButtons();
    startScramble(data);
  }

  function buildLangButtons(container, big) {
    container.innerHTML = "";
    langLabels.forEach(function (pair) {
      var code = pair[0], label = pair[1];
      var btn = document.createElement("button");
      btn.className = "lang-btn";
      btn.setAttribute("data-lang", code);
      if (big) {
        btn.style.cssText = "font-size:13px; font-weight:600; padding:9px 16px; border-radius:8px;";
      } else {
        btn.style.cssText = "font-size:12px; font-weight:600; padding:5px 0; width:32px; text-align:center; border-radius:6px;";
      }
      btn.textContent = label;
      btn.addEventListener("click", function () {
        selectLang(code);
        closeMenu();
      });
      container.appendChild(btn);
    });
  }

  function updateLangButtons() {
    var btns = document.querySelectorAll(".lang-btn");
    for (var i = 0; i < btns.length; i++) {
      var active = btns[i].getAttribute("data-lang") === state.lang;
      btns[i].style.background = active ? "#57d38c" : "transparent";
      btns[i].style.color = active ? "#04160c" : "#8b98a8";
    }
  }

  // ---- Mobile menu ----
  var menuOpen = false;
  function renderMenuIcon() {
    var icon = document.getElementById("ham-icon");
    if (menuOpen) {
      icon.innerHTML = '<span style="font-size:20px; line-height:1; font-family:\'JetBrains Mono\',monospace;">✕</span>';
    } else {
      icon.innerHTML = '<span style="display:flex; flex-direction:column; gap:4px;"><span style="width:18px; height:2px; background:#c8d0da; border-radius:2px;"></span><span style="width:18px; height:2px; background:#c8d0da; border-radius:2px;"></span><span style="width:18px; height:2px; background:#c8d0da; border-radius:2px;"></span></span>';
    }
  }
  function openMenu() { menuOpen = true; document.getElementById("mobile-menu").style.display = "block"; renderMenuIcon(); }
  function closeMenu() { menuOpen = false; document.getElementById("mobile-menu").style.display = "none"; renderMenuIcon(); }

  // ---- Terminal animation ----
  var linesEl, currentEl, cursorEl;
  var lines = [];
  var timers = [];
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

  function renderLines() {
    linesEl.innerHTML = "";
    lines.forEach(function (line) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:8px; white-space:pre-wrap; word-break:break-word;";
      var prompt = document.createElement("span");
      prompt.style.cssText = "display:inline-block; width:12px; color:#57d38c; flex-shrink:0;";
      prompt.textContent = line.prompt ? "❯" : "";
      var text = document.createElement("span");
      text.style.color = line.color;
      text.textContent = line.text;
      row.appendChild(prompt);
      row.appendChild(text);
      linesEl.appendChild(row);
    });
  }

  function commit(stepObj) {
    var line;
    if (stepObj.kind === "cmd") line = { text: stepObj.text, color: "#e6edf3", prompt: true };
    else if (stepObj.kind === "blank") line = { text: " ", color: "#000", prompt: false };
    else line = { text: stepObj.text, color: stepObj.color, prompt: false };
    lines.push(line);
    renderLines();
  }

  function run(i) {
    if (i >= script.length) {
      later(function () { lines = []; currentEl.textContent = ""; renderLines(); run(0); }, 2600);
      return;
    }
    var stepObj = script[i];
    if (stepObj.kind === "cmd") {
      typeCmd(stepObj.text, 0, function () {
        commit(stepObj); currentEl.textContent = "";
        later(function () { run(i + 1); }, 420);
      });
    } else {
      later(function () { commit(stepObj); run(i + 1); }, stepObj.kind === "blank" ? 120 : 260);
    }
  }

  function typeCmd(text, j, done) {
    currentEl.textContent = text.slice(0, j);
    if (j < text.length) later(function () { typeCmd(text, j + 1, done); }, 46);
    else later(done, 260);
  }

  // ---- Init ----
  function init() {
    linesEl = document.getElementById("term-lines");
    currentEl = document.getElementById("term-current");
    cursorEl = document.getElementById("term-cursor");

    buildLangButtons(document.getElementById("lang-switch"), false);
    buildLangButtons(document.getElementById("lang-switch-mobile"), true);

    applyInstant(strings.en);
    updateLangButtons();

    document.getElementById("hamburger").addEventListener("click", function () {
      if (menuOpen) closeMenu(); else openMenu();
    });
    var closers = document.querySelectorAll("[data-close-menu]");
    for (var i = 0; i < closers.length; i++) closers[i].addEventListener("click", closeMenu);

    var copyBtn = document.getElementById("copy-install");
    copyBtn.addEventListener("click", function () {
      try { if (navigator.clipboard) navigator.clipboard.writeText("npm install -D tunga"); } catch (e) {}
      copyBtn.textContent = "copied ✓";
      setTimeout(function () { copyBtn.textContent = "copy"; }, 1500);
    });

    // blinking cursor
    setInterval(function () { cursorEl.style.opacity = cursorEl.style.opacity === "0" ? "1" : "0"; }, 500);

    run(0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
