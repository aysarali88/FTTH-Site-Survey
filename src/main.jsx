import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  LocateFixed,
  LogOut,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import * as XLSX from 'xlsx';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { hasSupabaseConfig, supabase, SUPABASE_BUCKET } from './supabaseClient';

const today = new Date().toISOString().slice(0, 10);
const defaultLocation = { latitude: 32.8872, longitude: 13.1913 };
const PROFILE_KEY = 'site-survey-profile';
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';

const resources = {
  buildings: {
    title: 'إضافة بناية',
    singular: 'بناية',
    plural: 'البنايات',
    table: 'buildings',
    accent: '#dc2626',
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
      ['record_status', 'Record Status', 'select', ['New', 'Submitted', 'Reviewed', 'Rejected']],
      ['notes', 'Notes', 'textarea'],
    ],
    columns: ['id', 'building_type', 'floor_number', 'users_number', 'building_status', 'district', 'tech_name', 'record_status', 'record_date'],
  },
  poles: {
    title: 'إضافة عمود',
    singular: 'عمود',
    plural: 'الأعمدة',
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
      ['record_status', 'Record Status', 'select', ['New', 'Submitted', 'Reviewed', 'Rejected']],
      ['notes', 'Notes', 'textarea'],
    ],
    columns: ['id', 'pole_owner', 'pole_type', 'pole_length', 'pole_status', 'district', 'tech_name', 'record_status', 'record_date'],
  },
  column_checks: {
    title: 'زراعة عمود جديد',
    singular: 'زراعة عمود جديد',
    plural: 'زراعة عمود جديد',
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
    columns: ['id', 'district', 'tech_name', 'has_objection', 'is_existing', 'is_planted', 'notes', 'record_date'],
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
  record_date: 'Record date',
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

const markerIcons = {
  buildings: L.divIcon({
    className: '',
    html: `
      <div class="surveyMarker buildingMarker">
        <svg viewBox="0 0 96 80" aria-hidden="true">
          <path d="M14 72h68" stroke="#3ccf72" stroke-width="8" stroke-linecap="round"/>
          <path d="M21 37 48 13l27 24v35H21z" fill="#f2a15f"/>
          <path d="M11 41 48 8l37 33" fill="none" stroke="#ef4b37" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="34" y="45" width="17" height="27" rx="2" fill="#8b5a43"/>
          <circle cx="47" cy="58" r="1.8" fill="#3a2a24"/>
          <rect x="58" y="43" width="17" height="15" rx="2" fill="#54a9df"/>
          <path d="M21 37v-19h11v9" fill="#a66a43"/>
        </svg>
      </div>
    `,
    iconSize: [48, 42],
    iconAnchor: [24, 42],
    popupAnchor: [0, -38],
  }),
  poles: L.divIcon({
    className: '',
    html: `
      <div class="surveyMarker poleMarker">
        <svg viewBox="0 0 64 110" aria-hidden="true">
          <path d="M32 28v78" stroke="#050505" stroke-width="7" stroke-linecap="square"/>
          <path d="M5 25h54" stroke="#050505" stroke-width="5" stroke-linecap="square"/>
          <path d="M32 28 14 25M32 28l18-3" stroke="#050505" stroke-width="4" stroke-linecap="round"/>
          <path d="M10 17v8M52 17v8" stroke="#050505" stroke-width="5" stroke-linecap="square"/>
          <path d="M17 19h4M45 19h4" stroke="#050505" stroke-width="4" stroke-linecap="square"/>
        </svg>
      </div>
    `,
    iconSize: [38, 62],
    iconAnchor: [19, 62],
    popupAnchor: [0, -58],
  }),
  column_checks: L.divIcon({
    className: '',
    html: '<div class="surveyMarker checkMarker">●</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -24],
  }),
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

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
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

function booleanToYesNo(value) {
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  return value || '-';
}

function normalizeRow(row, type) {
  return {
    ...row,
    survey_type: resources[type].plural,
    record_date: formatDate(row.created_at || row.survey_date),
  };
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

function SurveyMarkers({ groupedRecords, onDelete, canDelete }) {
  return Object.entries(groupedRecords).flatMap(([type, rows]) =>
    rows.map((row) => (
      <Marker key={`${type}-${row.id}`} position={[row.latitude, row.longitude]} icon={markerIcons[type]}>
        <Popup>
          <div className="markerPopup">
            <strong>{resources[type].singular}</strong>
            <span>{row.id}</span>
            <span>{row.district || '-'}</span>
            <span>{row.tech_name || '-'}</span>
            <span>{formatDate(row.created_at || row.survey_date)}</span>
            {row.photo_url && <a href={row.photo_url} target="_blank" rel="noreferrer">فتح الصورة</a>}
            {canDelete && (
              <button type="button" className="dangerMini" onClick={() => onDelete(type, row.id)}>
                حذف النقطة
              </button>
            )}
          </div>
        </Popup>
      </Marker>
    )),
  );
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
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [adminFilters, setAdminFilters] = useState({ district: '', techName: '', type: 'all' });
  const [adminPage, setAdminPage] = useState('data');

  const isAdmin = profile?.role === 'admin';
  const current = resources[active];
  const form = forms[active];

  const scopedRecords = useMemo(() => {
    const filtered = {};
    for (const [type, rows] of Object.entries(records)) {
      filtered[type] = rows
        .map((row) => normalizeRow(row, type))
        .filter((row) => {
          if (!isAdmin) return row.tech_name === profile?.techName && row.district === profile?.district;
          if (adminFilters.type !== 'all' && adminFilters.type !== type) return false;
          if (adminFilters.district && row.district !== adminFilters.district) return false;
          if (adminFilters.techName && row.tech_name !== adminFilters.techName) return false;
          if (query && !JSON.stringify(row).toLowerCase().includes(query.toLowerCase())) return false;
          return true;
        });
    }
    return filtered;
  }, [records, isAdmin, profile, adminFilters, query]);

  const currentRows = scopedRecords[active] || [];
  const allVisibleRows = useMemo(
    () => Object.entries(scopedRecords).flatMap(([type, rows]) => rows.map((row) => ({ ...row, _type: type }))),
    [scopedRecords],
  );
  const visiblePhotos = useMemo(
    () => allVisibleRows.filter((row) => row.photo_url),
    [allVisibleRows],
  );

  const totals = useMemo(
    () => ({
      buildings: scopedRecords.buildings.length,
      poles: scopedRecords.poles.length,
      column_checks: scopedRecords.column_checks.length,
    }),
    [scopedRecords],
  );

  const adminOptions = useMemo(() => {
    const all = Object.values(records).flat();
    return {
      districts: [...new Set(all.map((row) => row.district).filter(Boolean))].sort(),
      techs: [...new Set(all.map((row) => row.tech_name).filter(Boolean))].sort(),
    };
  }, [records]);

  useEffect(() => {
    if (profile) {
      loadAll();
      requestCurrentLocation(true);
    }
  }, [profile]);

  function saveProfile(nextProfile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setForms(makeEmptyForms(nextProfile));
    setMessage(nextProfile.role === 'admin' ? 'تم الدخول كأدمن.' : `أهلاً ${nextProfile.techName}. تم تثبيت الاسم والمنطقة.`);
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
        const { data, error } = await supabase.from(config.table).select('*').order('created_at', { ascending: false }).limit(2000);
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
    setForms((previous) => {
      const next = {};
      for (const [key, value] of Object.entries(previous)) {
        next[key] = { ...value, ...location };
      }
      return next;
    });
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
        survey_date: today,
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
      setFormDrawerOpen(false);
      setMessage(`تم حفظ ${current.singular} بنجاح.`);
      await loadAll();
    } catch (error) {
      setMessage(`تعذر الحفظ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(type, id) {
    const confirmed = window.confirm('هل تريد حذف هذه النقطة من السيستم؟');
    if (!confirmed) return;

    setBusy(true);
    try {
      const { error } = await supabase.from(resources[type].table).delete().eq('id', id);
      if (error) throw error;
      setRecords((previous) => ({
        ...previous,
        [type]: previous[type].filter((row) => row.id !== id),
      }));
      setMessage('تم حذف النقطة بنجاح.');
    } catch (error) {
      setMessage(`تعذر الحذف: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function requestCurrentLocation(silent = false) {
    if (!navigator.geolocation) {
      if (!silent) setMessage('المتصفح لا يدعم تحديد الموقع.');
      return;
    }
    if (!silent) setMessage('جار تحديد الموقع...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        });
        if (!silent) setMessage('تم استخدام موقع الجهاز الحالي.');
      },
      () => {
        if (!silent) setMessage('لم يتم السماح بالوصول إلى موقع الجهاز. حرّك الخريطة يدوياً وحدد النقطة من الدبوس.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();

    const sheets = {
      'البنايات': scopedRecords.buildings.map((row) => ({
        ID: row.id,
        Latitude: row.latitude,
        Longitude: row.longitude,
        'Building type': row.building_type || '',
        'Floor number': row.floor_number ?? '',
        'Users number': row.users_number ?? '',
        'Building status': row.building_status || '',
        district: row.district || '',
        'tech name': row.tech_name || '',
        date: row.record_date,
        'Record Status': row.record_status || '',
        Notes: row.notes || '',
        'Photo URL': row.photo_url || '',
      })),
      'الأعمدة': scopedRecords.poles.map((row) => ({
        ID: row.id,
        Latitude: row.latitude,
        Longitude: row.longitude,
        'Pole owner': row.pole_owner || '',
        'Pole type': row.pole_type || '',
        'Pole length': row.pole_length ?? '',
        'Pole Status': row.pole_status || '',
        district: row.district || '',
        'tech name': row.tech_name || '',
        date: row.record_date,
        'Record Status': row.record_status || '',
        Notes: row.notes || '',
        'Photo URL': row.photo_url || '',
      })),
      'زراعة عمود جديد': scopedRecords.column_checks.map((row) => ({
        ID: row.id,
        Latitude: row.latitude,
        Longitude: row.longitude,
        district: row.district || '',
        'tech name': row.tech_name || '',
        date: row.record_date,
        'هل عليه اعتراض': booleanToYesNo(row.has_objection),
        'هل هو موجود': booleanToYesNo(row.is_existing),
        'هل تم زرعه': booleanToYesNo(row.is_planted),
        Notes: row.notes || '',
        'Photo URL': row.photo_url || '',
      })),
    };

    Object.entries(sheets).forEach(([sheetName, rows]) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    XLSX.writeFile(workbook, `site-survey-${formatDate(new Date())}.xlsx`);
  }

  if (!profile) {
    return <LoginPage onSave={saveProfile} />;
  }

  return (
    <main className={`app ${isAdmin ? 'adminMode' : ''}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Site Survey Pro</p>
          <h1>{isAdmin ? 'لوحة تحكم الأدمن' : 'مرجع ميداني سريع للبنايات والأعمدة'}</h1>
        </div>
        <div className="actions">
          <div className="profilePill" title="بيانات المستخدم الحالية">
            <UserRound size={17} />
            <span>{profile.techName}</span>
            <strong>{isAdmin ? 'Admin' : profile.district}</strong>
          </div>
          <button className="ghost" type="button" onClick={changeProfile}>
            <LogOut size={18} />
            تغيير المستخدم
          </button>
          <button className="ghost" type="button" onClick={loadAll} disabled={busy}>
            <RefreshCcw size={18} />
            تحديث
          </button>
          {isAdmin && (
            <button className="ghost" type="button" onClick={exportExcel}>
              <Download size={18} />
              Excel
            </button>
          )}
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

      {isAdmin && (
        <section className="adminPages" aria-label="Admin pages">
          <button type="button" className={adminPage === 'data' ? 'active' : ''} onClick={() => setAdminPage('data')}>
            البيانات
          </button>
          <button type="button" className={adminPage === 'photos' ? 'active' : ''} onClick={() => setAdminPage('photos')}>
            الصور
            <span>{visiblePhotos.length}</span>
          </button>
        </section>
      )}

      {isAdmin && (
        <section className="adminFilters">
          <label>
            المنطقة
            <select value={adminFilters.district} onChange={(event) => setAdminFilters((prev) => ({ ...prev, district: event.target.value }))}>
              <option value="">كل المناطق</option>
              {adminOptions.districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </label>
          <label>
            الفني
            <select value={adminFilters.techName} onChange={(event) => setAdminFilters((prev) => ({ ...prev, techName: event.target.value }))}>
              <option value="">كل الفنيين</option>
              {adminOptions.techs.map((tech) => <option key={tech} value={tech}>{tech}</option>)}
            </select>
          </label>
          <label>
            النوع
            <select value={adminFilters.type} onChange={(event) => setAdminFilters((prev) => ({ ...prev, type: event.target.value }))}>
              <option value="all">كل الأنواع</option>
              {Object.entries(resources).map(([key, item]) => <option key={key} value={key}>{item.plural}</option>)}
            </select>
          </label>
          <label className="search">
            <Search size={17} />
            <input placeholder="بحث في كل البيانات..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </section>
      )}

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
              setFormDrawerOpen(true);
            }}
          >
            {item.title}
          </button>
        ))}
      </nav>

      {message && <div className="notice">{message}</div>}

      <section className="workspace">
        <div className="mapShell">
          <button className="mapAddButton" type="button" onClick={() => setFormDrawerOpen(true)}>
            <Plus size={18} />
            إضافة بيانات
          </button>
          <MapContainer center={[form.latitude, form.longitude]} zoom={18} maxZoom={22} scrollWheelZoom className="map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={22}
              maxNativeZoom={19}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapCenterSync value={form} onChange={setLocation} />
            <SurveyMarkers groupedRecords={scopedRecords} onDelete={deleteRecord} canDelete />
          </MapContainer>
          <div className="fixedPin" aria-hidden="true">
            <MapPin size={36} />
          </div>
          <div className="mapControls">
            <button type="button" onClick={() => requestCurrentLocation(false)}>
              <LocateFixed size={17} />
              موقعي الحالي
            </button>
            <span>{form.latitude}, {form.longitude}</span>
          </div>
        </div>

        <form className={`panel ${formDrawerOpen ? 'open' : ''}`} onSubmit={saveRecord}>
          <div className="drawerTabs" aria-label="اختيار نوع الإضافة">
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
          </div>

          <div className="panelHeader">
            <div>
              <p>سجل جديد</p>
              <h2>{current.title}</h2>
              <span className="autoId">ID تلقائي، التاريخ {formatDate(new Date())}</span>
            </div>
            <div className="panelHeaderActions">
              <Camera color={current.accent} />
              <button className="closePanel" type="button" onClick={() => setFormDrawerOpen(false)} aria-label="إغلاق النموذج">
                <X size={18} />
              </button>
            </div>
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

      {isAdmin && adminPage === 'photos' && (
        <section className="photosPage">
          <div className="recordsHeader">
            <h2>الصور</h2>
            <span>{visiblePhotos.length} صورة</span>
          </div>
          <div className="photoGrid">
            {visiblePhotos.map((row) => (
              <article className="photoCard" key={`${row._type}-${row.id}`}>
                <a href={row.photo_url} target="_blank" rel="noreferrer">
                  <img src={row.photo_url} alt={`${resources[row._type].singular} ${row.id}`} loading="lazy" />
                </a>
                <div>
                  <strong>{resources[row._type].singular}</strong>
                  <span>ID: {row.id}</span>
                  <span>المنطقة: {row.district || '-'}</span>
                  <span>الفني: {row.tech_name || '-'}</span>
                  <span>التاريخ: {row.record_date}</span>
                </div>
              </article>
            ))}
            {!visiblePhotos.length && <div className="empty photosEmpty">لا توجد صور حسب الفلاتر الحالية.</div>}
          </div>
        </section>
      )}

      {(!isAdmin || adminPage === 'data') && (
      <section className="records">
        <div className="recordsHeader">
          <h2>{isAdmin ? 'كل السجلات' : 'سجلاتي'}</h2>
          {!isAdmin && (
            <label className="search">
              <Search size={17} />
              <input placeholder="بحث سريع..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          )}
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                {current.columns.map((column) => <th key={column}>{labels[column] || column}</th>)}
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Photo URL</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row) => (
                <tr key={row.id}>
                  {current.columns.map((column) => <td key={column}>{formatValue(row[column])}</td>)}
                  <td>{row.latitude}</td>
                  <td>{row.longitude}</td>
                  <td>{row.photo_url ? <a href={row.photo_url} target="_blank" rel="noreferrer">فتح الصورة</a> : '-'}</td>
                  <td>
                    <button className="dangerIcon" type="button" onClick={() => deleteRecord(active, row.id)} title="حذف">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!currentRows.length && (
                <tr>
                  <td colSpan={current.columns.length + 4} className="empty">لا توجد سجلات حسب المستخدم والمنطقة الحالية.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </main>
  );
}

function LoginPage({ onSave }) {
  const [techName, setTechName] = useState('');
  const [district, setDistrict] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    setError('');
    if (adminMode) {
      if (adminPin !== ADMIN_PIN) {
        setError('كود الأدمن غير صحيح.');
        return;
      }
      onSave({ techName: techName.trim() || 'Admin', district: 'ALL', role: 'admin' });
      return;
    }
    if (!techName.trim() || !district.trim()) return;
    onSave({ techName: techName.trim(), district: district.trim(), role: 'tech' });
  }

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={submit}>
        <div className="loginIcon">
          <UserRound size={30} />
        </div>
        <p className="eyebrow">Site Survey Pro</p>
        <h1>{adminMode ? 'دخول الأدمن' : 'تسجيل دخول الفني'}</h1>
        <p className="loginText">الفني يرى بيانات اسمه ومنطقته فقط. الأدمن يرى كل البيانات ويصدّر Excel.</p>

        <label className="check adminSwitch">
          <input type="checkbox" checked={adminMode} onChange={(event) => setAdminMode(event.target.checked)} />
          <span>تسجيل دخول كأدمن</span>
        </label>

        <label>
          اسم المستخدم
          <input autoFocus value={techName} onChange={(event) => setTechName(event.target.value)} placeholder="مثال: Ahmed Ali" />
        </label>
        {!adminMode && (
          <label>
            المنطقة
            <input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="مثال: Hay Andalus Zone 2" />
          </label>
        )}
        {adminMode && (
          <label>
            كود الأدمن
            <input type="password" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Admin PIN" />
          </label>
        )}

        {error && <div className="notice">{error}</div>}

        <button className="save" type="submit" disabled={adminMode ? !adminPin.trim() : !techName.trim() || !district.trim()}>
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

  return (
    <label>
      {label}
      <input
        readOnly={locked}
        className={locked ? 'lockedInput' : ''}
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
