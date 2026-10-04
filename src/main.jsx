import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Camera,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  Expand,
  Filter,
  LocateFixed,
  LogOut,
  MapPin,
  MapPinned,
  Minimize2,
  Plus,
  RefreshCcw,
  Search,
  Target,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';
import './styles.css';
import { hasSupabaseConfig, supabase, SUPABASE_BUCKET } from './supabaseClient';

const today = new Date().toISOString().slice(0, 10);
const defaultLocation = { latitude: 32.8872, longitude: 13.1913 };
const PROFILE_KEY = 'site-survey-profile';
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';
const AUTH_EMAIL_DOMAIN = 'site-survey.local';
const IMPORT_BATCH_SIZE = 500;
const MAX_IMPORTED_RECORDS_TO_RENDER = 500;
const MAX_MAP_MARKERS = 2000;
const MAX_TABLE_ROWS = 500;

const resources = {
  buildings: {
    title: 'الأبنية',
    singular: 'بناية',
    plural: 'الأبنية',
    table: 'buildings',
    accent: '#dc2626',
    empty: {
      id: null,
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      city: '',
      building_type: '',
      floor_number: '',
      users_number: '',
      building_status: '',
      district: '',
      tech_name: '',
      survey_date: today,
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
      ['notes', 'Notes', 'textarea'],
    ],
    columns: ['id', 'latitude', 'longitude', 'city', 'building_type', 'floor_number', 'users_number', 'building_status', 'district', 'tech_name', 'record_date', 'record_time', 'photo_url', 'notes'],
  },
  poles: {
    title: 'الأعمدة',
    singular: 'عمود',
    plural: 'الأعمدة',
    table: 'poles',
    accent: '#059669',
    empty: {
      id: null,
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      city: '',
      pole_owner: '',
      pole_type: '',
      pole_length: '',
      pole_status: '',
      district: '',
      tech_name: '',
      survey_date: today,
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
      ['notes', 'Notes', 'textarea'],
    ],
    columns: ['id', 'latitude', 'longitude', 'city', 'pole_owner', 'pole_type', 'pole_length', 'pole_status', 'district', 'tech_name', 'record_date', 'record_time', 'photo_url', 'notes'],
  },
  column_checks: {
    title: 'زراعة الأعمدة',
    singular: 'زراعة عمود',
    plural: 'زراعة الأعمدة',
    table: 'column_checks',
    accent: '#7c3aed',
    empty: {
      id: null,
      latitude: defaultLocation.latitude,
      longitude: defaultLocation.longitude,
      city: '',
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
    columns: ['id', 'latitude', 'longitude', 'city', 'district', 'tech_name', 'has_objection', 'is_existing', 'is_planted', 'record_date', 'record_time', 'photo_url', 'notes'],
  },
};

const labels = {
  id: 'ID',
  latitude: 'Latitude',
  longitude: 'Longitude',
  city: 'City',
  building_type: 'Building type',
  floor_number: 'Floor number',
  users_number: 'Users number',
  building_status: 'Building status',
  district: 'district',
  tech_name: 'tech name',
  survey_date: 'date',
  record_date: 'التاريخ',
  record_time: 'الوقت',
  notes: 'Notes',
  photo_url: 'رابط الصورة',
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

const canvasRenderer = L.canvas({ padding: 0.5 });
const markerColors = {
  buildings: '#ef4444',
  poles: '#2563eb',
  column_checks: '#2563eb',
};

function readSavedProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    const profile = saved ? JSON.parse(saved) : null;
    if (profile?.username) return null;
    if (profile?.role === 'tech' && !profile.city) return null;
    return profile;
  } catch {
    return null;
  }
}

function internalAuthEmail(username) {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

function roleLabel(role) {
  return {
    admin: 'Admin',
    tech: 'Technician',
    design: 'Design',
    engineer: 'Engineer',
    supervisor: 'Supervisor',
  }[role] || role;
}

function applyProfileToForm(form, profile) {
  if (!profile) return form;
  return {
    ...form,
    city: 'city' in form ? profile.city : form.city,
    district: 'district' in form ? profile.district : form.district,
    tech_name: 'tech_name' in form ? profile.techName : form.tech_name,
  };
}

function makeEmptyForms(profile) {
  return Object.fromEntries(
    Object.entries(resources).map(([key, item]) => [key, applyProfileToForm(item.empty, profile)]),
  );
}

function getResourceUiLabel(key) {
  if (key === 'buildings') return 'البنايات';
  if (key === 'poles') return 'الأعمدة';
  return 'زراعة الأعمدة';
}

function getResourceUiSingular(key) {
  if (key === 'buildings') return 'بناية';
  if (key === 'poles') return 'عمود';
  return 'زراعة عمود';
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

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function makeRecordId(type) {
  const prefix = type === 'buildings' ? 'BLD' : type === 'poles' ? 'POL' : 'COL';
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = crypto.randomUUID
    ? crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
    : `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`.toUpperCase();
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
    record_time: formatTime(row.created_at),
  };
}

function inferCity(row) {
  const source = `${row.city || ''} ${row.district || ''}`.toLowerCase();
  if (source.includes('مصراتة') || source.includes('مصراته') || source.includes('misrata')) return 'Misrata';
  if (source.includes('طرابلس') || source.includes('tripoli')) return 'Tripoli';
  return row.city || 'Other / City not set';
}

function countBy(rows, key) {
  return [...rows.reduce((counts, row) => {
    const value = row[key] || 'Not set';
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapeCdata(value) {
  return String(value ?? '').replaceAll(']]>', ']]]]><![CDATA[>');
}

function downloadTextFile(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function compressImageFile(file) {
  if (!file?.type?.startsWith('image/')) return file;

  const maxDimension = 1600;
  const quality = 0.78;
  let bitmap;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    }
  } catch {
    bitmap = null;
  }

  if (!bitmap) {
    const objectUrl = URL.createObjectURL(file);
    try {
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (typeof bitmap.close === 'function') bitmap.close();

  const compressed = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!compressed) return file;

  return new File([compressed], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

async function uploadPhotoFile(file, folder, recordId) {
  if (!file || !supabase) return '';
  const uploadFile = await compressImageFile(file);
  const extension = uploadFile.type === 'image/jpeg' ? 'jpg' : (uploadFile.name.split('.').pop() || 'jpg');
  const path = `${folder}/${recordId}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, uploadFile, { upsert: true, contentType: uploadFile.type });
  if (error) throw error;
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function kmlTypeLabel(type) {
  if (type === 'buildings') return 'بناية';
  if (type === 'poles') return 'عمود';
  return 'زراعة عمود';
}

function kmlStyleId(type) {
  if (type === 'buildings') return 'buildingStyle';
  if (type === 'poles') return 'poleStyle';
  return 'plantingStyle';
}

function readCell(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function excelYesNoToBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['yes', 'true', '1', 'نعم', 'ظ†ط¹ظ…'].includes(normalized);
}

function getWorksheetRows(workbook, sheetNames) {
  const normalizedNames = new Map(workbook.SheetNames.map((name) => [name.trim().toLowerCase(), name]));
  const sheetName = sheetNames.map((name) => normalizedNames.get(name.trim().toLowerCase())).find(Boolean);
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
}

function dedupeRowsById(rows) {
  const byId = new Map();
  let duplicates = 0;
  for (const row of rows) {
    const id = String(row.id || '').trim();
    if (!id) continue;
    if (byId.has(id)) duplicates += 1;
    byId.set(id, { ...row, id });
  }
  return { rows: [...byId.values()], duplicates };
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function finalizeImportRows(parsedRows) {
  let duplicateCount = 0;
  const deduped = {};
  for (const [type, rows] of Object.entries(parsedRows)) {
    const result = dedupeRowsById(rows);
    deduped[type] = result.rows;
    duplicateCount += result.duplicates;
  }
  return { rows: deduped, duplicateCount };
}

async function readKmlFromFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.kmz')) return file.text();
  const zip = await JSZip.loadAsync(file);
  const entry = Object.values(zip.files).find((item) => !item.dir && item.name.toLowerCase().endsWith('.kml'));
  if (!entry) throw new Error('لم يتم العثور على ملف KML داخل KMZ.');
  return entry.async('text');
}

function parseKmlPoints(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('ملف KML غير صالح.');
  const points = [];
  xml.querySelectorAll('Placemark').forEach((placemark, index) => {
    const coordinateNode = placemark.querySelector('Point coordinates, coordinates');
    const raw = coordinateNode?.textContent?.trim() || '';
    const firstCoordinate = raw.split(/\s+/).find(Boolean) || '';
    const [longitude, latitude] = firstCoordinate.split(',').map(Number);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    points.push({
      id: `PLAN-${Date.now()}-${String(index + 1).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      latitude,
      longitude,
      point_name: placemark.querySelector('name')?.textContent?.trim() || `Point ${index + 1}`,
    });
  });
  return points;
}

function buildRowsFromWorkbook(workbook) {
  const buildingRows = getWorksheetRows(workbook, ['Buildings', 'Building', 'بنايات', 'اضافه بنايه']);
  const poleRows = getWorksheetRows(workbook, ['Poles', 'Pole', 'اعمدة', 'اضافه عمود']);
  const plantingRows = getWorksheetRows(workbook, ['New Pole Planting', 'Column Checks', 'زراعه عمود', 'زراعة عمود جديد']);

  return {
    buildings: buildingRows
      .map((row) => ({
        id: readCell(row, ['ID']) || makeRecordId('buildings'),
        latitude: toNumberOrNull(readCell(row, ['Latitude', 'latitude'])),
        longitude: toNumberOrNull(readCell(row, ['Longitude', 'longitude'])),
        city: readCell(row, ['City', 'city']),
        building_type: readCell(row, ['Building type', 'building_type']),
        floor_number: toNumberOrNull(readCell(row, ['Floor number', 'floor_number'])),
        users_number: toNumberOrNull(readCell(row, ['Users number', 'users_number'])),
        building_status: readCell(row, ['Building status', 'building_status']),
        district: readCell(row, ['district', 'District']),
        tech_name: readCell(row, ['tech name', 'Technician', 'tech_name']),
        survey_date: today,
        notes: readCell(row, ['Notes', 'notes']),
        photo_url: readCell(row, ['Photo URL', 'photo_url']),
      }))
      .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)),
    poles: poleRows
      .map((row) => ({
        id: readCell(row, ['ID']) || makeRecordId('poles'),
        latitude: toNumberOrNull(readCell(row, ['Latitude', 'latitude'])),
        longitude: toNumberOrNull(readCell(row, ['Longitude', 'longitude'])),
        city: readCell(row, ['City', 'city']),
        pole_owner: readCell(row, ['Pole owner', 'pole_owner']),
        pole_type: readCell(row, ['Pole type', 'pole_type']),
        pole_length: toNumberOrNull(readCell(row, ['Pole length', 'pole_length'])),
        pole_status: readCell(row, ['Pole Status', 'pole_status']),
        district: readCell(row, ['district', 'District']),
        tech_name: readCell(row, ['tech name', 'Technician', 'tech_name']),
        survey_date: today,
        notes: readCell(row, ['Notes', 'notes']),
        photo_url: readCell(row, ['Photo URL', 'photo_url']),
      }))
      .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)),
    column_checks: plantingRows
      .map((row) => ({
        id: readCell(row, ['ID']) || makeRecordId('column_checks'),
        latitude: toNumberOrNull(readCell(row, ['Latitude', 'latitude'])),
        longitude: toNumberOrNull(readCell(row, ['Longitude', 'longitude'])),
        city: readCell(row, ['City', 'city']),
        district: readCell(row, ['district', 'District']),
        tech_name: readCell(row, ['tech name', 'Technician', 'tech_name']),
        has_objection: excelYesNoToBoolean(readCell(row, [labels.has_objection, 'has_objection', 'Has objection'])),
        is_existing: excelYesNoToBoolean(readCell(row, [labels.is_existing, 'is_existing', 'Is existing'])),
        is_planted: excelYesNoToBoolean(readCell(row, [labels.is_planted, 'is_planted', 'Is planted'])),
        notes: readCell(row, ['Notes', 'notes', labels.notes]),
        photo_url: readCell(row, ['Photo URL', 'photo_url']),
      }))
      .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)),
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

function MapResizeSync({ expanded }) {
  const map = useMap();

  useEffect(() => {
    const resize = () => map.invalidateSize({ animate: false });
    resize();
    const first = window.setTimeout(resize, 80);
    const second = window.setTimeout(resize, 250);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [map, expanded]);

  return null;
}

function SurveyMarkers({ groupedRecords, onDelete, canDelete }) {
  return Object.entries(groupedRecords).flatMap(([type, rows]) =>
    rows.map((row) => (
      <Marker key={`${type}-${row.id}`} position={[row.latitude, row.longitude]} icon={markerIcons[type]}>
        <Popup>
          <div className="markerPopup">
            <strong>{getResourceUiSingular(type)}</strong>
            <span>{row.id}</span>
            <span>{row.district || '-'}</span>
            <span>{row.tech_name || '-'}</span>
            <span>{formatDate(row.created_at || row.survey_date)} {formatTime(row.created_at)}</span>
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

function FastSurveyMarkers({ groupedRecords, onDelete, canDelete }) {
  function renderPopup(type, row) {
    return (
      <Popup>
        <div className="markerPopup">
            <strong>{getResourceUiSingular(type)}</strong>
            <span>{row.id}</span>
            <span>الإحداثيات: {row.latitude}, {row.longitude}</span>
            <span>{row.district || '-'}</span>
            <span>{row.tech_name || '-'}</span>
            <span>{formatDate(row.created_at || row.survey_date)} {formatTime(row.created_at)}</span>
            {row.photo_url && (
              <a href={row.photo_url} target="_blank" rel="noreferrer">
                <img className="popupPhoto" src={row.photo_url} alt={`صورة ${getResourceUiSingular(type)} ${row.id}`} loading="lazy" />
                فتح الصورة
              </a>
            )}
          {canDelete && (
            <button type="button" className="dangerMini" onClick={() => onDelete(type, row.id)}>
              Delete point
            </button>
          )}
        </div>
      </Popup>
    );
  }

  return Object.entries(groupedRecords).flatMap(([type, rows]) =>
    rows.map((row) => (
      <CircleMarker
        key={`${type}-${row.id}`}
        center={[row.latitude, row.longitude]}
        radius={type === 'buildings' ? 7 : 6}
        renderer={canvasRenderer}
        pathOptions={{
          color: '#ffffff',
          fillColor: markerColors[type],
          fillOpacity: 0.9,
          opacity: 0.95,
          weight: 2,
        }}
      >
        {renderPopup(type, row)}
      </CircleMarker>
    )),
  );
}

function PolePlantingDashboard({ records, onRefresh, busy, onDelete }) {
  const [filters, setFilters] = useState({ city: '', district: '', tech: '', status: 'all' });

  const sourceRows = useMemo(
    () => (records || []).map((row) => ({ ...normalizeRow(row, 'column_checks'), city: inferCity(row) })),
    [records],
  );

  const cityOptions = useMemo(() => [...new Set(sourceRows.map((row) => row.city))].sort(), [sourceRows]);
  const districtOptions = useMemo(
    () => [...new Set(sourceRows.filter((row) => !filters.city || row.city === filters.city).map((row) => row.district).filter(Boolean))].sort(),
    [sourceRows, filters.city],
  );
  const techOptions = useMemo(() => [...new Set(sourceRows.map((row) => row.tech_name).filter(Boolean))].sort(), [sourceRows]);

  const filteredRows = useMemo(() => sourceRows.filter((row) => {
    if (filters.city && row.city !== filters.city) return false;
    if (filters.district && row.district !== filters.district) return false;
    if (filters.tech && row.tech_name !== filters.tech) return false;
    if (filters.status === 'planted' && !yesNoToBoolean(row.is_planted)) return false;
    if (filters.status === 'not_planted' && yesNoToBoolean(row.is_planted)) return false;
    if (filters.status === 'objection' && !yesNoToBoolean(row.has_objection)) return false;
    return true;
  }), [sourceRows, filters]);

  const summary = useMemo(() => ({ total: filteredRows.length }), [filteredRows]);

  const technicians = useMemo(() => countBy(filteredRows, 'tech_name'), [filteredRows]);
  const cities = useMemo(() => countBy(filteredRows, 'city'), [filteredRows]);
  const cityCounts = useMemo(() => Object.fromEntries(cities), [cities]);
  const districts = useMemo(() => {
    const groups = new Map();
    filteredRows.forEach((row) => {
      const key = `${row.city}|||${row.district || 'Not set'}`;
      const current = groups.get(key) || { city: row.city, district: row.district || 'Not set', total: 0, planted: 0, objections: 0 };
      current.total += 1;
      current.planted += yesNoToBoolean(row.is_planted) ? 1 : 0;
      current.objections += yesNoToBoolean(row.has_objection) ? 1 : 0;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => b.total - a.total || a.city.localeCompare(b.city));
  }, [filteredRows]);

  const mapRows = filteredRows
    .filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)))
    .slice(0, MAX_MAP_MARKERS);
  const centerRow = mapRows[0];
  const mapCenter = centerRow ? [Number(centerRow.latitude), Number(centerRow.longitude)] : [defaultLocation.latitude, defaultLocation.longitude];
  const maxTechnicianCount = Math.max(technicians[0]?.[1] || 1, 1);
  const maxCityCount = Math.max(cities[0]?.[1] || 1, 1);

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value, ...(key === 'city' ? { district: '' } : {}) }));
  }

  return (
    <section className="plantingDashboard" aria-label="Pole planting dashboard">
      <div className="dashboardHero">
        <div>
          <p className="dashboardEyebrow">Field Operations</p>
          <h2>Pole Planting Dashboard</h2>
          <p>Track planting progress, technicians, cities, and districts from one clear view.</p>
        </div>
        <div className="dashboardHeroActions">
          <span className="dashboardLive"><span /> Live data</span>
          <button type="button" className="dashboardRefresh" onClick={onRefresh} disabled={busy}>
            <RefreshCcw size={17} />
            {busy ? 'Refreshing...' : 'Refresh data'}
          </button>
        </div>
      </div>

      <div className="dashboardFilters">
        <div className="dashboardFilterTitle"><Filter size={17} /> Filters</div>
        <label>City<select value={filters.city} onChange={(event) => updateFilter('city', event.target.value)}><option value="">All cities</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        <label>District<select value={filters.district} onChange={(event) => updateFilter('district', event.target.value)}><option value="">All districts</option>{districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
        <label>Technician<select value={filters.tech} onChange={(event) => updateFilter('tech', event.target.value)}><option value="">All technicians</option>{techOptions.map((tech) => <option key={tech} value={tech}>{tech}</option>)}</select></label>
        <label>Status<select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="all">All statuses</option><option value="planted">Planted</option><option value="not_planted">Not planted</option><option value="objection">With objection</option></select></label>
      </div>

      <div className="dashboardKpis">
        <article className="dashboardKpi kpiBlue"><span><MapPin size={18} /> Misrata poles</span><strong>{cityCounts.Misrata || 0}</strong><small>Planting records</small></article>
        <article className="dashboardKpi kpiViolet"><span><MapPinned size={18} /> Tripoli poles</span><strong>{cityCounts.Tripoli || 0}</strong><small>Planting records</small></article>
        <article className="dashboardKpi kpiGreen"><span><Target size={18} /> Total poles</span><strong>{summary.total}</strong><small>All filtered records</small></article>
      </div>

      <div className="dashboardMainGrid">
        <article className="dashboardPanel dashboardMapPanel">
          <div className="dashboardPanelHead"><div><h3>Planting map</h3><span>{mapRows.length}{filteredRows.length > MAX_MAP_MARKERS ? ` of ${filteredRows.length}` : ''} points shown</span></div><MapPinned size={20} /></div>
          <div className="dashboardMapWrap">
            <MapContainer center={mapCenter} zoom={12} maxZoom={22} scrollWheelZoom className="dashboardMap" zoomControl>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={22} maxNativeZoom={19} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FastSurveyMarkers groupedRecords={{ column_checks: mapRows }} onDelete={onDelete} canDelete />
            </MapContainer>
          </div>
        </article>

        <article className="dashboardPanel dashboardListPanel">
          <div className="dashboardPanelHead"><div><h3>By technician</h3><span>Number of planting records</span></div><BarChart3 size={20} /></div>
          {technicians.length ? technicians.slice(0, 8).map(([name, count]) => (
            <div className="dashboardBarRow" key={name}>
              <div><strong>{name}</strong><span>{count} points</span></div>
              <div className="dashboardBar"><i style={{ width: `${Math.max((count / maxTechnicianCount) * 100, 5)}%` }} /></div>
            </div>
          )) : <div className="dashboardEmpty">No technician data for the selected filters.</div>}
        </article>
      </div>

      <div className="dashboardSecondaryGrid">
        <article className="dashboardPanel">
          <div className="dashboardPanelHead"><div><h3>By city</h3><span>Misrata, Tripoli, and other groups</span></div><MapPin size={20} /></div>
          {cities.length ? <div className="cityCards">{cities.map(([city, count]) => <div className="cityCard" key={city}><div><strong>{city}</strong><span>{count} points</span></div><div className="cityProgress"><i style={{ width: `${Math.max((count / maxCityCount) * 100, 5)}%` }} /></div></div>)}</div> : <div className="dashboardEmpty">No city data for the selected filters.</div>}
        </article>

        <article className="dashboardPanel districtPanel">
          <div className="dashboardPanelHead"><div><h3>District breakdown</h3><span>City and district performance</span></div><ClipboardList size={20} /></div>
          <div className="dashboardMiniTableWrap"><table className="dashboardMiniTable"><thead><tr><th>City</th><th>District</th><th>Total</th><th>Planted</th><th>Objections</th></tr></thead><tbody>{districts.slice(0, 12).map((item) => <tr key={`${item.city}-${item.district}`}><td>{item.city}</td><td>{item.district}</td><td>{item.total}</td><td className="successText">{item.planted}</td><td className="dangerText">{item.objections}</td></tr>)}{!districts.length && <tr><td colSpan="5" className="dashboardEmptyCell">No district data.</td></tr>}</tbody></table></div>
        </article>
      </div>

      <article className="dashboardPanel dashboardRecentPanel">
        <div className="dashboardPanelHead"><div><h3>Recent pole planting records</h3><span>Latest points matching the current filters</span></div><span className="dashboardResultCount">{filteredRows.length} records</span></div>
        <div className="dashboardRecentWrap"><table className="dashboardRecentTable"><thead><tr><th>ID</th><th>City</th><th>District</th><th>Technician</th><th>Planted</th><th>Objection</th><th>Date</th><th>Location</th></tr></thead><tbody>{filteredRows.slice(0, 15).map((row) => <tr key={row.id}><td className="idCell">{row.id}</td><td>{row.city}</td><td>{row.district || '-'}</td><td>{row.tech_name || '-'}</td><td><span className={`statusPill ${yesNoToBoolean(row.is_planted) ? 'statusGood' : 'statusWarn'}`}>{yesNoToBoolean(row.is_planted) ? 'Yes' : 'No'}</span></td><td><span className={`statusPill ${yesNoToBoolean(row.has_objection) ? 'statusBad' : 'statusGood'}`}>{yesNoToBoolean(row.has_objection) ? 'Yes' : 'No'}</span></td><td>{row.record_date} {row.record_time}</td><td dir="ltr">{row.latitude}, {row.longitude}</td></tr>)}{!filteredRows.length && <tr><td colSpan="8" className="dashboardEmptyCell">No records for the selected filters.</td></tr>}</tbody></table></div>
      </article>
    </section>
  );
}

function DesignWorkspace({ profile, plannedRows, plantingRows, onUpload, onRefresh, onLogout, busy }) {
  const [city, setCity] = useState(profile.city || 'Misrata');
  const [district, setDistrict] = useState(profile.district || '');
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const text = await readKmlFromFile(file);
      const points = parseKmlPoints(text);
      if (!points.length) throw new Error('لم يتم العثور على نقاط داخل الملف.');
      await onUpload(points, { city, district, fileName: file.name });
    } catch (uploadError) {
      setError(uploadError.message);
    }
  }

  const pending = plannedRows.filter((row) => row.validation_status === 'pending').length;
  const validated = plannedRows.filter((row) => ['validated', 'planted'].includes(row.validation_status)).length;

  return (
    <main className="app adminMode">
      <header className="topbar">
        <div><p className="eyebrow">Site Survey Pro</p><h1>Design Workspace</h1></div>
        <div className="actions">
          <div className="profilePill"><UserRound size={17} /><span>{profile.techName}</span><strong>Design</strong></div>
          <button className="ghost" type="button" onClick={onLogout}><LogOut size={18} /> Logout</button>
          <button className="ghost" type="button" onClick={onRefresh} disabled={busy}><RefreshCcw size={18} /> Refresh</button>
        </div>
      </header>

      <section className="stats">
        <article><Upload size={19} /><span>Imported points</span><strong>{plannedRows.length}</strong></article>
        <article><Target size={19} /><span>Pending validation</span><strong>{pending}</strong></article>
        <article><CheckCircle2 size={19} /><span>Validated / planted</span><strong>{validated}</strong></article>
      </section>

      <section className="records" style={{ padding: 20, marginBottom: 16 }}>
        <div className="recordsHeader"><div><h2>Upload KMZ plan</h2><span>Files are stored as pending validation points.</span></div></div>
        <div className="fieldGrid" style={{ marginTop: 14 }}>
          <label>City<select value={city} onChange={(event) => setCity(event.target.value)}><option value="Misrata">Misrata</option><option value="Tripoli">Tripoli</option></select></label>
          <label>District<input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="Optional district" /></label>
        </div>
        <label className="ghost fileButton" style={{ marginTop: 14, display: 'inline-flex' }}>
          <Upload size={18} /> {busy ? 'Uploading...' : 'Choose KMZ / KML'}
          <input type="file" accept=".kmz,.kml,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" onChange={handleFile} disabled={busy || !city} />
        </label>
        {error && <div className="notice" style={{ marginTop: 14 }}>{error}</div>}
      </section>

      <section className="records">
        <div className="recordsHeader"><h2>Planned poles</h2><span>{plannedRows.length} points</span></div>
        <div className="tableWrap"><table><thead><tr><th>ID</th><th>Name</th><th>City</th><th>District</th><th>Latitude</th><th>Longitude</th><th>Status</th></tr></thead><tbody>
          {plannedRows.slice(0, 500).map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.point_name || '-'}</td><td>{row.city || '-'}</td><td>{row.district || '-'}</td><td>{row.latitude}</td><td>{row.longitude}</td><td>{row.validation_status}</td></tr>)}
          {!plannedRows.length && <tr><td colSpan="7" className="empty">No planned points yet.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="records" style={{ marginTop: 16 }}>
        <div className="recordsHeader"><h2>Planting records</h2><span>{plantingRows.length} records</span></div>
        <div className="tableWrap"><table><thead><tr><th>ID</th><th>City</th><th>District</th><th>Technician</th><th>Planted</th><th>Date</th></tr></thead><tbody>
          {plantingRows.slice(0, 200).map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.city || '-'}</td><td>{row.district || '-'}</td><td>{row.tech_name || '-'}</td><td>{booleanToYesNo(row.is_planted)}</td><td>{row.record_date || '-'}</td></tr>)}
          {!plantingRows.length && <tr><td colSpan="6" className="empty">No planting records yet.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  );
}

function EngineerMap({ rows, selectedId, onSelect, onMapClick }) {
  const first = rows.find((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)));
  const center = first ? [Number(first.latitude), Number(first.longitude)] : [defaultLocation.latitude, defaultLocation.longitude];
  useMapEvents({ click: (event) => onMapClick(event.latlng) });
  return (
    <MapContainer center={center} zoom={14} maxZoom={22} scrollWheelZoom className="map" zoomControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={22} maxNativeZoom={19} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {rows.map((row) => {
        const statusColor = row.validation_status === 'validated' ? '#16a34a' : row.validation_status === 'planted' ? '#2563eb' : row.validation_status === 'rejected' ? '#dc2626' : '#f59e0b';
        return <CircleMarker key={row.id} center={[Number(row.latitude), Number(row.longitude)]} radius={row.id === selectedId ? 11 : 7} pathOptions={{ color: statusColor, fillColor: statusColor, fillOpacity: 0.85, weight: row.id === selectedId ? 4 : 2 }} eventHandlers={{ click: () => onSelect(row.id) }} />;
      })}
    </MapContainer>
  );
}

function EngineerWorkspace({ profile, plannedRows, onRefresh, onLogout, onValidate, onAdd, busy }) {
  const [selectedId, setSelectedId] = useState(plannedRows[0]?.id || '');
  const [status, setStatus] = useState('validated');
  const [notes, setNotes] = useState('');
  const [city, setCity] = useState(profile.city || 'Misrata');
  const [district, setDistrict] = useState(profile.district || '');
  const [addMode, setAddMode] = useState(false);
  const [message, setMessage] = useState('');
  const selected = plannedRows.find((row) => row.id === selectedId) || null;

  useEffect(() => {
    if (!selected && plannedRows[0]) setSelectedId(plannedRows[0].id);
  }, [plannedRows, selected]);

  useEffect(() => {
    setStatus(selected?.validation_status === 'rejected' ? 'rejected' : 'validated');
    setNotes(selected?.validation_notes || '');
  }, [selectedId, selected?.validation_status, selected?.validation_notes]);

  async function saveSelected() {
    if (!selected) return;
    setMessage('');
    try {
      await onValidate(selected, { status, notes });
      setMessage('تم حفظ قرار الـ Validation.');
    } catch (error) {
      setMessage(`تعذر الحفظ: ${error.message}`);
    }
  }

  async function handleMapClick(latlng) {
    if (addMode) {
      try {
        const created = await onAdd({ latitude: latlng.lat, longitude: latlng.lng, city, district });
        setSelectedId(created.id);
        setAddMode(false);
        setMessage('تمت إضافة نقطة جديدة بحالة Pending.');
      } catch (error) {
        setMessage(`تعذر إضافة النقطة: ${error.message}`);
      }
      return;
    }
    if (!selected) return;
    try {
      await onValidate(selected, { status, notes, latitude: latlng.lat, longitude: latlng.lng });
      setMessage('تم تحديث موقع النقطة وحفظه.');
    } catch (error) {
      setMessage(`تعذر تحريك النقطة: ${error.message}`);
    }
  }

  const pending = plannedRows.filter((row) => row.validation_status === 'pending');
  return (
    <main className="app adminMode">
      <header className="topbar"><div><p className="eyebrow">Site Survey Pro</p><h1>Engineer Validation</h1></div><div className="actions"><div className="profilePill"><UserRound size={17} /><span>{profile.techName}</span><strong>Engineer</strong></div><button className="ghost" type="button" onClick={onLogout}><LogOut size={18} /> Logout</button><button className="ghost" type="button" onClick={onRefresh} disabled={busy}><RefreshCcw size={18} /> Refresh</button></div></header>
      <section className="stats"><article><Target size={19} /><span>Pending</span><strong>{pending.length}</strong></article><article><CheckCircle2 size={19} /><span>Validated</span><strong>{plannedRows.filter((row) => row.validation_status === 'validated').length}</strong></article><article><X size={19} /><span>Rejected</span><strong>{plannedRows.filter((row) => row.validation_status === 'rejected').length}</strong></article></section>
      {message && <div className="notice">{message}</div>}
      <section className="workspace">
        <div className="mapShell" style={{ minHeight: 650 }}><EngineerMap rows={plannedRows} selectedId={selectedId} onSelect={setSelectedId} onMapClick={handleMapClick} /><div className="limitBadge">{addMode ? 'اضغط على الخريطة لإضافة نقطة' : 'اضغط على نقطة ثم اضغط على الخريطة لتحريكها'}</div></div>
        <section className="panel open" style={{ position: 'relative' }}>
          <div className="panelHeader"><div><p>Engineer review</p><h2>Validation queue</h2><span className="autoId">{plannedRows.length} planned points</span></div><Target color="#2563eb" /></div>
          <div className="fieldGrid"><label>City<select value={city} onChange={(event) => setCity(event.target.value)}><option value="Misrata">Misrata</option><option value="Tripoli">Tripoli</option></select></label><label>District<input value={district} onChange={(event) => setDistrict(event.target.value)} /></label></div>
          <label style={{ marginTop: 14 }}>Point<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select point...</option>{plannedRows.map((row) => <option key={row.id} value={row.id}>{row.point_name || row.id} - {row.validation_status}</option>)}</select></label>
          {selected && <><div className="coordinateGrid"><label>Latitude<input value={selected.latitude} readOnly /></label><label>Longitude<input value={selected.longitude} readOnly /></label></div><label>Decision<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="validated">Validate</option><option value="rejected">Reject</option></select></label><label>Notes<textarea rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button className="save" type="button" onClick={saveSelected} disabled={busy}>Save decision</button></>}
          <button className="ghost" type="button" style={{ width: '100%', marginTop: 12 }} onClick={() => setAddMode((value) => !value)}>{addMode ? 'Cancel add point' : 'Add point on map'}</button>
        </section>
      </section>
    </main>
  );
}

function SupervisorWorkspace({ profile, plannedRows, onRefresh, onLogout, onPlant, busy }) {
  const available = plannedRows.filter((row) => ['validated', 'planted'].includes(row.validation_status));
  const [selectedId, setSelectedId] = useState(available[0]?.id || '');
  const [hasObjection, setHasObjection] = useState('لا');
  const [isExisting, setIsExisting] = useState('لا');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [message, setMessage] = useState('');
  const selected = available.find((row) => row.id === selectedId) || null;

  useEffect(() => {
    if (!selected && available[0]) setSelectedId(available[0].id);
  }, [available, selected]);

  async function submit() {
    if (!selected || selected.validation_status === 'planted') return;
    setMessage('');
    try {
      await onPlant(selected, { hasObjection: hasObjection === 'نعم', isExisting: isExisting === 'نعم', notes, photoFile });
      setPhotoFile(null);
      setMessage('تم تسجيل زراعة العمود بنجاح.');
    } catch (error) {
      setMessage(`تعذر الحفظ: ${error.message}`);
    }
  }

  return (
    <main className="app adminMode">
      <header className="topbar"><div><p className="eyebrow">Site Survey Pro</p><h1>Supervisor Planting</h1></div><div className="actions"><div className="profilePill"><UserRound size={17} /><span>{profile.techName}</span><strong>Supervisor</strong></div><button className="ghost" type="button" onClick={onLogout}><LogOut size={18} /> Logout</button><button className="ghost" type="button" onClick={onRefresh} disabled={busy}><RefreshCcw size={18} /> Refresh</button></div></header>
      <section className="stats"><article><CheckCircle2 size={19} /><span>Validated points</span><strong>{available.filter((row) => row.validation_status === 'validated').length}</strong></article><article><MapPin size={19} /><span>Planted</span><strong>{available.filter((row) => row.validation_status === 'planted').length}</strong></article><article><Camera size={19} /><span>Photos</span><strong>{available.filter((row) => row.is_planted && row.photo_url).length}</strong></article></section>
      {message && <div className="notice">{message}</div>}
      <section className="workspace">
      <div className="mapShell" style={{ minHeight: 650 }}><EngineerMap rows={available} selectedId={selectedId} onSelect={setSelectedId} onMapClick={() => {}} /><div className="limitBadge">الأخضر: معتمد · الأزرق: تمت زراعته</div></div>
      <section className="records" style={{ padding: 20 }}>
        <div className="recordsHeader"><div><h2>Validated planting points</h2><span>Only engineer-approved points are shown.</span></div></div>
        <label style={{ marginTop: 14 }}>Point<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select point...</option>{available.map((row) => <option key={row.id} value={row.id}>{row.point_name || row.id} - {row.validation_status}</option>)}</select></label>
        {selected && <>
          <div className="coordinateGrid"><label>Latitude<input value={selected.latitude} readOnly /></label><label>Longitude<input value={selected.longitude} readOnly /></label></div>
          <div className="fieldGrid"><label>هل عليه اعتراض<select value={hasObjection} onChange={(event) => setHasObjection(event.target.value)}><option>لا</option><option>نعم</option></select></label><label>هل هو موجود<select value={isExisting} onChange={(event) => setIsExisting(event.target.value)}><option>لا</option><option>نعم</option></select></label></div>
          <label style={{ marginTop: 14 }}>ملاحظة<textarea rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <label className="photoBox" style={{ marginTop: 14 }}><Camera size={22} /><span>{photoFile ? photoFile.name : 'التقاط صورة للعمود'}</span><input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} /></label>
          <button className="save" type="button" onClick={submit} disabled={busy || selected.validation_status === 'planted'}>{selected.validation_status === 'planted' ? 'تمت الزراعة' : (busy ? 'جارٍ الحفظ...' : 'تسجيل الزراعة')}</button>
        </>}
        {!available.length && <div className="empty" style={{ marginTop: 20 }}>لا توجد نقاط معتمدة من المهندس حتى الآن.</div>}
      </section>
      </section>
      <section className="records" style={{ marginTop: 16 }}><div className="recordsHeader"><h2>Point list</h2><span>{available.length} points</span></div><div className="tableWrap"><table><thead><tr><th>ID</th><th>City</th><th>District</th><th>Status</th></tr></thead><tbody>{available.slice(0, 500).map((row) => <tr key={row.id} onClick={() => setSelectedId(row.id)}><td>{row.id}</td><td>{row.city || '-'}</td><td>{row.district || '-'}</td><td>{row.validation_status}</td></tr>)}</tbody></table></div></section>
    </main>
  );
}

function App() {
  const [profile, setProfile] = useState(readSavedProfile);
  const [active, setActive] = useState('buildings');
  const [forms, setForms] = useState(() => makeEmptyForms(readSavedProfile()));
  const [records, setRecords] = useState({ buildings: [], poles: [], column_checks: [] });
  const [plannedRows, setPlannedRows] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [adminFilters, setAdminFilters] = useState({ district: '', techName: '', type: 'all' });
  const [adminPage, setAdminPage] = useState('data');

  const isAdmin = profile?.role === 'admin';
  const isStaffRole = ['design', 'engineer', 'supervisor'].includes(profile?.role);
  const current = resources[active];
  const form = forms[active];

  const scopedRecords = useMemo(() => {
    const filtered = {};
    for (const [type, rows] of Object.entries(records)) {
      filtered[type] = rows
        .map((row) => normalizeRow(row, type))
        .filter((row) => {
          if (isStaffRole) return true;
          if (!isAdmin) return row.tech_name === profile?.techName && row.district === profile?.district;
          if (adminFilters.type !== 'all' && adminFilters.type !== type) return false;
          if (adminFilters.district && row.district !== adminFilters.district) return false;
          if (adminFilters.techName && row.tech_name !== adminFilters.techName) return false;
          if (query && !JSON.stringify(row).toLowerCase().includes(query.toLowerCase())) return false;
          return true;
        });
    }
    return filtered;
  }, [records, isAdmin, isStaffRole, profile, adminFilters, query]);

  const currentRows = scopedRecords[active] || [];
  const displayedRows = currentRows.slice(0, MAX_TABLE_ROWS);
  const hiddenTableRows = Math.max(currentRows.length - displayedRows.length, 0);
  const allVisibleRows = useMemo(
    () => Object.entries(scopedRecords).flatMap(([type, rows]) => rows.map((row) => ({ ...row, _type: type }))),
    [scopedRecords],
  );
  const mapRecords = useMemo(() => {
    let remaining = MAX_MAP_MARKERS;
    return Object.fromEntries(
      Object.entries(scopedRecords).map(([type, rows]) => {
        const limitedRows = rows.slice(0, Math.max(remaining, 0));
        remaining -= limitedRows.length;
        return [type, limitedRows];
      }),
    );
  }, [scopedRecords]);
  const mapMarkerCount = useMemo(
    () => Object.values(mapRecords).reduce((sum, rows) => sum + rows.length, 0),
    [mapRecords],
  );
  const hiddenMapMarkers = Math.max(allVisibleRows.length - mapMarkerCount, 0);
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

  useEffect(() => {
    let mounted = true;
    if (!supabase) return undefined;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted || !data.session || profile) return;
      const { data: account } = await supabase
        .from('user_profiles')
        .select('username, display_name, role, city, district, active')
        .eq('id', data.session.user.id)
        .single();
      if (!mounted || !account?.active) return;
      const nextProfile = {
        username: account.username,
        techName: account.display_name || account.username,
        city: account.city || '',
        district: account.district || '',
        role: account.role,
      };
      setProfile(nextProfile);
      setForms(makeEmptyForms(nextProfile));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('map-fullscreen-active', mapExpanded);
    return () => document.body.classList.remove('map-fullscreen-active');
  }, [mapExpanded]);

  async function saveProfile(loginDetails) {
    if (loginDetails.legacyAdmin) {
      const nextProfile = { techName: loginDetails.username.trim() || 'Admin', district: 'ALL', role: 'admin' };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
      setForms(makeEmptyForms(nextProfile));
      setMessage('تم الدخول كأدمن.');
      return;
    }

    if (!hasSupabaseConfig || !supabase) throw new Error('إعدادات Supabase غير موجودة.');
    const username = loginDetails.username.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: internalAuthEmail(username),
      password: loginDetails.password,
    });
    if (error) throw error;

    const { data: account, error: accountError } = await supabase
      .from('user_profiles')
      .select('username, display_name, role, city, district, active')
      .eq('id', data.user.id)
      .single();
    if (accountError) {
      await supabase.auth.signOut();
      throw accountError;
    }
    if (!account.active) {
      await supabase.auth.signOut();
      throw new Error('هذا المستخدم غير مفعّل.');
    }

    const nextProfile = {
      username: account.username,
      techName: account.display_name || account.username,
      city: account.city || '',
      district: account.district || '',
      role: account.role,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setForms(makeEmptyForms(nextProfile));
    setMessage(`تم الدخول بصلاحية ${roleLabel(nextProfile.role)}.`);
  }

  async function changeProfile() {
    if (supabase) await supabase.auth.signOut();
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
      const { data: planned, error: plannedError } = await supabase
        .from('planned_poles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (plannedError && plannedError.code !== '42P01') throw plannedError;
      setRecords(nextRecords);
      setPlannedRows(planned || []);
      setMessage('تم تحديث البيانات بنجاح.');
    } catch (error) {
      setMessage(`تعذر تحميل البيانات: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPlannedPoints(points, metadata) {
    if (!hasSupabaseConfig || !supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const rows = points.map((point) => ({
        ...point,
        city: metadata.city,
        district: metadata.district || null,
        created_by: profile.username || profile.techName,
        validation_status: 'pending',
      }));
      const { error } = await supabase.from('planned_poles').insert(rows);
      if (error) throw error;
      setPlannedRows((currentRows) => [...rows, ...currentRows]);
      setMessage(`تم رفع ${rows.length} نقطة من ${metadata.fileName}.`);
    } finally {
      setBusy(false);
    }
  }

  async function validatePlannedPole(row, changes) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('engineer_update_planned_pole', {
        p_id: row.id,
        p_latitude: changes.latitude ?? row.latitude,
        p_longitude: changes.longitude ?? row.longitude,
        p_status: changes.status,
        p_notes: changes.notes || null,
      });
      if (error) throw error;
      setPlannedRows((currentRows) => currentRows.map((item) => item.id === row.id ? data : item));
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function addPlannedPole(point) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('engineer_add_planned_pole', {
        p_latitude: point.latitude,
        p_longitude: point.longitude,
        p_city: point.city,
        p_district: point.district || null,
        p_name: null,
      });
      if (error) throw error;
      setPlannedRows((currentRows) => [data, ...currentRows]);
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function plantPlannedPole(row, details) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const provisionalId = `plant-${row.id}`;
      const photoUrl = details.photoFile ? await uploadPhotoFile(details.photoFile, 'column_checks', provisionalId) : '';
      const { data, error } = await supabase.rpc('supervisor_plant_planned_pole', {
        p_id: row.id,
        p_has_objection: details.hasObjection,
        p_is_existing: details.isExisting,
        p_notes: details.notes || null,
        p_photo_url: photoUrl || null,
      });
      if (error) throw error;
      setPlannedRows((currentRows) => currentRows.map((item) => item.id === row.id ? data.planned : item));
      setRecords((currentRecords) => ({ ...currentRecords, column_checks: [data.record, ...currentRecords.column_checks] }));
      return data;
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
    const uploadFile = await compressImageFile(photoFile);
    const extension = uploadFile.type === 'image/jpeg' ? 'jpg' : (uploadFile.name.split('.').pop() || 'jpg');
    const path = `${active}/${recordId}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, uploadFile, { upsert: true, contentType: uploadFile.type });
    if (error) throw error;
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function mergeSavedRecord(type, savedRow) {
    setRecords((previous) => {
      const currentTypeRows = previous[type] || [];
      return {
        ...previous,
        [type]: [savedRow, ...currentTypeRows.filter((row) => row.id !== savedRow.id)],
      };
    });
  }

  function mergeSavedRecords(nextRecords) {
    setRecords((previous) => {
      const merged = { ...previous };
      for (const [type, rows] of Object.entries(nextRecords)) {
        if (!rows.length) continue;
        const savedIds = new Set(rows.map((row) => row.id));
        merged[type] = [...rows, ...(previous[type] || []).filter((row) => !savedIds.has(row.id))];
      }
      return merged;
    });
  }

  async function importExcel(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isAdmin) return;
    if (!hasSupabaseConfig) {
      setMessage('لا يمكن الرفع قبل إضافة إعدادات Supabase.');
      return;
    }

    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const importData = finalizeImportRows(buildRowsFromWorkbook(workbook));
      const parsedRows = importData.rows;
      const totalRows = Object.values(parsedRows).reduce((sum, rows) => sum + rows.length, 0);
      if (!totalRows) throw new Error('لم يتم العثور على نقاط صالحة. تأكد من وجود Latitude و Longitude واسم الشيت الصحيح.');

      let visibleBudget = MAX_IMPORTED_RECORDS_TO_RENDER;
      const visibleRows = { buildings: [], poles: [], column_checks: [] };
      for (const [type, rows] of Object.entries(parsedRows)) {
        if (!rows.length) continue;
        for (const chunk of chunkRows(rows, IMPORT_BATCH_SIZE)) {
          const { error } = await supabase.from(resources[type].table).upsert(chunk, { onConflict: 'id' });
          if (error) throw error;
        }
        if (visibleBudget > 0) {
          const previewRows = rows.slice(0, visibleBudget).map((row) => ({ ...row, created_at: new Date().toISOString() }));
          visibleRows[type] = previewRows;
          visibleBudget -= previewRows.length;
        }
      }

      mergeSavedRecords(visibleRows);
      setMessage(`تم رفع ${totalRows} نقطة من ملف Excel بنجاح.`);
    } catch (error) {
      setMessage(`تعذر رفع ملف Excel: ${error.message}`);
    } finally {
      setBusy(false);
    }
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

      if (active === 'column_checks') delete payload.survey_date;

      ['has_objection', 'is_existing', 'is_planted'].forEach((key) => {
        if (key in payload) payload[key] = yesNoToBoolean(payload[key]);
      });

      ['floor_number', 'users_number'].forEach((key) => {
        if (key in payload) payload[key] = payload[key] === '' ? null : Number(payload[key]);
      });
      if ('pole_length' in payload) payload.pole_length = payload.pole_length === '' ? null : Number(payload.pole_length);

      const { data, error } = await supabase.from(current.table).upsert(payload, { onConflict: 'id' }).select('*').single();
      if (error) throw error;

      mergeSavedRecord(active, data || { ...payload, created_at: new Date().toISOString() });
      setForms((previous) => ({
        ...previous,
        [active]: applyProfileToForm(
          {
            ...current.empty,
            latitude: payload.latitude,
            longitude: payload.longitude,
          },
          profile,
        ),
      }));
      setPhotoFile(null);
      setFormDrawerOpen(false);
      setMessage(`تم حفظ ${current.singular} بنجاح.`);
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
      Buildings: scopedRecords.buildings.map((row) => ({
        ID: row.id,
        Latitude: row.latitude,
        Longitude: row.longitude,
        City: row.city || '',
        'Building type': row.building_type || '',
        'Floor number': row.floor_number ?? '',
        'Users number': row.users_number ?? '',
        'Building status': row.building_status || '',
        district: row.district || '',
        'tech name': row.tech_name || '',
        date: row.record_date,
        time: row.record_time,
        Notes: row.notes || '',
        'Photo URL': row.photo_url || '',
      })),
      Poles: scopedRecords.poles.map((row) => ({
        ID: row.id,
        Latitude: row.latitude,
        Longitude: row.longitude,
        City: row.city || '',
        'Pole owner': row.pole_owner || '',
        'Pole type': row.pole_type || '',
        'Pole length': row.pole_length ?? '',
        'Pole Status': row.pole_status || '',
        district: row.district || '',
        'tech name': row.tech_name || '',
        date: row.record_date,
        time: row.record_time,
        Notes: row.notes || '',
        'Photo URL': row.photo_url || '',
      })),
      'New Pole Planting': scopedRecords.column_checks.map((row) => ({
        ID: row.id,
        Latitude: row.latitude,
        Longitude: row.longitude,
        City: row.city || '',
        district: row.district || '',
        'tech name': row.tech_name || '',
        date: row.record_date,
        time: row.record_time,
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

  function exportKml() {
    const rows = allVisibleRows.filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)));

    const placemarks = rows
      .map((row) => {
        const label = kmlTypeLabel(row._type);
        const description = [
          `<b>Type:</b> ${escapeXml(label)}`,
          `<b>ID:</b> ${escapeXml(row.id)}`,
          `<b>District:</b> ${escapeXml(row.district || '-')}`,
          `<b>Technician:</b> ${escapeXml(row.tech_name || '-')}`,
          `<b>Date:</b> ${escapeXml(row.record_date || '-')}`,
          `<b>Time:</b> ${escapeXml(row.record_time || '-')}`,
          row.notes ? `<b>Notes:</b> ${escapeXml(row.notes)}` : '',
          row.photo_url ? `<b>Photo:</b> <a href="${escapeXml(row.photo_url)}">Open photo</a>` : '',
        ].filter(Boolean).join('<br/>');

        return `
      <Placemark>
        <name>${escapeXml(`${label} - ${row.id}`)}</name>
        <styleUrl>#${kmlStyleId(row._type)}</styleUrl>
        <description><![CDATA[${escapeCdata(description)}]]></description>
        <Point>
          <coordinates>${Number(row.longitude)},${Number(row.latitude)},0</coordinates>
        </Point>
      </Placemark>`;
      })
      .join('');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Site Survey Filtered Export</name>
    <Style id="buildingStyle">
      <IconStyle>
        <color>ff2626dc</color>
        <scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/homegardenbusiness.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="poleStyle">
      <IconStyle>
        <color>ff111111</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="plantingStyle">
      <IconStyle>
        <color>ff7c3aed</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/target.png</href></Icon>
      </IconStyle>
    </Style>${placemarks}
  </Document>
</kml>`;

    downloadTextFile(kml, `site-survey-${formatDate(new Date())}.kml`, 'application/vnd.google-earth.kml+xml;charset=utf-8');
  }

  if (!profile) {
    return <LoginPage onSave={saveProfile} />;
  }

  if (profile.role === 'design') {
    return <DesignWorkspace profile={profile} plannedRows={plannedRows} plantingRows={records.column_checks} onUpload={uploadPlannedPoints} onRefresh={loadAll} onLogout={changeProfile} busy={busy} />;
  }

  if (profile.role === 'engineer') {
    return <EngineerWorkspace profile={profile} plannedRows={plannedRows} onRefresh={loadAll} onLogout={changeProfile} onValidate={validatePlannedPole} onAdd={addPlannedPole} busy={busy} />;
  }

  if (profile.role === 'supervisor') {
    return <SupervisorWorkspace profile={profile} plannedRows={plannedRows} onRefresh={loadAll} onLogout={changeProfile} onPlant={plantPlannedPole} busy={busy} />;
  }

  return (
    <main className={`app ${isAdmin ? 'adminMode' : ''} ${isAdmin && adminPage === 'dashboard' ? 'dashboardMode' : ''}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Site Survey Pro</p>
          <h1>{isAdmin ? 'Admin Dashboard' : 'خريطة الرفع الميداني'}</h1>
        </div>
        <div className="actions">
          <div className="profilePill" title="بيانات المستخدم الحالية">
            <UserRound size={17} />
            <span>{profile.techName}</span>
            <strong>{isAdmin ? 'Admin' : `${profile.city} · ${profile.district}`}</strong>
          </div>
          <button className="ghost" type="button" onClick={changeProfile} aria-label="Logout">
            <LogOut size={18} />
            Logout
          </button>
          <button className="ghost" type="button" onClick={loadAll} disabled={busy}>
            <RefreshCcw size={18} />
            Refresh
          </button>
          {isAdmin && (
            <>
              <button className="ghost" type="button" onClick={exportExcel}>
                <Download size={18} />
                Excel
              </button>
              <button className="ghost" type="button" onClick={exportKml}>
                <Download size={18} />
                KML
              </button>
              <label className={`ghost fileButton ${busy ? 'disabled' : ''}`}>
                <Upload size={18} />
                Upload Excel
                <input type="file" accept=".xlsx,.xls" onChange={importExcel} disabled={busy} />
              </label>
            </>
          )}
        </div>
      </header>

      {(!isAdmin || adminPage !== 'dashboard') && <section className="stats">
        <article>
          <ClipboardList size={19} />
          <span>Buildings</span>
          <strong>{totals.buildings}</strong>
        </article>
        <article>
          <MapPin size={19} />
          <span>Poles</span>
          <strong>{totals.poles}</strong>
        </article>
        <article>
          <CheckCircle2 size={19} />
          <span>Pole Planting</span>
          <strong>{totals.column_checks}</strong>
        </article>
      </section>}

      {isAdmin && (
        <section className="adminPages" aria-label="Admin pages">
          <button type="button" className={adminPage === 'dashboard' ? 'active' : ''} onClick={() => setAdminPage('dashboard')}>
            Dashboard
          </button>
          <button type="button" className={adminPage === 'data' ? 'active' : ''} onClick={() => setAdminPage('data')}>
            Data
          </button>
          <button type="button" className={adminPage === 'photos' ? 'active' : ''} onClick={() => setAdminPage('photos')}>
            Photos
            <span>{visiblePhotos.length}</span>
          </button>
        </section>
      )}

      {isAdmin && adminPage === 'dashboard' && (
        <PolePlantingDashboard records={records.column_checks} onRefresh={loadAll} busy={busy} onDelete={deleteRecord} />
      )}

      {(!isAdmin || adminPage !== 'dashboard') && isAdmin && (
        <section className="adminFilters">
          <label>
            District
            <select value={adminFilters.district} onChange={(event) => setAdminFilters((prev) => ({ ...prev, district: event.target.value }))}>
              <option value="">All districts</option>
              {adminOptions.districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </label>
          <label>
            Technician
            <select value={adminFilters.techName} onChange={(event) => setAdminFilters((prev) => ({ ...prev, techName: event.target.value }))}>
              <option value="">All technicians</option>
              {adminOptions.techs.map((tech) => <option key={tech} value={tech}>{tech}</option>)}
            </select>
          </label>
          <label>
            Type
            <select value={adminFilters.type} onChange={(event) => setAdminFilters((prev) => ({ ...prev, type: event.target.value }))}>
              <option value="all">All types</option>
              {Object.entries(resources).map(([key]) => <option key={key} value={key}>{getResourceUiLabel(key)}</option>)}
            </select>
          </label>
          <label className="search">
            <Search size={17} />
            <input placeholder="Search..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </section>
      )}

      {(!isAdmin || adminPage !== 'dashboard') && <nav className="tabs" aria-label="Survey sections">
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
            {getResourceUiLabel(key)}
          </button>
        ))}
      </nav>}

      {message && (!isAdmin || adminPage !== 'dashboard') && <div className="notice">{message}</div>}

      {(!isAdmin || adminPage !== 'dashboard') && <section className="workspace">
        <div className={`mapShell ${mapExpanded ? 'expandedMap' : ''}`}>
          <button
            className="mapExpandButton"
            type="button"
            onClick={() => setMapExpanded((expanded) => !expanded)}
            title={mapExpanded ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}
            aria-label={mapExpanded ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}
          >
            {mapExpanded ? <Minimize2 size={19} /> : <Expand size={19} />}
          </button>
          <button className="mapAddButton" type="button" onClick={() => setFormDrawerOpen(true)}>
            <Plus size={18} />
            إضافة
          </button>
          <button className="logoutButton" type="button" onClick={changeProfile} aria-label="تسجيل الخروج">
            <LogOut size={18} />
            خروج
          </button>
          <MapContainer
            center={[form.latitude, form.longitude]}
            zoom={18}
            maxZoom={22}
            scrollWheelZoom
            zoomControl={false}
            className="map"
            rotate
            touchRotate
            rotateControl={{ closeOnZeroBearing: false, position: 'topright' }}
            bearing={0}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={22}
              maxNativeZoom={19}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapCenterSync value={form} onChange={setLocation} />
            <MapResizeSync expanded={mapExpanded} />
            <FastSurveyMarkers groupedRecords={mapRecords} onDelete={deleteRecord} canDelete />
          </MapContainer>
          {hiddenMapMarkers > 0 && (
            <div className="limitBadge">
              تظهر {mapMarkerCount} نقطة فقط لتسريع العرض.
            </div>
          )}
          <div className="fixedPin" aria-hidden="true">
            <MapPin size={36} />
          </div>
          <div className="mapControls">
            <button type="button" onClick={() => requestCurrentLocation(false)}>
              <LocateFixed size={17} />
              موقعي
            </button>
            <span>{form.latitude}, {form.longitude}</span>
          </div>
        </div>

        <form className={`panel ${formDrawerOpen ? 'open' : ''}`} onSubmit={saveRecord}>
          <div className="drawerTabs" aria-label="Choose record type">
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
                {getResourceUiLabel(key)}
              </button>
            ))}
          </div>

          <div className="panelHeader">
            <div>
              <p>سجل جديد</p>
              <h2>{getResourceUiLabel(active)}</h2>
              <span className="autoId">ID تلقائي, {formatDate(new Date())} {formatTime(new Date())}</span>
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
            {busy ? 'جارٍ الحفظ...' : 'حفظ السجل'}
          </button>
        </form>
      </section>}

      {isAdmin && adminPage === 'photos' && (
        <section className="photosPage">
          <div className="recordsHeader">
            <h2>Photos</h2>
            <span>{visiblePhotos.length} photos</span>
          </div>
          <div className="photoGrid">
            {visiblePhotos.map((row) => (
              <article className="photoCard" key={`${row._type}-${row.id}`}>
                <a href={row.photo_url} target="_blank" rel="noreferrer">
                  <img src={row.photo_url} alt={`${getResourceUiSingular(row._type)} ${row.id}`} loading="lazy" />
                </a>
                <div>
                  <strong>{getResourceUiSingular(row._type)}</strong>
                  <span>ID: {row.id}</span>
                  <span>المنطقة: {row.district || '-'}</span>
                  <span>الفني: {row.tech_name || '-'}</span>
                  <span>التاريخ: {row.record_date}</span>
                  <span>الوقت: {row.record_time}</span>
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
          <h2>{isAdmin ? 'All Records' : 'سجلاتي'}</h2>
          {hiddenTableRows > 0 && <span className="softHint">يظهر أول {MAX_TABLE_ROWS} من {currentRows.length} فقط. استخدم الفلاتر لعرض أدق.</span>}
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
                <th>حذف</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => (
                <tr key={row.id}>
                  {current.columns.map((column) => (
                    <td key={column} className={column === 'notes' ? 'notesCell' : ''}>
                      {column === 'photo_url'
                        ? (row.photo_url ? (
                          <a className="tablePhoto" href={row.photo_url} target="_blank" rel="noreferrer" title="فتح الصورة">
                            <img src={row.photo_url} alt={`صورة ${getResourceUiSingular(active)} ${row.id}`} loading="lazy" />
                            <span>رابط الصورة</span>
                          </a>
                        ) : '-')
                        : formatValue(row[column])}
                    </td>
                  ))}
                  <td>
                    <button className="dangerIcon" type="button" onClick={() => deleteRecord(active, row.id)} title="حذف">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!currentRows.length && (
                <tr>
                  <td colSpan={current.columns.length + 1} className="empty">لا توجد سجلات حسب المستخدم والمنطقة الحالية.</td>
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (adminMode) {
      if (adminPin !== ADMIN_PIN) {
        setError('كود الأدمن غير صحيح.');
        return;
      }
      await onSave({ username: username.trim() || 'Admin', legacyAdmin: true });
      return;
    }
    if (!username.trim() || !password) {
      setError('أدخل اسم المستخدم وكلمة المرور.');
      return;
    }
    setLoading(true);
    try {
      await onSave({ username, password });
    } catch (submitError) {
      setError(submitError.message === 'Invalid login credentials' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : `تعذر تسجيل الدخول: ${submitError.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={submit}>
        <div className="loginIcon">
          <UserRound size={30} />
        </div>
        <p className="eyebrow">Site Survey Pro</p>
        <h1>{adminMode ? 'دخول الأدمن' : 'تسجيل الدخول'}</h1>
        <p className="loginText">استخدم اسم المستخدم وكلمة المرور الخاصة بك.</p>

        <label className="check adminSwitch">
          <input type="checkbox" checked={adminMode} onChange={(event) => setAdminMode(event.target.checked)} />
          <span>تسجيل دخول كأدمن</span>
        </label>

        <label>
          اسم المستخدم
          <input autoFocus value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" />
        </label>
        {!adminMode && (
          <label>
            كلمة المرور
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" />
          </label>
        )}
        {adminMode && (
          <label>
            رمز الأدمن
            <input type="password" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="رمز الأدمن" />
          </label>
        )}

        {error && <div className="notice">{error}</div>}

        <button className="save" type="submit" disabled={loading || (adminMode ? !adminPin.trim() : !username.trim() || !password)}>
          {loading ? 'جارٍ الدخول...' : 'دخول التطبيق'}
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
