# Site Survey Pro

تطبيق مستقل لإدارة أعمال الـ site survey للبنايات والأعمدة وسجلات الاعتراض/الوجود/الزرع.

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env`.
2. ضع قيم Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET=survey-photos`
3. ثبت وشغل:

```bash
npm install
npm run dev
```

## تجهيز Supabase

افتح Supabase SQL Editor وشغل الملف:

```text
supabase/schema.sql
```

الملف ينشئ الجداول التالية:

- `buildings`
- `poles`
- `column_checks`

وينشئ bucket باسم `survey-photos` لتخزين الصور.

## النشر على Render

1. ارفع المشروع إلى GitHub.
2. في Render اختر New > Static Site واربط الريبو.
3. Render سيقرأ `render.yaml`.
4. أضف Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET`

## ملاحظات مهمة

- التطبيق يعمل بخريطة OpenStreetMap عبر Leaflet.
- الضغط على الخريطة يحدد Latitude و Longitude تلقائياً.
- رفع الصور يتم إلى Supabase Storage.
- عند عدم وضع إعدادات Supabase، يعرض التطبيق تنبيه اتصال ولا يكتب بيانات.
