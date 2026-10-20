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

  /* ---------- Бинго ---------- */
  const COLORS = { 'Бузина-цитрус':'#e8d37a','Гранат-персик':'#d4515a','Алоэ-киви':'#9cc06a','Яблоко-щавель':'#b9cd73','Фейхоа-лайм':'#86ad61','Вишня':'#7c1a2a','Хреновуха':'#e6dcb8','Томатная':'#d4472f','Лимончелло':'#f0cc45','Облепиха':'#ee8a24','Клюковка':'#b51f3a','Персик-личи-конопля':'#f1b083','Клубника-гречка':'#c64a58','Банан-куркума':'#efc244','Малина-пломбир':'#eda0b2','Кассис':'#4b1a3a','Порно шот':'#f2b45a','Джин на малине':'#d4567a','Черноплодный негрони':'#3b1422' };
  const tinct = []; T.groups.forEach(g => g.items.forEach(([n, d]) => tinct.push({ n, d, g: g.title })));
  const cats = T.groups.map(g => ({ title: g.title, items: tinct.filter(t => t.g === g.title) }));
  // Код дня для бармена. В прототипе вычисляется из даты; в рабочей версии бармен получит его в боте.
  const dayCode = d => String(((d.getDate() * 7919 + (d.getMonth() + 1) * 104729 + d.getFullYear()) % 9000) + 1000);
  const KEY = 'manufaktura-bingo';
  let marks = {};
  const store = {
    load: cb => {
      if (inTg && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) tg.CloudStorage.getItem(KEY, (err, v) => { try { cb(JSON.parse(v || '{}')); } catch { cb({}); } });
      else { try { cb(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { cb({}); } }
    },
    save: v => {
      const s = JSON.stringify(v);
      if (inTg && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) tg.CloudStorage.setItem(KEY, s);
      else { try { localStorage.setItem(KEY, s); } catch {} }
    }
  };
  const fullCats = () => cats.filter(c => c.items.every(t => marks[t.n]));
  function renderBingo() {
    $('#grid').innerHTML = cats.map(c => {
      const n = c.items.filter(t => marks[t.n]).length, cols = c.items.length <= 4 ? c.items.length : Math.ceil(c.items.length / 2);
      return `<div class="cat${n === c.items.length ? ' full' : ''}"><div class="cat-h"><b>${esc(c.title)}</b><span>${n === c.items.length ? 'Закрыто!' : `${n} из ${c.items.length}`}</span></div>
        <div class="cells" style="grid-template-columns:repeat(${cols},1fr)">${c.items.map(t => `<button type="button" class="cell${marks[t.n] ? ' done' : ''}" data-n="${esc(t.n)}" aria-label="${esc(t.n)}${marks[t.n] ? ', отмечено ' + marks[t.n] : ''}">
          <span class="no">${pad(tinct.indexOf(t) + 1)}</span><span class="dot" style="background:${COLORS[t.n]}"></span>
          <span class="cn">${esc(t.n)}</span><span class="stamp"><i>${marks[t.n] ? `проб.<br>${esc(marks[t.n])}` : ''}</i></span></button>`).join('')}</div></div>`;
    }).join('');
    const n = Object.keys(marks).length, done = fullCats();
    $('#pFill').style.width = (n / tinct.length * 100) + '%';
    $('#pText').textContent = `${n} из ${tinct.length}`;
    const w = $('#wins');
    if (n === tinct.length) { w.hidden = false; w.innerHTML = `<h3>Вся карточка!</h3><p>Покажите экран бармену: приз и ваше имя на доске Мануфактуры.</p>`; }
    else if (done.length) { w.hidden = false; w.innerHTML = `<h3>Закрыто: ${done.map(c => c.title.toLowerCase()).join(', ')}</h3><p>Покажите экран бармену, чтобы получить шот.</p>`; }
    else if (n) {
      const best = cats.map(c => ({ c, left: c.items.filter(t => !marks[t.n]).length })).sort((x, y) => x.left - y.left)[0];
      w.hidden = false; w.innerHTML = `<h3>До подарка: ${best.left}</h3><p>Ближе всего группа «${esc(best.c.title)}».</p>`;
    } else w.hidden = true;
  }
  $('#wedRule').textContent = isWed ? `Сегодня среда: все настойки по ${T.wednesday} ₽ — лучший день, чтобы закрыть группу.` : `По средам все настойки по ${T.wednesday} ₽ вместо ${T.price} — удобный день, чтобы закрыть группу.`;
  $('#demoCode').textContent = `Демо: код дня для бармена ${dayCode(now)}. В рабочей версии бармен получает код в боте, а награды выбирает владелец бара.`;
  $('#grid').onclick = e => {
    const b = e.target.closest('.cell'); if (!b) return; const c = tinct.find(t => t.n === b.dataset.n);
    if (marks[c.n]) {
      openSheet(`<h3 id="shTitle">${esc(c.n)}</h3><p class="ds">${esc(c.d)}</p><p class="hint">Отмечено ${esc(marks[c.n])}.</p><button class="btn ghost" type="button" id="close">Понятно</button>`,
        () => { $('#close').onclick = closeSheet; });
      return;
    }
    haptic('tap');
    openSheet(`<h3 id="shTitle">${esc(c.n)}</h3><p class="ds">${esc(c.g)} · ${esc(c.d)} · 50 мл · ${isWed ? T.wednesday : T.price} ₽</p>
      <form id="codeForm" novalidate><div class="code"><input id="code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="····" aria-label="Код бармена"></div>
      <p class="err" id="codeErr">Код не подошёл. Попросите бармена ввести его ещё раз.</p>
      <p class="hint">Передайте телефон бармену: он введёт код дня, когда нальёт настойку.</p>
      <button class="btn" type="submit">Отметить</button></form>`, () => {
      const inp = $('#code'); setTimeout(() => inp.focus(), 350);
      inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); inp.removeAttribute('aria-invalid'); $('#codeErr').classList.remove('on'); };
      $('#codeForm').onsubmit = ev => {
        ev.preventDefault();
        if (inp.value !== dayCode(now)) { inp.setAttribute('aria-invalid', 'true'); $('#codeErr').classList.add('on'); haptic('error'); return; }
        const before = fullCats().length;
        marks[c.n] = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}`; store.save(marks);
        closeSheet(); renderBingo(); haptic('success');
        if (fullCats().length > before) setTimeout(() => $('#wins').scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
      };
    });
  };
  store.load(v => { marks = v || {}; renderBingo(); });

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
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); };
  const linkAct = (url, icon, label, demo) => `<a class="act" ${url ? `href="${esc(url)}" target="_blank" rel="noopener"` : `href="#" data-demo="${esc(demo)}"`}>${icon}${label}</a>`;
  const acts = withBingo => `<div class="acts">
      ${withBingo ? `<button class="act" type="button" data-go="bingo">${ICON.grid}Бинго</button>` : linkAct(B.review2gis, ICON.pin, 'Отзыв в 2ГИС', 'Ссылку на отзыв в 2ГИС добавим, когда её даст бар')}
      ${linkAct(B.reviewYandex, ICON.star, withBingo ? 'Отзыв' : 'Яндекс Карты', 'Ссылку на отзыв в Яндекс Картах добавим, когда её даст бар')}
      ${linkAct(B.tips, ICON.tip, 'Чаевые', 'Ссылку на чаевые команде добавим, когда бар подключит сервис')}</div>`;
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-demo]'); if (d) { e.preventDefault(); toast('Демо: ' + d.dataset.demo + '.'); return; }
    const g = e.target.closest('.acts [data-go]'); if (g) show(g.dataset.go);
  });
  $('#aboutActs').innerHTML = `<div class="guest"><h3>Были у нас?</h3><p>Оставьте отзыв или поблагодарите команду бара.</p>${acts(false)}</div>`;
  $('#info').innerHTML = `
    <div><dt>Адрес</dt><dd>${esc(B.address)}<span>${esc(B.building)}</span></dd></div>
    <a href="tel:${B.phoneRaw}"><dt>Телефон</dt><dd>${esc(B.phone)}</dd></a>
    <div><dt>Часы</dt><dd>${B.hours.map(h => `${h.days} ${h.time}`).join('<br>')}</dd></div>`;
  const tl = $('#tgLink'); tl.href = B.telegram;
  if (inTg) tl.onclick = e => { e.preventDefault(); tg.openTelegramLink(B.telegram); };
})();
