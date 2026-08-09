// مِشكاة — إحصائيات الموقع (عدّاد التحميلات العام)
var config = window.SUPABASE_CONFIG || {};
var client = (window.supabase && config.url && config.anonKey)
  ? window.supabase.createClient(config.url, config.anonKey)
  : null;
window.mishkatClient = client;

// تسجيل ضغطة زر التحميل في جدول downloads
function trackDownload() {
  if (!client) return;
  client.from('downloads').insert({ user_id: null }).then(function () {});
}
