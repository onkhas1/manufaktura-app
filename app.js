// Мини-приложение «Мануфактура» для Telegram: меню, бинго настоек, бронь, о баре.
// Работает и в обычном браузере (тогда без Telegram-функций, прогресс в localStorage).
(() => {
  const B = window.BAR, M = window.MENU, T = M.tinctures;
  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;
  const inTg = !!(tg && tg.platform && tg.platform !== 'unknown');
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const haptic = (kind) => { try { inTg && (kind === 'tap' ? tg.HapticFeedback.selectionChanged() : tg.HapticFeedback.notificationOccurred(kind)); } catch {} };

  if (inTg) {
    tg.ready(); tg.expand();
    try { tg.setHeaderColor('#8e2f34'); tg.setBackgroundColor('#f5efe6'); tg.setBottomBarColor && tg.setBottomBarColor('#fbf8f3'); } catch {}
  }

  /* ---------- Время ---------- */
  const now = new Date();
  const night = new Date(now); if (now.getHours() < 5) night.setDate(now.getDate() - 1);
  const dow = night.getDay(), isWed = dow === 3;
  const closeHour = d => (d === 5 || d === 6) ? 5 : 2;
  const openAt = new Date(night); openAt.setHours(17, 0, 0, 0);
  const closeAt = new Date(night); closeAt.setDate(night.getDate() + 1); closeAt.setHours(closeHour(dow), 0, 0, 0);
  const isOpen = now >= openAt && now < closeAt;
  $('#open').innerHTML = isOpen ? `Открыто<span>до ${pad(closeHour(dow))}:00</span>` : `Закрыто<span>откроемся в 17:00</span>`;

  /* ---------- Вкладки ---------- */
  const tabs = [...document.querySelectorAll('.tab')];
  const show = name => {
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.s === name));
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + name));
    scrollTo(0, 0); haptic('tap');
  };
  tabs.forEach(t => t.onclick = () => show(t.dataset.s));
  const start = new URLSearchParams(location.search).get('tab') || (inTg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
  if (['menu', 'bingo', 'book', 'about'].includes(start)) show(start);

  /* ---------- Нижний лист ---------- */
  const scrim = $('#scrim'), sheet = $('#sheet'), sheetBody = $('#sheetBody');
  let onClose = null;
  // Пока лист открыт, страница под ним заморожена (иначе в Telegram меню листается за листом).
  let lockY = 0, sheetOpen = false;
  const lock = () => { lockY = scrollY; Object.assign(document.body.style, { position: 'fixed', top: `-${lockY}px`, left: '0', right: '0', overflow: 'hidden' }); };
  const unlock = () => { Object.assign(document.body.style, { position: '', top: '', left: '', right: '', overflow: '' }); scrollTo(0, lockY); };
  const openSheet = (html, after) => {
    sheetBody.innerHTML = html; sheet.style.transform = ''; sheet.scrollTop = 0;
    if (!sheetOpen) lock();
    sheetOpen = true; scrim.classList.add('on'); sheet.classList.add('on');
    if (inTg) { tg.BackButton.show(); try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch {} }
    after && after();
  };
  const closeSheet = () => {
    if (!sheetOpen) return;
    sheetOpen = false; scrim.classList.remove('on'); sheet.classList.remove('on'); sheet.style.transform = '';
    unlock();
    if (inTg) { tg.BackButton.hide(); try { tg.enableVerticalSwipes && tg.enableVerticalSwipes(); } catch {} }
    onClose && onClose(); onClose = null;
  };
  scrim.onclick = closeSheet;
  scrim.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  // Смахнуть лист вниз: тянем, если содержимое листа прокручено к началу.
  let y0 = null, dy = 0, t0 = 0;
  sheet.addEventListener('touchstart', e => { if (sheet.scrollTop > 0) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); sheet.style.transition = 'none'; }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (y0 === null) return; dy = e.touches[0].clientY - y0;
    if (dy > 0) { e.preventDefault(); sheet.style.transform = `translateY(${dy}px)`; scrim.style.opacity = String(Math.max(0, 1 - dy / 400)); }
  }, { passive: false });
  sheet.addEventListener('touchend', () => {
    if (y0 === null) return; sheet.style.transition = ''; scrim.style.opacity = '';
    const fast = dy > 40 && Date.now() - t0 < 250;
    if (dy > 110 || fast) closeSheet(); else sheet.style.transform = '';
    y0 = null; dy = 0;
  });
  if (inTg) tg.BackButton.onClick(closeSheet);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  /* ---------- Меню ---------- */
  const row = (i, withPhoto) => {
    const right = `<span class="rt">${i.w ? `<span class="w">${esc(i.w)}</span>` : ''}<span class="pr">${i.price}</span></span>`;
    const txt = `<span><span class="nm">${esc(i.name)}</span><span class="ds">${esc(i.desc)}</span></span>`;
    if (withPhoto && i.photo) return `<li><button class="it" type="button" data-photo="${i.photo}"><img class="ph" src="img/dish/${i.photo}.jpg" alt="" loading="lazy">${txt}${right}</button></li>`;
    return `<li class="it"><span class="ph none"></span>${txt}${right}</li>`;
  };
  let kSel = M.kitchen[0].title;
  const views = {
    kitchen: () => `<div class="chips" id="kChips">${M.kitchen.map(g => `<button class="chip" type="button" aria-pressed="${g.title === kSel}" data-g="${esc(g.title)}">${esc(g.title)}</button>`).join('')}</div>
      <div class="pad">${(() => { const g = M.kitchen.find(x => x.title === kSel); return `<p class="group">${esc(g.title)}</p><ul class="list">${g.items.map(i => row(i, true)).join('')}</ul>`; })()}
      <p class="note">${esc(M.allergy)}</p></div>`,
    cocktails: () => `<div class="pad"><p class="group">Авторские · все по 600</p><div class="sigbox"><ul class="list">${M.cocktails.signature.map(i => row(i)).join('')}</ul></div>
      <p class="group">Классика</p><ul class="list">${M.cocktails.classic.map(i => row(i)).join('')}</ul>
      <p class="note">${esc(M.cocktails.note)}</p></div>`,
    tinct: () => `<div class="pad"><div class="t-price"><span class="pr">${isWed ? T.wednesday : T.price}</span><span>${isWed ? `Сегодня среда: все настойки по ${T.wednesday} ₽ вместо ${T.price}.` : `Любая настойка, 50 мл. По средам — ${T.wednesday} ₽.`}</span></div>
      ${T.groups.map(g => `<p class="group">${esc(g.title)}</p><ul class="list">${g.items.map(([n, d]) => `<li class="it"><span class="ph none"></span><span><span class="nm">${esc(n)}</span><span class="ds">${esc(d)}</span></span><span></span></li>`).join('')}</ul>`).join('')}
      <button class="btn ghost" type="button" data-go="bingo">Открыть бинго</button></div>`,
    bar: () => `<div class="pad bar2">${M.bar.map(g => `<div><p class="group">${esc(g.title)}</p><ul class="plain">${g.items.map(([n, p]) => `<li><span>${esc(n)}</span><b>${p}</b></li>`).join('')}</ul></div>`).join('')}</div>`
  };
  let mSel = 'kitchen';
  const renderMenu = () => { $('#menuBody').innerHTML = views[mSel](); };
  $('#menuSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; mSel = b.dataset.m;
    $('#menuSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x === b)); renderMenu(); haptic('tap'); };
  $('#menuBody').onclick = e => {
    const c = e.target.closest('.chip'); if (c) { kSel = c.dataset.g; renderMenu(); haptic('tap'); return; }
    const go = e.target.closest('[data-go]'); if (go) { show(go.dataset.go); return; }
    const it = e.target.closest('button.it'); if (!it) return;
    const i = M.kitchen.flatMap(g => g.items).find(x => String(x.photo) === it.dataset.photo);
    openSheet(`<img class="big" src="img/dish/${i.photo}.jpg" alt="${esc(i.name)}"><h3 id="shTitle">${esc(i.name)}</h3><p class="ds">${esc(i.desc)}</p>
      <div class="row"><span class="w">${esc(i.w)}</span><span class="pr">${i.price}</span></div>`);
  };
  renderMenu();

  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); };

  /* ---------- Книга образцов ---------- */
  // Дом 36 в 1873 году — лавка «Мануфактурные товары» купца А. Г. Морозова. Каждая настойка — образец ткани.
  const COLORS = { 'Бузина-цитрус':'#e8d37a','Гранат-персик':'#d4515a','Алоэ-киви':'#9cc06a','Яблоко-щавель':'#b9cd73','Фейхоа-лайм':'#86ad61','Вишня':'#7c1a2a','Хреновуха':'#e6dcb8','Томатная':'#d4472f','Лимончелло':'#f0cc45','Облепиха':'#ee8a24','Клюковка':'#b51f3a','Персик-личи-конопля':'#f1b083','Клубника-гречка':'#c64a58','Банан-куркума':'#efc244','Малина-пломбир':'#eda0b2','Кассис':'#4b1a3a','Порно шот':'#f2b45a','Джин на малине':'#d4567a','Черноплодный негрони':'#3b1422' };
  const tinct = []; T.groups.forEach(g => g.items.forEach(([n, d]) => tinct.push({ n, d, g: g.title })));
  const cats = T.groups.map(g => ({ title: g.title, items: tinct.filter(t => t.g === g.title) }));
  const RANKS = [ { at: 0, t: 'Покупатель' }, { at: 5, t: 'Купец 3-й гильдии' }, { at: 12, t: 'Купец 2-й гильдии' }, { at: 19, t: 'Купец 1-й гильдии' } ];
  const WEAVES = ['ситец в полоску', 'клетка', 'горох', 'ёлочка', 'саржа', 'рогожка'];

  // Цвет нитей узора: темнее на светлой ткани, светлее на тёмной.
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (c, w, k) => '#' + hex(c).map(v => Math.round(v + (w - v) * k).toString(16).padStart(2, '0')).join('');
  const lum = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  let swId = 0;
  // Образец ткани: SVG-узор + край «зигзагом», как после портновских ножниц.
  const swatchSVG = (name, w = 120, h = 90) => {
    const i = tinct.findIndex(t => t.n === name), c = COLORS[name], dark = lum(c) < .45;
    const ink = dark ? mix(c, 255, .38) : mix(c, 0, .28), soft = dark ? mix(c, 255, .18) : mix(c, 0, .12), id = 'sw' + (++swId);
    const kind = i % 6;
    const pat = [
      `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${c}"/><rect width="4" height="12" fill="${ink}" opacity=".55"/><rect x="7" width="1.5" height="12" fill="${ink}" opacity=".4"/></pattern>`,
      `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${c}"/><rect width="8" height="16" fill="${ink}" opacity=".3"/><rect width="16" height="8" fill="${ink}" opacity=".3"/></pattern>`,
      `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="${c}"/><circle cx="3.5" cy="3.5" r="2.2" fill="${ink}" opacity=".7"/><circle cx="10.5" cy="10.5" r="2.2" fill="${ink}" opacity=".7"/></pattern>`,
      `<pattern id="${id}" width="12" height="10" patternUnits="userSpaceOnUse"><rect width="12" height="10" fill="${c}"/><path d="M0 10 6 0M6 0l6 10" stroke="${ink}" stroke-width="1.6" opacity=".55" fill="none"/></pattern>`,
      `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${c}"/><rect width="3" height="8" fill="${ink}" opacity=".35"/></pattern>`,
      `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${c}"/><rect width="3" height="3" fill="${soft}"/><rect x="3" y="3" width="3" height="3" fill="${soft}"/></pattern>`
    ][kind];
    // зигзаг по периметру
    const t = 4, step = 6, pts = [];
    for (let x = 0; x <= w; x += step) pts.push([x, (x / step) % 2 ? t : 0]);
    for (let y = step; y <= h; y += step) pts.push([w - ((y / step) % 2 ? t : 0), y]);
    for (let x = w - step; x >= 0; x -= step) pts.push([x, h - ((x / step) % 2 ? t : 0)]);
    for (let y = h - step; y > 0; y -= step) pts.push([(y / step) % 2 ? t : 0, y]);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs>${pat}</defs><polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="url(#${id})"/><polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 2" transform="translate(${w * .04} ${h * .05}) scale(.92 .9)"/></svg>`;
  };

  // Код дня для бармена. В прототипе вычисляется из даты; в рабочей версии бармен получит его в боте.
  const dayCode = d => String(((d.getDate() * 7919 + (d.getMonth() + 1) * 104729 + d.getFullYear()) % 9000) + 1000);
  const KEY = 'manufaktura-book';
  const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const MONTHS_IN = ['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
  let book = { items: {}, months: {} };
  const store = {
    load: cb => {
      const parse = v => { try { const o = JSON.parse(v || '{}'); return o.items ? o : { items: {}, months: {} }; } catch { return { items: {}, months: {} }; } };
      if (inTg && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) tg.CloudStorage.getItem(KEY, (err, v) => cb(parse(v)));
      else { let v = null; try { v = localStorage.getItem(KEY); } catch {} cb(parse(v)); }
    },
    save: v => {
      const s = JSON.stringify(v);
      if (inTg && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) tg.CloudStorage.setItem(KEY, s);
      else { try { localStorage.setItem(KEY, s); } catch {} }
    }
  };
  const uniq = () => Object.keys(book.items).length;
  const total = () => Object.values(book.items).reduce((a, x) => a + x.n, 0);
  const rankOf = n => [...RANKS].reverse().find(r => n >= r.at);
  const shots = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'рюмка' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'рюмки' : 'рюмок'}`;
  let justSewn = null;
  function renderBook() {
    const u = uniq(), r = rankOf(u), next = RANKS.find(x => x.at > u), mon = book.months[monthKey(now)] || 0;
    $('#rank').innerHTML = `<p class="lbl">Ваше звание</p><p class="title">${r.t}</p>
      <p class="next">${next ? `До звания «${next.t.toLowerCase()}» — ${next.at - u} ${next.at - u === 1 ? 'образец' : next.at - u < 5 ? 'образца' : 'образцов'}` : 'Вся книга собрана. Как сам А. Г. Морозов.'}</p>
      <div class="ladder">${RANKS.slice(1).map(x => `<i class="${u >= x.at ? 'on' : ''}"></i>`).join('')}</div>
      <div class="stats"><div><b>${u}/${tinct.length}</b><span>образцов</span></div><button type="button" class="st-btn" id="hist"><b>${total()}</b><span>рюмок всего ›</span></button><div><b>${mon}</b><span>в ${MONTHS_IN[now.getMonth()]}</span></div></div>
      <button class="share" type="button" id="share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>Сделать сторис</button>`;
    $('#pages').innerHTML = cats.map(c => {
      const n = c.items.filter(t => book.items[t.n]).length;
      return `<div class="page${n === c.items.length ? ' full' : ''}"><div class="page-h"><b>${esc(c.title)}</b><span>${n} из ${c.items.length}</span></div>
        <div class="sw-grid">${c.items.map(t => { const it = book.items[t.n];
          return `<button type="button" class="sw${it ? ' has' : ''}${justSewn === t.n ? ' new' : ''}" data-n="${esc(t.n)}" aria-label="${esc(t.n)}${it ? `, рюмок: ${it.n}` : ', образца пока нет'}">
            <span class="slot">${it ? swatchSVG(t.n) : `<em>№${pad(tinct.indexOf(t) + 1)}</em>`}</span>
            <span class="n">${esc(t.n)}</span>${it ? `<span class="cnt">${shots(it.n)}</span>` : ''}</button>`; }).join('')}</div></div>`;
    }).join('');
    justSewn = null;
    $('#share').onclick = () => { haptic('tap'); openStory(); };
    $('#hist').onclick = () => { haptic('tap'); openHistory(); };
  }

  /* ---------- Рюмки по месяцам ---------- */
  const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const yearTotal = () => Object.entries(book.months).filter(([k]) => k.startsWith(String(now.getFullYear()))).reduce((a, [, v]) => a + v, 0);
  function openHistory() {
    const rows = [2, 1, 0].map(k => { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); return { name: MONTHS_NOM[d.getMonth()], n: book.months[monthKey(d)] || 0 }; });
    const max = Math.max(1, ...rows.map(r => r.n));
    openSheet(`<h3 id="shTitle">Рюмки по месяцам</h3>
      <ul class="hist">${rows.map(r => `<li><span>${r.name}</span><i style="--w:${Math.round(r.n / max * 100)}%"></i><b>${r.n}</b></li>`).join('')}</ul>
      <p class="hint">За ${now.getFullYear()} год: ${shots(yearTotal())}. Всего: ${shots(total())}.</p>`);
  }

  /* ---------- Сторис ---------- */
  const W = 1080, H = 1920;
  let storyPhoto = null;
  const storyOpts = { rank: true, swatches: true, month: true, year: false };
  const logoImg = new Image(); logoImg.src = 'img/logo-round.png';
  // Узор ткани на холсте (те же 6 переплетений, что и в книге).
  function drawSwatch(ctx, x, y, w, h, name) {
    const i = tinct.findIndex(t => t.n === name), c = COLORS[name], dark = lum(c) < .45;
    const ink = dark ? mix(c, 255, .38) : mix(c, 0, .28), soft = dark ? mix(c, 255, .18) : mix(c, 0, .12);
    const k = Math.max(1, w / 120), tile = document.createElement('canvas'), sz = [12, 16, 14, 12, 8, 6][i % 6] * k;
    tile.width = tile.height = Math.ceil(sz); const t = tile.getContext('2d');
    t.fillStyle = c; t.fillRect(0, 0, sz, sz); t.fillStyle = ink; t.strokeStyle = ink;
    switch (i % 6) {
      case 0: t.globalAlpha = .55; t.fillRect(0, 0, 4 * k, sz); t.globalAlpha = .4; t.fillRect(7 * k, 0, 1.5 * k, sz); break;
      case 1: t.globalAlpha = .3; t.fillRect(0, 0, sz / 2, sz); t.fillRect(0, 0, sz, sz / 2); break;
      case 2: t.globalAlpha = .7; [[3.5, 3.5], [10.5, 10.5]].forEach(([a, b]) => { t.beginPath(); t.arc(a * k, b * k, 2.2 * k, 0, 7); t.fill(); }); break;
      case 3: t.globalAlpha = .55; t.lineWidth = 1.6 * k; t.beginPath(); t.moveTo(0, sz); t.lineTo(sz / 2, 0); t.lineTo(sz, sz); t.stroke(); break;
      case 4: t.globalAlpha = .35; t.beginPath(); t.moveTo(0, 0); t.lineTo(sz * .4, 0); t.lineTo(sz, sz * .6); t.lineTo(sz, sz); t.lineTo(sz * .6, sz); t.lineTo(0, sz * .4); t.closePath(); t.fill(); break;
      case 5: t.fillStyle = soft; t.fillRect(0, 0, sz / 2, sz / 2); t.fillRect(sz / 2, sz / 2, sz / 2, sz / 2); break;
    }
    const tooth = 4 * k, step = 6 * k; ctx.save(); ctx.beginPath();
    let n = 0; for (let px = 0; px <= w; px += step, n++) ctx.lineTo(x + px, y + (n % 2 ? tooth : 0));
    n = 1; for (let py = step; py <= h; py += step, n++) ctx.lineTo(x + w - (n % 2 ? tooth : 0), y + py);
    n = 1; for (let px = w - step; px >= 0; px -= step, n++) ctx.lineTo(x + px, y + h - (n % 2 ? tooth : 0));
    n = 1; for (let py = h - step; py > 0; py -= step, n++) ctx.lineTo(x + (n % 2 ? tooth : 0), y + py);
    ctx.closePath(); ctx.shadowColor = 'rgba(30,8,10,.35)'; ctx.shadowOffsetY = 4 * k; ctx.shadowBlur = 8 * k;
    ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.translate(x, y); ctx.fill(); ctx.restore();
  }
  const fit = (ctx, text, max, size, weight = 800) => { let f = size; do { ctx.font = `${weight} ${f}px "Roboto Condensed", "Arial Narrow", sans-serif`; f -= 4; } while (ctx.measureText(text).width > max && f > 30); };
  async function drawStory(cv) {
    try { await Promise.all([document.fonts.load('800 100px "Roboto Condensed"'), document.fonts.load('400 40px "Golos Text"')]); } catch {}
    if (!logoImg.complete) await new Promise(r => { logoImg.onload = logoImg.onerror = r; });
    cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), cream = '#f6eee4', cream2 = '#e3cfc6';
    ctx.fillStyle = '#8e2f34'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(246,238,228,.35)'; ctx.lineWidth = 3; ctx.strokeRect(48, 48, W - 96, H - 96);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const u = uniq(), r = rankOf(u), user = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    // блоки и их высоты, чтобы всё влезло
    const lines = [];
    if (storyOpts.month) lines.push(`${shots(book.months[monthKey(now)] || 0)} в ${MONTHS_IN[now.getMonth()]}`);
    if (storyOpts.year) lines.push(`${shots(yearTotal())} за ${now.getFullYear()} год`);
    // раскладка: считаем высоты блоков и ужимаем фото, потом сетку, пока всё не влезет над подписью бара
    const hasName = !!(user && user.first_name), lw0 = storyPhoto ? 170 : 230;
    const lh = logoImg.naturalWidth ? lw0 * logoImg.naturalHeight / logoImg.naturalWidth : 200;
    let pr = storyPhoto ? 250 : 0, gs = 1;
    const gridHeight = k => storyOpts.swatches ? (4 * 112 + 3 * 22) * k + 10 + 70 + 30 : 0;
    const need = () => lh + 50 + (storyPhoto ? 2 * pr + 70 : 0) + (hasName ? 80 : 0) + (storyOpts.rank ? 150 : 0) + gridHeight(gs) + lines.length * 76;
    const avail = H - 120 - 250;
    while (need() > avail && gs > .72) gs -= .02;
    while (need() > avail && pr > 140) pr -= 10;
    while (need() > avail && gs > .55) gs -= .02;
    // если места много — центрируем по вертикали
    let y = 120 + Math.max(0, (avail - need()) / 2);
    if (logoImg.naturalWidth) ctx.drawImage(logoImg, (W - lw0) / 2, y, lw0, lh); y += lh + 50;
    if (storyPhoto) {
      const cx = W / 2, cy = y + pr;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 7); ctx.clip();
      const sc = Math.max(2 * pr / storyPhoto.width, 2 * pr / storyPhoto.height);
      ctx.drawImage(storyPhoto, cx - storyPhoto.width * sc / 2, cy - storyPhoto.height * sc / 2, storyPhoto.width * sc, storyPhoto.height * sc); ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, pr + 8, 0, 7); ctx.strokeStyle = cream; ctx.lineWidth = 10; ctx.stroke();
      y = cy + pr + 70;
    }
    if (hasName) { ctx.fillStyle = cream2; ctx.font = '700 48px "Roboto Condensed", sans-serif'; ctx.letterSpacing = '6px'; ctx.fillText(user.first_name.toUpperCase(), W / 2, y + 40); ctx.letterSpacing = '0px'; y += 80; }
    if (storyOpts.rank) { ctx.fillStyle = cream; fit(ctx, r.t.toUpperCase(), W - 180, 104); ctx.fillText(r.t.toUpperCase(), W / 2, y + 96); y += 150; }
    if (storyOpts.swatches) {
      const cols = 5, cw = 150 * gs, ch = 112 * gs, gap = 22 * gs, gx = (W - (cols * cw + (cols - 1) * gap)) / 2;
      tinct.forEach((t, i) => {
        const x = gx + (i % cols) * (cw + gap), yy = y + 10 + Math.floor(i / cols) * (ch + gap);
        if (book.items[t.n]) drawSwatch(ctx, x, yy, cw, ch, t.n);
        else { ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(246,238,228,.4)'; ctx.lineWidth = 3; ctx.strokeRect(x + 4, yy + 4, cw - 8, ch - 8); ctx.restore(); }
      });
      y += 4 * ch + 3 * gap + 10 + 70;
      ctx.fillStyle = cream; ctx.font = '700 54px "Roboto Condensed", sans-serif'; ctx.fillText(`${u} из ${tinct.length} образцов`, W / 2, y); y += 30;
    }
    ctx.fillStyle = cream2; ctx.font = '700 50px "Roboto Condensed", sans-serif';
    lines.forEach(l => { y += 76; ctx.fillText(l, W / 2, y); });
    ctx.fillStyle = cream; ctx.font = '800 42px "Roboto Condensed", sans-serif'; ctx.letterSpacing = '10px'; ctx.fillText('МАНУФАКТУРА', W / 2, H - 160); ctx.letterSpacing = '0px';
    ctx.fillStyle = cream2; ctx.font = '400 34px "Golos Text", sans-serif'; ctx.fillText(`бар-кухня · ${B.address}`, W / 2, H - 108);
  }
  function openStory() {
    const opt = (k, label) => `<label class="tgl"><input type="checkbox" data-k="${k}" ${storyOpts[k] ? 'checked' : ''}><span>${label}</span></label>`;
    openSheet(`<h3 id="shTitle">Сторис</h3>
      <div class="story"><canvas id="cv" aria-label="Превью сторис"></canvas>
        <div class="story-side">
          <label class="btn ghost photo-btn">${storyPhoto ? 'Сменить фото' : 'Загрузить фото из бара'}<input type="file" accept="image/*" id="photoIn" hidden></label>
          ${storyPhoto ? '<button class="link" type="button" id="noPhoto">Убрать фото</button>' : ''}
          <div class="tgls">${opt('rank', 'Звание')}${opt('swatches', 'Образцы')}${opt('month', 'Рюмки за месяц')}${opt('year', 'Рюмки за год')}</div>
        </div></div>
      <button class="btn" type="button" id="saveStory">Сохранить картинку</button>
      <p class="hint">Сохраните и выложите в сторис Instagram или Telegram с отметкой бара.</p>`, () => {
      const cv = $('#cv'); drawStory(cv);
      sheetBody.querySelectorAll('.tgl input').forEach(i => i.onchange = () => { storyOpts[i.dataset.k] = i.checked; drawStory(cv); haptic('tap'); });
      $('#photoIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { storyPhoto = img; openStory(); }; img.src = URL.createObjectURL(f); };
      const np = $('#noPhoto'); if (np) np.onclick = () => { storyPhoto = null; openStory(); };
      $('#saveStory').onclick = async () => {
        const url = cv.toDataURL('image/png'); haptic('success');
        // На телефоне: системное «Поделиться» с файлом, если есть; иначе картинка на весь экран — долгое нажатие → сохранить.
        try {
          const blob = await (await fetch(url)).blob(), file = new File([blob], 'manufaktura-story.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
        } catch (err) { if (err && err.name === 'AbortError') return; }
        const v = $('#viewer'); v.querySelector('img').src = url; v.querySelector('a').href = url; v.hidden = false;
      };
    });
  }
  $('#viewer').onclick = e => { if (e.target.closest('a')) return; $('#viewer').hidden = true; };
  $('#wedRule').textContent = isWed ? `Сегодня среда: все настойки по ${T.wednesday} ₽.` : `По средам все настойки по ${T.wednesday} ₽ вместо ${T.price}.`;
  $('#demoCode').textContent = `Демо: код дня для бармена ${dayCode(now)}. В рабочей версии бармен получает его в боте.`;
  $('#pages').onclick = e => {
    const b = e.target.closest('.sw'); if (!b) return; const c = tinct.find(t => t.n === b.dataset.n), it = book.items[c.n];
    haptic('tap');
    openSheet(`${it ? `<div class="sw-big">${swatchSVG(c.n, 160, 90)}</div>` : ''}<h3 id="shTitle">${esc(c.n)}</h3>
      <p class="ds">${esc(c.g)} · ${esc(c.d)} · 50 мл · ${isWed ? T.wednesday : T.price} ₽</p>
      ${it ? `<p class="hint">Образец «${WEAVES[tinct.indexOf(c) % 6]}» вшит ${esc(it.first)}. Выпито: ${shots(it.n)}.</p>` : ''}
      <form id="codeForm" novalidate><div class="code"><input id="code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="····" aria-label="Код бармена"></div>
      <p class="err" id="codeErr">Код не подошёл. Попросите бармена ввести его ещё раз.</p>
      <p class="hint">Передайте телефон бармену: он введёт код дня, когда нальёт настойку.</p>
      <button class="btn" type="submit">${it ? 'Ещё рюмка' : 'Вшить образец'}</button></form>`, () => {
      const inp = $('#code');
      inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); inp.removeAttribute('aria-invalid'); $('#codeErr').classList.remove('on'); };
      $('#codeForm').onsubmit = ev => {
        ev.preventDefault();
        if (inp.value !== dayCode(now)) { inp.setAttribute('aria-invalid', 'true'); $('#codeErr').classList.add('on'); haptic('error'); return; }
        const was = book.items[c.n], before = rankOf(uniq()).t;
        book.items[c.n] = was ? { ...was, n: was.n + 1 } : { first: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`, n: 1 };
        const mk = monthKey(now); book.months[mk] = (book.months[mk] || 0) + 1;
        store.save(book); if (!was) justSewn = c.n;
        closeSheet(); renderBook(); haptic('success');
        if (rankOf(uniq()).t !== before) setTimeout(() => { toast(`Новое звание: ${rankOf(uniq()).t.toLowerCase()}!`); scrollTo({ top: 0, behavior: 'smooth' }); }, 300);
      };
    });
  };
  store.load(v => { book = v; renderBook(); });

  /* ---------- Бронь ---------- */
  const user = inTg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (user && user.first_name) $('#fName').value = user.first_name;
  const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const days = [...Array(7)].map((_, i) => { const d = new Date(night); d.setDate(night.getDate() + i); return d; });
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let selDate = days[0];
  const maxD = new Date(night); maxD.setDate(night.getDate() + 90);
  const MONTHS_N = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const chev = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  let calMonth = null;
  const otherChip = () => $('#days [data-i="other"]');
  function openCal() {
    calMonth = calMonth || new Date(selDate.getFullYear(), selDate.getMonth(), 1);
    const draw = () => {
      const y = calMonth.getFullYear(), m = calMonth.getMonth();
      const first = (new Date(y, m, 1).getDay() + 6) % 7, nDays = new Date(y, m + 1, 0).getDate();
      const minM = new Date(night.getFullYear(), night.getMonth(), 1), maxM = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
      let g = '<span></span>'.repeat(first);
      for (let d = 1; d <= nDays; d++) {
        const dt = new Date(y, m, d, 12), k = iso(dt), dw = dt.getDay();
        const off = k < iso(night) || k > iso(maxD);
        g += `<button type="button" data-d="${k}" class="${k === iso(night) ? 'today' : ''}${dw === 5 || dw === 6 ? ' wknd' : ''}" aria-pressed="${k === iso(selDate)}" ${off ? 'disabled' : ''} aria-label="${d} ${MONTHS[m]}">${d}</button>`;
      }
      sheetBody.innerHTML = `<div class="cal-h"><button class="cal-nav" type="button" id="calPrev" aria-label="Предыдущий месяц" ${calMonth <= minM ? 'disabled' : ''}>${chev('M15 5l-7 7 7 7')}</button>
        <b id="shTitle">${MONTHS_N[m]} ${y}</b><button class="cal-nav" type="button" id="calNext" aria-label="Следующий месяц" ${calMonth >= maxM ? 'disabled' : ''}>${chev('M9 5l7 7-7 7')}</button></div>
        <div class="cal-w">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w => `<span>${w}</span>`).join('')}</div><div class="cal-g" id="calG">${g}</div>
        <p class="hint">Бронь до ${maxD.getDate()} ${MONTHS[maxD.getMonth()]}. Пятница и суббота — до 05:00.</p>`;
      $('#calPrev').onclick = () => { calMonth = new Date(y, m - 1, 1); draw(); haptic('tap'); };
      $('#calNext').onclick = () => { calMonth = new Date(y, m + 1, 1); draw(); haptic('tap'); };
      $('#calG').onclick = e => { const b = e.target.closest('button[data-d]'); if (!b || b.disabled) return;
        selDate = new Date(b.dataset.d + 'T12:00');
        const i = days.findIndex(x => iso(x) === b.dataset.d);
        $('#days').querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', i >= 0 ? x.dataset.i === String(i) : x === otherChip()));
        otherChip().textContent = i >= 0 ? 'Другая дата' : `${selDate.getDate()} ${MONTHS[selDate.getMonth()]}`;
        fill(); haptic('success'); closeSheet(); setTimeout(() => (i >= 0 ? $(`#days [data-i="${i}"]`) : otherChip()).scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }), 200); };
    };
    openSheet('', draw);
  }
  $('#days').innerHTML = days.map((d, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-i="${i}">${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : `${DAYS_SHORT[d.getDay()]}, ${d.getDate()}`}</button>`).join('') +
    `<button type="button" class="chip" aria-pressed="false" data-i="other">Другая дата</button>`;
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; haptic('tap');
    if (b.dataset.i !== 'other') $('#days').querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (b.dataset.i === 'other') { openCal(); return; }
    selDate = days[+b.dataset.i]; otherChip().textContent = 'Другая дата'; calMonth = null;
    fill(); };
  const isToday = () => iso(selDate) === iso(night);
  const fTime = $('#fTime');
  function fill() {
    const last = (closeHour(selDate.getDay()) + 23) * 60; let st = 17 * 60;
    if (isToday()) { const m = (now.getHours() < 5 ? now.getHours() + 24 : now.getHours()) * 60 + now.getMinutes(); st = Math.max(st, Math.ceil((m + 30) / 30) * 30); }
    const o = []; for (let m = st; m <= last; m += 30) o.push(`${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`);
    fTime.innerHTML = o.length ? o.map(t => `<option>${t}</option>`).join('') : '<option value="">На сегодня уже поздно</option>';
    if (o.includes('20:00')) fTime.value = '20:00';
  }
  fill();
  let guests = 2; const gO = $('#gO'), gM = $('#gM'), gP = $('#gP');
  const setG = n => { guests = Math.max(1, Math.min(20, n)); gO.textContent = guests; gM.disabled = guests <= 1; gP.disabled = guests >= 20; };
  gM.onclick = () => { setG(guests - 1); haptic('tap'); }; gP.onclick = () => { setG(guests + 1); haptic('tap'); }; setG(2);
  const fPhone = $('#fPhone');
  fPhone.oninput = () => {
    let d = fPhone.value.replace(/\D/g, ''); if (d[0] === '8') d = '7' + d.slice(1); if (d && d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    fPhone.value = d ? '+7' + (p[0] ? ' ' + p[0] : '') + (p[1] ? ' ' + p[1] : '') + (p[2] ? '-' + p[2] : '') + (p[3] ? '-' + p[3] : '') : '';
  };
  const check = (inp, err, ok) => { inp.setAttribute('aria-invalid', !ok); $(err).classList.toggle('on', !ok); return ok; };
  $('#form').onsubmit = async e => {
    e.preventDefault();
    const okN = check($('#fName'), '#eName', $('#fName').value.trim().length > 1);
    const okP = check(fPhone, '#ePhone', fPhone.value.replace(/\D/g, '').length === 11);
    if (!okN) { haptic('error'); return $('#fName').focus(); } if (!okP) { haptic('error'); return fPhone.focus(); } if (!fTime.value) return fTime.focus();
    const d = selDate, btn = $('#send'); btn.disabled = true; btn.textContent = 'Отправляем…';
    const payload = { name: $('#fName').value.trim(), phone: fPhone.value, date: iso(d), time: fTime.value, guests, note: $('#fNote').value.trim(), tg_user: user ? user.id : null };
    let sent = false;
    if (B.webhookUrl) { try { sent = (await fetch(B.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).ok; } catch {} }
    else await new Promise(r => setTimeout(r, 600));
    btn.disabled = false; btn.textContent = 'Отправить заявку';
    if (B.webhookUrl && !sent) { haptic('error'); alert('Не получилось отправить. Позвоните: ' + B.phone); return; }
    $('#okText').textContent = `${payload.name}, ждём вас ${isToday() ? 'сегодня' : iso(d) === iso(days[1]) ? 'завтра' : `${d.getDate()} ${MONTHS[d.getMonth()]}`} в ${payload.time}, гостей: ${guests}. Администратор перезвонит, чтобы подтвердить.`;
    const ph = $('#okPhone'); ph.href = 'tel:' + B.phoneRaw; ph.textContent = B.phone;
    $('#form').hidden = true; $('#ok').hidden = false; haptic('success');
  };
  $('#again').onclick = () => { $('#ok').hidden = true; $('#form').hidden = false; $('#form').reset(); if (user && user.first_name) $('#fName').value = user.first_name; selDate = days[0]; calMonth = null; otherChip().textContent = 'Другая дата'; $('#days').querySelectorAll('.chip').forEach((x, i) => x.setAttribute('aria-pressed', i === 0)); setG(2); fill(); };

  /* ---------- О баре ---------- */
  $('#motto').textContent = `${B.motto}. ${B.about}.`;
  const ICON = {
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 12.5h3.5l3 2.5h3.5a1.5 1.5 0 0 1 0 3H9.5M7.5 12.5V20M4 20h3.5"/><path d="m14.5 16 4.6-2.2a1.5 1.5 0 0 1 1.4 2.6L13.5 20H7.5"/><circle cx="15" cy="6.5" r="3"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/></svg>'
  };
  const linkAct = (url, icon, label, demo) => `<a class="act" ${url ? `href="${esc(url)}" target="_blank" rel="noopener"` : `href="#" data-demo="${esc(demo)}"`}>${icon}${label}</a>`;
  const acts = withBingo => `<div class="acts">
      ${withBingo ? `<button class="act" type="button" data-go="bingo">${ICON.grid}Бинго</button>` : linkAct(B.review2gis, ICON.pin, 'Отзыв в 2ГИС', 'Ссылку на отзыв в 2ГИС добавим, когда её даст бар')}
      ${linkAct(B.reviewYandex, ICON.star, withBingo ? 'Отзыв' : 'Яндекс Карты', 'Ссылку на отзыв в Яндекс Картах добавим, когда её даст бар')}
      ${linkAct(B.tips, ICON.tip, 'Чаевые', 'Ссылку на чаевые команде добавим, когда бар подключит сервис')}</div>`;
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-demo]'); if (d) { e.preventDefault(); toast('Демо: ' + d.dataset.demo + '.'); return; }
    const g = e.target.closest('.acts [data-go]'); if (g) show(g.dataset.go);
  });
  $('#history').innerHTML = `<h3>Дом 1873 года</h3>
    <p>Здание на бывшей Большой Тобольской улице построено в 1873 году как каменная лавка «Мануфактурные товары» купца первой гильдии Андрея Григорьевича Морозова. Его торговый дом «Морозов с сыновьями» держал восемь лавок, а в 1914 году был первым в уезде по обороту.</p>
    <p>Мануфактурой тогда называли ткани. Отсюда и наше имя, и книга образцов в этом приложении.</p>
    <p class="src">Источник: <a href="https://www.amic.ru/news/nedvizhimost/bank-uehal-v-barnaule-za-13-mln-prodayut-odnu-iz-krasiveyshih-usadeb-konca-xix-veka" target="_blank" rel="noopener">amic.ru, 2022</a></p>`;
  $('#aboutActs').innerHTML = `<div class="guest"><h3>Были у нас?</h3><p>Оставьте отзыв или поблагодарите команду бара.</p>${acts(false)}</div>`;
  $('#info').innerHTML = `
    <div><dt>Адрес</dt><dd>${esc(B.address)}<span>${esc(B.building)}</span></dd></div>
    <a href="tel:${B.phoneRaw}"><dt>Телефон</dt><dd>${esc(B.phone)}</dd></a>
    <div><dt>Часы</dt><dd>${B.hours.map(h => `${h.days} ${h.time}`).join('<br>')}</dd></div>`;
  const tl = $('#tgLink'); tl.href = B.telegram;
  if (inTg) tl.onclick = e => { e.preventDefault(); tg.openTelegramLink(B.telegram); };
})();
