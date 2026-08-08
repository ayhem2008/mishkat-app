// مِشكاة — نظام الحسابات والإحصائيات
const config = window.SUPABASE_CONFIG || {};
let supabase = null;
let currentUser = null;
let isAdmin = false;
const configured = !!(config.url && config.anonKey);

function initAuth() {
  if (!configured || typeof window.supabase === 'undefined') return;
  supabase = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) onAuthed(data.session.user);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) onAuthed(session.user);
    else onSignedOut();
  });
}

function onSignedOut() {
  currentUser = null;
  isAdmin = false;
  const chip = document.getElementById('userChip');
  if (chip) chip.innerHTML = '<button class="nav-login" onclick="openAuthModal()">دخول / حساب جديد</button>';
  const adminLink = document.getElementById('statsLink');
  if (adminLink) adminLink.style.display = 'none';
  if (window.location.pathname.endsWith('stats.html')) renderStatsGuard();
}

async function onAuthed(user) {
  currentUser = user;
  const chip = document.getElementById('userChip');
  if (chip) {
    const name = (user.email || 'مستخدم').split('@')[0];
    chip.innerHTML =
      '<span class="chip-user" title="' + (user.email || '') + '">' + name +
      '</span><button class="chip-logout" onclick="signOut()">خروج</button>';
  }
  try {
    const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    isAdmin = !!data && !!data.is_admin;
  } catch (e) { isAdmin = false; }
  const adminLink = document.getElementById('statsLink');
  if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';
  pingLastSeen();
  if (window.location.pathname.endsWith('stats.html')) initStats();
}

function openAuthModal() {
  if (!configured) { alert('نظام الحسابات لم يُفعَّل بعد على هذا الموقع.'); return; }
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
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = ok ? 'var(--gold-bright)' : '#E8836E';
}

async function doLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false;
  if (error) {
    authMsg('loginMsg', error.message.includes('Invalid login')
      ? 'البريد أو كلمة المرور غير صحيحة'
      : (error.message.includes('Email not confirmed')
        ? 'أكّد بريدك أولاً عبر الرابط الذي أرسلناه لك'
        : 'تعذر الدخول: ' + error.message), false);
    return;
  }
  closeAuthModal();
}

async function doSignup(e) {
  e.preventDefault();
  const email = document.getElementById('signupEmail').value.trim();
  const pass = document.getElementById('signupPass').value;
  if (pass.length < 6) { authMsg('signupMsg', 'كلمة المرور 6 أحرف على الأقل', false); return; }
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const { error } = await supabase.auth.signUp({ email, password: pass, options: { emailRedirectTo: config.redirectUrl } });
  btn.disabled = false;
  if (error) {
    authMsg('signupMsg', error.message.includes('already registered')
      ? 'هذا البريد مسجّل بالفعل — استخدم تبويب تسجيل الدخول'
      : 'تعذر إنشاء الحساب: ' + error.message, false);
    return;
  }
  authMsg('signupMsg', 'تم إنشاء حسابك! تحقق من بريدك للتفعيل ثم سجّل دخولك.', true);
}

async function googleLogin() {
  const msg = document.getElementById('loginMsg');
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: config.redirectUrl }
    });
    if (error) {
      msg.style.color = '#E8836E';
      msg.textContent = 'دخول جوجل غير مفعّل بعد على النظام. سجّل ببريدك وكلمة المرور.';
    }
  } catch (e) {
    msg.style.color = '#E8836E';
    msg.textContent = 'تعذر بدء دخول جوجل. سجّل ببريدك وكلمة المرور.';
  }
}

async function signOut() {
  if (supabase) await supabase.auth.signOut();
  onSignedOut();
}

// تتبع الضغطة على زر التحميل
function trackDownload() {
  if (!supabase) return;
  supabase.from('downloads').insert({ user_id: currentUser ? currentUser.id : null }).then(() => {});
}

// تحديث "آخر ظهور" — يُعرف به عدد الحسابات النشطة
function pingLastSeen() {
  if (!supabase || !currentUser) return;
  const seen = localStorage.getItem('mishkat_last_seen_ping');
  const now = Date.now();
  if (seen && now - Number(seen) < 5 * 60 * 1000) return;
  localStorage.setItem('mishkat_last_seen_ping', String(now));
  supabase.from('profiles').update({ last_seen_at: new Date().toISOString() })
    .eq('id', currentUser.id).then(() => {});
}
