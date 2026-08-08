-- ============================================
-- مِشكاة — إعداد قاعدة بيانات الحسابات والإحصائيات
-- ينفَّذ مرة واحدة في: Supabase Dashboard → SQL Editor
-- ============================================

-- 1) جدول الحسابات
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- 2) جدول التحميلات (يُسجَّل عند كل ضغطة على زر التحميل)
create table if not exists public.downloads (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3) إنشاء ملف حساب تلقائياً عند تسجيل مستخدم جديد
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) صلاحيات الوصول
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to anon, authenticated;
grant select, insert on public.downloads to anon, authenticated;

-- 5) الحماية على مستوى الصفوف (RLS)
alter table public.profiles enable row level security;
alter table public.downloads enable row level security;

-- كل مستخدم يرى ملفه فقط، والمشرف يرى الكل
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- المستخدم يحدّث آخر ظهور له فقط
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- تسجيل تحميل: مسجّل أو زائر
create policy "downloads_insert_any"
  on public.downloads for insert
  with check (auth.uid() = user_id or user_id is null);

-- قراءة التحميلات للمشرف فقط
create policy "downloads_select_admin"
  on public.downloads for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ============================================
-- مهم: اجعل حسابك مشرفاً — استبدل البريد أدناه ببريدك ثم شغّل:
-- ============================================
-- update public.profiles set is_admin = true where email = 'بريدك@example.com';
