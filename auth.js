// مِشكاة — نظام الحسابات والإحصائيات (متوافق مع جميع المتصفحات)
var config = window.SUPABASE_CONFIG || {};
var supabase = window.supabase;
var currentUser = null;
var isAdmin = false;
var configured = !!(config.url && config.anonKey);

function initAuth() {
  if (!configured || typeof window.supabase === 'undefined') return;
  supabase = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  supabase.auth.getSession().then(function (r) {
    if (r.data && r.data.session) onAuthed(r.data.session.user);
    else onSignedOut();
  });
  supabase.auth.onAuthStateChange(function (event, session) {
    if (session) onAuthed(session.user);
    else onSignedOut();
  });
}

function onSignedOut() {
  currentUser = null;
  isAdmin = false;
  var chip = document.getElementById('userChip');
  if (chip) chip.innerHTML = configured
    ? '<button class="nav-login" onclick="openAuthModal()">دخول / حساب جديد</button>'
    : '';
  var adminLink = document.getElementById('statsLink');
  if (adminLink) adminLink.style.display = 'none';
  if (window.location.pathname.indexOf('stats.html') !== -1) renderStatsGuard();
}

function chipHTML(user, avatarUrl) {
  var name = (user.email || 'مستخدم').split('@')[0];
  var av = avatarUrl
    ? '<img class="chip-avatar" src="' + avatarUrl + '" alt="">'
    : '<span class="chip-avatar ph">' + name.charAt(0).toUpperCase() + '</span>';
  return '<span class="chip-user">' + av + name + '</span>' +
    '<button class="chip-logout" onclick="signOut()">خروج</button>';
}

function onAuthed(user) {
  currentUser = user;
  var chip = document.getElementById('userChip');
  if (chip) chip.innerHTML = chipHTML(user, null);
  loadProfileAndFinish(user);
}

function loadProfileAndFinish(user) {
  supabase.from('profiles').select('is_admin, avatar_url').eq('id', user.id).single()
    .then(function (res) {
      isAdmin = !!(res.data && res.data.is_admin);
      var av = res.data && res.data.avatar_url ? res.data.avatar_url : null;
      var chip = document.getElementById('userChip');
      if (chip) chip.innerHTML = chipHTML(user, av);
      var adminLink = document.getElementById('statsLink');
      if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';
    })
    .catch(function () {
      isAdmin = false;
      var adminLink = document.getElementById('statsLink');
      if (adminLink) adminLink.style.display = 'none';
    })
    .then(function () {
      uploadPendingAvatar(user.id);
      pingLastSeen();
      if (window.location.pathname.indexOf('stats.html') !== -1 && typeof initStats === 'function') initStats();
    });
}

function openAuthModal() {
  var msg = '';
  if (!configured) msg = 'نظام الحسابات لم يُفعَّل بعد على هذا الموقع.';
  else if (!supabase) msg = 'تعذر تشغيل خدمة الحسابات هذه المرة — أعد فتح الصفحة.';
  if (msg) {
    var el = document.getElementById('loginMsg');
    if (el) { el.style.color = '#E8836E'; el.textContent = msg; }
    document.getElementById('authModal').classList.remove('hidden');
    switchTab('login');
    return;
  }
  document.getElementById('authModal').classList.remove('hidden');
  switchTab('login');
}
function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}
function switchTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}

function authMsg(id, text, ok) {
  var el = document.getElementById(id);
  el.textContent = text;
  el.style.color = ok ? 'var(--gold-bright)' : '#E8836E';
}

function doLogin(e) {
  e.preventDefault();
  var email = document.getElementById('loginEmail').value.trim();
  var pass = document.getElementById('loginPass').value;
  var btn = e.target.querySelector('button');
  btn.disabled = true;
  supabase.auth.signInWithPassword({ email: email, password: pass })
    .then(function (r) {
      btn.disabled = false;
      if (r.error) {
        var msg = r.error.message;
        if (msg.indexOf('Invalid login') !== -1) msg = 'البريد أو كلمة المرور غير صحيحة';
        else if (msg.indexOf('Email not confirmed') !== -1) msg = 'أكّد بريدك أولاً عبر الرابط الذي أرسلناه لك';
        else msg = 'تعذر الدخول: ' + msg;
        authMsg('loginMsg', msg, false);
        return;
      }
      closeAuthModal();
    })
    .catch(function () {
      btn.disabled = false;
      authMsg('loginMsg', 'تعذر الاتصال بالخادم — تحقق من الإنترنت', false);
    });
}

function doSignup(e) {
  e.preventDefault();
  var email = document.getElementById('signupEmail').value.trim();
  var pass = document.getElementById('signupPass').value;
  if (pass.length < 6) { authMsg('signupMsg', 'كلمة المرور 6 أحرف على الأقل', false); return; }
  var btn = e.target.querySelector('button');
  btn.disabled = true;
  supabase.auth.signUp({
    email: email,
    password: pass,
    options: { emailRedirectTo: config.redirectUrl }
  })
    .then(function (r) {
      btn.disabled = false;
      if (r.error) {
        var msg = r.error.message;
        if (msg.indexOf('already registered') !== -1) msg = 'هذا البريد مسجّل بالفعل — استخدم تبويب تسجيل الدخول';
        else msg = 'تعذر إنشاء الحساب: ' + msg;
        authMsg('signupMsg', msg, false);
        return;
      }
      authMsg('signupMsg', 'تم إنشاء حسابك! تحقق من بريدك للتفعيل، ثم سجّل دخولك وستُضاف صورتك تلقائياً.', true);
    })
    .catch(function () {
      btn.disabled = false;
      authMsg('signupMsg', 'تعذر الاتصال بالخادم — تحقق من الإنترنت', false);
    });
}

function googleLogin() {
  var msg = document.getElementById('loginMsg');
  if (!supabase) { msg.style.color = '#E8836E'; msg.textContent = 'تعذر تشغيل خدمة الحسابات.'; return; }
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: config.redirectUrl }
  }).then(function (r) {
    if (r.error) {
      msg.style.color = '#E8836E';
      msg.textContent = 'دخول جوجل غير مفعّل بعد على النظام. سجّل ببريدك وكلمة المرور.';
    }
  }).catch(function () {
    msg.style.color = '#E8836E';
    msg.textContent = 'تعذر بدء دخول جوجل. سجّل ببريدك وكلمة المرور.';
  });
}

function signOut() {
  if (supabase) {
    supabase.auth.signOut().then(function () { onSignedOut(); });
  } else {
    onSignedOut();
  }
}

// ===== صورة الحساب =====
function pickAvatar(file) {
  if (!file) return;
  var img = new Image();
  img.onload = function () {
    var size = 256;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    var s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    try { localStorage.setItem('mishkat_pending_avatar', dataUrl); } catch (err) {}
    var prev = document.getElementById('avatarPreview');
    if (prev) { prev.style.backgroundImage = 'url(' + dataUrl + ')'; prev.textContent = ''; }
  };
  img.src = URL.createObjectURL(file);
}

function dataURLtoBlob(dataUrl) {
  var arr = dataUrl.split(',');
  var mime = arr[0].match(/:(.*?);/)[1];
  var bstr = atob(arr[1]);
  var u8 = new Uint8Array(bstr.length);
  for (var i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

function uploadPendingAvatar(uid) {
  var pending = null;
  try { pending = localStorage.getItem('mishkat_pending_avatar'); } catch (err) {}
  if (!pending || !supabase) return;
  try { localStorage.removeItem('mishkat_pending_avatar'); } catch (err) {}
  supabase.storage.from('avatars').upload(uid + '/avatar.jpg', dataURLtoBlob(pending), {
    upsert: true, contentType: 'image/jpeg'
  }).then(function () {
    var pub = supabase.storage.from('avatars').getPublicUrl(uid + '/avatar.jpg');
    var url = pub.data ? pub.data.publicUrl : null;
    if (!url) return;
    supabase.from('profiles').update({ avatar_url: url }).eq('id', uid).then(function () {
      loadProfileAndFinish(currentUser);
    });
  }).catch(function () {});
}

// تتبع الضغطة على زر التحميل
function trackDownload() {
  if (!supabase) return;
  supabase.from('downloads').insert({ user_id: currentUser ? currentUser.id : null }).then(function () {});
}

// تحديث "آخر ظهور"
function pingLastSeen() {
  if (!supabase || !currentUser) return;
  var seen = null;
  try { seen = localStorage.getItem('mishkat_last_seen_ping'); } catch (err) {}
  var now = Date.now();
  if (seen && now - Number(seen) < 5 * 60 * 1000) return;
  try { localStorage.setItem('mishkat_last_seen_ping', String(now)); } catch (err) {}
  supabase.from('profiles').update({ last_seen_at: new Date().toISOString() })
    .eq('id', currentUser.id).then(function () {});
}
