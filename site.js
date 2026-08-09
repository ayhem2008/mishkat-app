// مِشكاة — إحصائيات الموقع (عدّاد التحميلات العام)
var config = window.SUPABASE_CONFIG || {};
var supabase = window.supabase;

// تسجيل ضغطة زر التحميل في جدول downloads
function trackDownload() {
  if (!supabase) return;
  supabase.from('downloads').insert({ user_id: null }).then(function () {});
}
