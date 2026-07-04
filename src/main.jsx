import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  LocateFixed,
  LogOut,
  MapPin,
  RefreshCcw,
  Search,
  UserRound,
} from 'lucide-react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { hasSupabaseConfig, supabase, SUPABASE_BUCKET } from './supabaseClient';

const today = new Date().toISOString().slice(0, 10);
const defaultLocation = { latitude: 32.8872, longitude: 13.1913 };
const PROFILE_KEY = 'site-survey-profile';

const resources = {
  buildings: {
    title: 'إضافة بناية',
    singular: 'بناية',
    table: 'buildings',
    accent: '#2563eb',
    empty: {
      id: null,
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      building_type: '',
      floor_number: '',
      users_number: '',
      building_status: '',
      district: '',
      tech_name: '',
      survey_date: today,
      record_status: 'New',
      notes: '',
      photo_url: '',
    },
    fields: [
      ['building_type', 'Building type', 'select', ['تجاري', 'سكني', 'حكومي', 'تجاري/سكني', 'تجاري/حكومي', 'ارض فارغه']],
      ['floor_number', 'Floor number', 'number'],
      ['users_number', 'Users number', 'number'],
      ['building_status', 'Building status', 'select', ['جاهزه', 'غير جاهزه', 'بنايه متضرره']],
      ['district', 'district', 'text'],
      ['tech_name', 'tech name', 'text'],
      ['survey_date', 'date', 'date'],
      ['record_status', 'Record Status', 'select', ['New', 'Submitted', 'Reviewed', 'Rejected']],
      ['notes', 'Notes', 'textarea'],
    ],
    columns: ['id', 'building_type', 'floor_number', 'users_number', 'building_status', 'district', 'tech_name', 'record_status'],
  },
  poles: {
    title: 'إضافة عمود',
    singular: 'عمود',
    table: 'poles',
    accent: '#059669',
    empty: {
      id: null,
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      pole_owner: '',
      pole_type: '',
      pole_length: '',
      pole_status: '',
      district: '',
      tech_name: '',
      survey_date: today,
      record_status: 'New',
      notes: '',
      photo_url: '',
    },
    fields: [
      ['pole_owner', 'Pole owner', 'select', ['هاتف ليبيا', 'GECOL']],
      ['pole_length', 'Pole length', 'select', ['12', '9', '6', '4.5']],
      ['pole_type', 'Pole type', 'select', ['خشبي', 'حديدي']],
      ['pole_status', 'Pole Status', 'select', ['جيد', 'غير جيد']],
      ['district', 'district', 'text'],
      ['tech_name', 'tech name', 'text'],
      ['survey_date', 'date', 'date'],
      ['record_status', 'Record Status', 'select', ['New', 'Submitted', 'Reviewed', 'Rejected']],
      ['notes', 'Notes', 'textarea'],
    ],
    columns: ['id', 'pole_owner', 'pole_type', 'pole_length', 'pole_status', 'district', 'tech_name', 'record_status'],
  },
  column_checks: {
    title: 'إضافة عمود جديد',
    singular: 'فحص عمود',
    table: 'column_checks',
    accent: '#7c3aed',
    empty: {
      id: null,
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      district: '',
      tech_name: '',
      has_objection: 'لا',
      is_existing: 'لا',
      is_planted: 'لا',
      notes: '',
      photo_url: '',
    },
    fields: [
      ['district', 'district', 'text'],
      ['tech_name', 'tech name', 'text'],
      ['has_objection', 'هل عليه اعتراض', 'select', ['نعم', 'لا']],
      ['is_planted', 'هل تم زرعه', 'select', ['نعم', 'لا']],
      ['is_existing', 'هل هو موجود', 'select', ['نعم', 'لا']],
      ['notes', 'ملاحظة', 'textarea'],
    ],
    columns: ['id', 'district', 'tech_name', 'has_objection', 'is_existing', 'is_planted', 'notes'],
  },
};

const labels = {
  id: 'ID',
  latitude: 'Latitude',
  longitude: 'Longitude',
  building_type: 'Building type',
  floor_number: 'Floor number',
  users_number: 'Users number',
  building_status: 'Building status',
  district: 'district',
  tech_name: 'tech name',
  survey_date: 'date',
  record_status: 'Record Status',
  notes: 'Notes',
  photo_url: 'Photo URL',
  pole_owner: 'Pole owner',
  pole_type: 'Pole type',
  pole_length: 'Pole length',
  pole_status: 'Pole Status',
  has_objection: 'هل عليه اعتراض',
  is_existing: 'هل هو موجود',
  is_planted: 'هل تم زرعه',
};

function readSavedProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function applyProfileToForm(form, profile) {
  if (!profile) return form;
  return {
    ...form,
    district: 'district' in form ? profile.district : form.district,
    tech_name: 'tech_name' in form ? profile.techName : form.tech_name,
  };
}

function makeEmptyForms(profile) {
  return Object.fromEntries(
    Object.entries(resources).map(([key, item]) => [key, applyProfileToForm(item.empty, profile)]),
  );
}

function MapCenterSync({ value, onChange }) {
  const map = useMap();

  useEffect(() => {
    const center = map.getCenter();
    if (Math.abs(center.lat - Number(value.latitude)) > 0.000001 || Math.abs(center.lng - Number(value.longitude)) > 0.000001) {
      map.setView([Number(value.latitude), Number(value.longitude)], map.getZoom(), { animate: true });
    }
  }, [map, value.latitude, value.longitude]);

  useMapEvents({
    moveend(event) {
      const center = event.target.getCenter();
      onChange({
        latitude: Number(center.lat.toFixed(7)),
        longitude: Number(center.lng.toFixed(7)),
      });
    },
  });

  return null;
}

function makeRecordId(type) {
  const prefix = type === 'buildings' ? 'BLD' : type === 'poles' ? 'POL' : 'COL';
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function yesNoToBoolean(value) {
  return value === true || value === 'نعم';
}

function App() {
  const [profile, setProfile] = useState(readSavedProfile);
  const [active, setActive] = useState('buildings');
  const [forms, setForms] = useState(() => makeEmptyForms(readSavedProfile()));
  const [records, setRecords] = useState({ buildings: [], poles: [], column_checks: [] });
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);

  const current = resources[active];
  const form = forms[active];

  const totals = useMemo(
    () => ({
      buildings: records.buildings.length,
      poles: records.poles.length,
      column_checks: records.column_checks.length,
    }),
    [records],
  );

  useEffect(() => {
    if (profile) loadAll();
  }, [profile]);

  function saveProfile(nextProfile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setForms(makeEmptyForms(nextProfile));
    setMessage(`أهلاً ${nextProfile.techName}. تم تثبيت الاسم والمنطقة داخل البرنامج.`);
  }

  function changeProfile() {
    localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
    setMessage('');
  }

  async function loadAll() {
    if (!hasSupabaseConfig) {
      setMessage('ضع إعدادات Supabase في ملف .env حتى يتم حفظ وقراءة البيانات.');
      return;
    }

    setBusy(true);
    try {
      const nextRecords = {};
      for (const [key, config] of Object.entries(resources)) {
        const { data, error } = await supabase.from(config.table).select('*').order('created_at', { ascending: false }).limit(500);
        if (error) throw error;
        nextRecords[key] = data || [];
      }
      setRecords(nextRecords);
      setMessage('تم تحديث البيانات بنجاح.');
    } catch (error) {
      setMessage(`تعذر تحميل البيانات: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function updateForm(key, value) {
    setForms((previous) => ({
      ...previous,
      [active]: {
        ...previous[active],
        [key]: value,
      },
    }));
  }

  function setLocation(location) {
    setForms((previous) => ({
      ...previous,
      [active]: {
        ...previous[active],
        ...location,
      },
    }));
  }

  async function uploadPhoto(recordId) {
    if (!photoFile) return form.photo_url || '';
    const extension = photoFile.name.split('.').pop() || 'jpg';
    const path = `${active}/${recordId}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, photoFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!hasSupabaseConfig) {
      setMessage('لا يمكن الحفظ قبل إضافة إعدادات Supabase.');
      return;
    }
    setBusy(true);
    try {
      const recordId = form.id || makeRecordId(active);
      const photoUrl = await uploadPhoto(recordId);
      const payload = {
        ...form,
        id: recordId,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        photo_url: photoUrl,
      };

      ['has_objection', 'is_existing', 'is_planted'].forEach((key) => {
        if (key in payload) payload[key] = yesNoToBoolean(payload[key]);
      });

      ['floor_number', 'users_number'].forEach((key) => {
        if (key in payload) payload[key] = payload[key] === '' ? null : Number(payload[key]);
      });
      if ('pole_length' in payload) payload.pole_length = payload.pole_length === '' ? null : Number(payload.pole_length);

      const { error } = await supabase.from(current.table).upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      setForms((previous) => ({ ...previous, [active]: applyProfileToForm(current.empty, profile) }));
      setPhotoFile(null);
      setMessage(`تم حفظ ${current.singular} بنجاح.`);
      await loadAll();
    } catch (error) {
      setMessage(`تعذر الحفظ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage('المتصفح لا يدعم تحديد الموقع.');
      return;
    }
    setMessage('جار تحديد الموقع...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        });
        setMessage('تم استخدام موقع الجهاز الحالي.');
      },
      () => setMessage('لم يتم السماح بالوصول إلى موقع الجهاز. يمكنك الضغط على الخريطة يدوياً.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  if (!profile) {
    return <LoginPage onSave={saveProfile} />;
  }

  const filteredRows = records[active].filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Site Survey Pro</p>
          <h1>مرجع ميداني سريع للبنايات والأعمدة</h1>
        </div>
        <div className="actions">
          <div className="profilePill" title="بيانات الفني الحالية">
            <UserRound size={17} />
            <span>{profile.techName}</span>
            <strong>{profile.district}</strong>
          </div>
          <button className="ghost" type="button" onClick={changeProfile}>
            <LogOut size={18} />
            تغيير المستخدم
          </button>
          <button className="ghost" type="button" onClick={loadAll} disabled={busy}>
            <RefreshCcw size={18} />
            تحديث
          </button>
        </div>
      </header>

      <section className="stats">
        <article>
          <ClipboardList size={19} />
          <span>البنايات</span>
          <strong>{totals.buildings}</strong>
        </article>
        <article>
          <MapPin size={19} />
          <span>الأعمدة</span>
          <strong>{totals.poles}</strong>
        </article>
        <article>
          <CheckCircle2 size={19} />
          <span>فحص الأعمدة</span>
          <strong>{totals.column_checks}</strong>
        </article>
      </section>

      <nav className="tabs" aria-label="Survey sections">
        {Object.entries(resources).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className={active === key ? 'active' : ''}
            style={{ '--accent': item.accent }}
            onClick={() => {
              setActive(key);
              setPhotoFile(null);
            }}
          >
            {item.title}
          </button>
        ))}
      </nav>

      {message && <div className="notice">{message}</div>}

      <section className="workspace">
        <div className="mapShell">
          <MapContainer center={[form.latitude, form.longitude]} zoom={15} scrollWheelZoom className="map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapCenterSync value={form} onChange={setLocation} />
          </MapContainer>
          <div className="fixedPin" aria-hidden="true">
            <MapPin size={36} />
          </div>
          <div className="mapControls">
            <button type="button" onClick={useCurrentLocation}>
              <LocateFixed size={17} />
              موقعي الحالي
            </button>
            <span>{form.latitude}, {form.longitude}</span>
          </div>
        </div>

        <form className="panel" onSubmit={saveRecord}>
          <div className="panelHeader">
            <div>
              <p>سجل جديد</p>
              <h2>{current.title}</h2>
              <span className="autoId">ID تلقائي عند الحفظ</span>
            </div>
            <Camera color={current.accent} />
          </div>

          <div className="coordinateGrid">
            <label>
              Latitude
              <input type="number" step="any" value={form.latitude} onChange={(event) => updateForm('latitude', event.target.value)} />
            </label>
            <label>
              Longitude
              <input type="number" step="any" value={form.longitude} onChange={(event) => updateForm('longitude', event.target.value)} />
            </label>
          </div>

          <div className="fieldGrid">
            {current.fields.map(([name, label, type, options]) => (
              <Field
                key={name}
                name={name}
                label={label}
                type={type}
                options={options}
                value={form[name]}
                locked={name === 'district' || name === 'tech_name'}
                onChange={(value) => updateForm(name, value)}
              />
            ))}
          </div>

          <label className="photoBox">
            <Camera size={22} />
            <span>{photoFile ? photoFile.name : 'التقاط صورة بالكاميرا'}</span>
            <input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
          </label>

          <button className="save" type="submit" disabled={busy}>
            {busy ? 'جار الحفظ...' : 'حفظ السجل'}
          </button>
        </form>
      </section>

      <section className="records">
        <div className="recordsHeader">
          <h2>السجلات</h2>
          <label className="search">
            <Search size={17} />
            <input placeholder="بحث سريع..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                {current.columns.map((column) => <th key={column}>{labels[column] || column}</th>)}
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Photo URL</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  {current.columns.map((column) => <td key={column}>{formatValue(row[column])}</td>)}
                  <td>{row.latitude}</td>
                  <td>{row.longitude}</td>
                  <td>{row.photo_url ? <a href={row.photo_url} target="_blank" rel="noreferrer">فتح الصورة</a> : '-'}</td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={current.columns.length + 3} className="empty">لا توجد سجلات بعد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function LoginPage({ onSave }) {
  const [techName, setTechName] = useState('');
  const [district, setDistrict] = useState('');

  function submit(event) {
    event.preventDefault();
    if (!techName.trim() || !district.trim()) return;
    onSave({ techName: techName.trim(), district: district.trim() });
  }

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={submit}>
        <div className="loginIcon">
          <UserRound size={30} />
        </div>
        <p className="eyebrow">Site Survey Pro</p>
        <h1>تسجيل دخول الفني</h1>
        <p className="loginText">أدخل اسمك والمنطقة مرة واحدة. سيتم تثبيتها تلقائياً على كل سجل جديد داخل البرنامج.</p>

        <label>
          اسم الفني
          <input autoFocus value={techName} onChange={(event) => setTechName(event.target.value)} placeholder="مثال: Ahmed Ali" />
        </label>
        <label>
          المنطقة
          <input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="مثال: Hay Andalus Zone 2" />
        </label>

        <button className="save" type="submit" disabled={!techName.trim() || !district.trim()}>
          دخول البرنامج
        </button>
      </form>
    </main>
  );
}

function Field({ name, label, type, options, value, locked, onChange }) {
  if (type === 'textarea') {
    return (
      <label className="wide">
        {label}
        <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows="3" />
      </label>
    );
  }

  if (type === 'select') {
    return (
      <label>
        {label}
        <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">اختر...</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (type === 'checkbox') {
    return (
      <label className="check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }

  return (
    <label>
      {label}
      <input
        readOnly={locked}
        className={locked ? 'lockedInput' : ''}
        required={name === 'id'}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function formatValue(value) {
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (value === null || value === undefined || value === '') return '-';
  return value;
}

createRoot(document.getElementById('root')).render(<App />);
