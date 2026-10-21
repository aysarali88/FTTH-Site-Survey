import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Camera,
  BarChart3,
  Activity,
  CheckCircle2,
  ClipboardList,
  Download,
  Expand,
  Filter,
  LocateFixed,
  LogOut,
  Menu,
  MapPin,
  MapPinned,
  Minimize2,
  Plus,
  RefreshCcw,
  Search,
  Target,
  Trash2,
  Upload,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { CircleMarker, LayersControl, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
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
const DATA_PAGE_SIZE = 1000;
const MAX_IMPORTED_RECORDS_TO_RENDER = 500;
const MAX_MAP_MARKERS = 2000;
const MAX_IMPORTED_ASSETS_TO_RENDER = 3500;
const MAX_TABLE_ROWS = 500;
const CITY_DISTRICTS = {
  Misrata: ['مقاوبه', 'ولاد بعيو', 'راس عمار', 'البيره والتعليم', 'راس التوته', 'راس علي', 'المنقوش', 'ولاد ابو شعاله', 'رويسات', 'مقاصبه'],
  Tripoli: ['المنصوره', 'حي الاندلس 1', 'حي الاندلس 2', 'حي الاندلس 3', 'شارع الظل', 'نوفلين'],
};
const LEGACY_AREA_OPTIONS = [
  { city: 'Misrata', district: 'راس عمار' },
  { city: 'Misrata', district: 'راس علي' },
  { city: 'Tripoli', district: 'شارع الظل' },
  { city: 'Tripoli', district: 'حي الاندلس 2' },
  { city: 'Tripoli', district: 'المنصوره' },
];

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
    management: 'Management',
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

function cleanDistrictName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function districtKey(value) {
  return cleanDistrictName(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function districtAlias(value, city) {
  const key = districtKey(value);
  if (districtKey(city) === 'طرابلس' || districtKey(city) === 'tripoli') {
    if (key === 'حيالاندلسم١' || key === 'حيالاندلس1') return 'حي الاندلس 1';
    if (key === 'حيالاندلس' || key === 'حيالندلس2' || key === 'حيالاندلس2') return 'حي الاندلس 2';
    if (key === 'حيالاندلس٣' || key === 'حيالاندلس3') return 'حي الاندلس 3';
  }
  if (districtKey(city) === 'مصراته' || districtKey(city) === 'misrata') {
    if (key === 'all') return 'مقاوبه';
  }
  if (key === 'ولادابعيو') return 'ولاد بعيو';
  return cleanDistrictName(value);
}

function similarityScore(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function canonicalizeDistricts(recordGroups) {
  const groups = new Map();
  Object.values(recordGroups).flat().forEach((row) => {
    const raw = districtAlias(row.district, inferCity(row));
    if (!raw) return;
    const city = inferCity(row);
    const groupKey = `${districtKey(city)}|${districtKey(raw)}`;
    const current = groups.get(groupKey) || { city, raw, count: 0 };
    current.count += 1;
    groups.set(groupKey, current);
  });

  const canonicalByCity = new Map();
  [...groups.values()].sort((a, b) => b.count - a.count).forEach((item) => {
    const cityKey = districtKey(item.city);
    const candidates = canonicalByCity.get(cityKey) || [];
    const key = districtKey(item.raw);
    const match = candidates.find((candidate) => key === districtKey(candidate) || (Math.min(key.length, districtKey(candidate)) >= 6 && similarityScore(key, districtKey(candidate)) >= 0.9));
    if (match) item.canonical = match;
    else {
      item.canonical = item.raw;
      candidates.push(item.canonical);
      canonicalByCity.set(cityKey, candidates);
    }
  });

  const normalized = {};
  const changes = [];
  Object.entries(recordGroups).forEach(([type, rows]) => {
    normalized[type] = rows.map((row) => {
      if (!row.district) return row;
      const sourceCity = inferCity(row);
      const sourceCityKey = districtKey(sourceCity);
      const rawKey = districtKey(row.district);
      const moveAndalusTwo = sourceCityKey === districtKey('Misrata') && ['حيالاندلس', 'حيالاندلس2', 'حيالندلس2'].includes(rawKey);
      const targetCity = moveAndalusTwo ? 'Tripoli' : sourceCity;
      const candidates = canonicalByCity.get(districtKey(targetCity)) || [];
      const canonical = moveAndalusTwo
        ? 'حي الاندلس 2'
        : candidates.find((candidate) => rawKey === districtKey(candidate) || (Math.min(rawKey.length, districtKey(candidate)) >= 6 && similarityScore(rawKey, districtKey(candidate)) >= 0.9)) || districtAlias(row.district, targetCity);
      if (canonical !== row.district || targetCity !== sourceCity) changes.push({ type, id: row.id, district: canonical, city: targetCity !== sourceCity ? targetCity : undefined });
      return canonical === row.district && targetCity === sourceCity ? row : { ...row, city: targetCity, district: canonical };
    });
  });
  return { normalized, changes };
}

function resolveDistrict(value, city, recordGroups) {
  const cleaned = districtAlias(value, city);
  if (!cleaned) return '';
  const candidates = Object.values(recordGroups).flat()
    .filter((row) => districtKey(inferCity(row)) === districtKey(city) && row.district)
    .map((row) => row.district);
  const unique = [...new Set(candidates)];
  const key = districtKey(cleaned);
  return unique.find((candidate) => districtKey(candidate) === key)
    || unique.find((candidate) => Math.min(key.length, districtKey(candidate)) >= 6 && similarityScore(key, districtKey(candidate)) >= 0.9)
    || cleaned;
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

async function fetchAllRows(buildQuery) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + DATA_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    if (!page.length) break;
    rows.push(...page);
    offset += page.length;
  }
  return rows.reverse();
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

function parseKmlCoordinates(raw) {
  return raw
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [longitude, latitude] = token.split(',').map(Number);
      return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
    })
    .filter(Boolean);
}

function kmlStyleKey(placemark) {
  return placemark.querySelector('styleUrl')?.textContent?.trim().replace(/^#/, '') || '';
}

function kmlStyleLabel(styleKey) {
  return styleKey
    .replace(/^style_/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlannedPoleStyle(styleKey) {
  return /(?:new|planned)[_\s-]*poles?/i.test(styleKey);
}

function kmlColor(color, fallback = '#475569') {
  const value = String(color || '').trim();
  if (!/^[\da-f]{8}$/i.test(value)) return { color: fallback, opacity: 1 };
  const alpha = Number.parseInt(value.slice(0, 2), 16) / 255;
  const blue = value.slice(2, 4);
  const green = value.slice(4, 6);
  const red = value.slice(6, 8);
  return { color: `#${red}${green}${blue}`, opacity: alpha };
}

function parseKmlStyle(styleNode) {
  const iconStyle = styleNode.querySelector('IconStyle');
  const labelStyle = styleNode.querySelector('LabelStyle');
  const lineStyle = styleNode.querySelector('LineStyle');
  const polyStyle = styleNode.querySelector('PolyStyle');
  const iconColor = kmlColor(iconStyle?.querySelector('color')?.textContent, '#475569');
  const labelColor = kmlColor(labelStyle?.querySelector('color')?.textContent, '#0f172a');
  const lineColor = kmlColor(lineStyle?.querySelector('color')?.textContent, '#db2777');
  const polygonColor = kmlColor(polyStyle?.querySelector('color')?.textContent, '#94a3b8');
  const iconScale = Number(iconStyle?.querySelector('scale')?.textContent || 1);
  const labelScale = Number(labelStyle?.querySelector('scale')?.textContent || 1);
  const lineWidth = Number(lineStyle?.querySelector('width')?.textContent || 2);
  return {
    icon: {
      href: iconStyle?.querySelector('Icon href')?.textContent?.trim() || '',
      ...iconColor,
      scale: Number.isFinite(iconScale) ? iconScale : 1,
    },
    label: { ...labelColor, scale: Number.isFinite(labelScale) ? labelScale : 1 },
    line: { ...lineColor, width: Number.isFinite(lineWidth) ? lineWidth : 2 },
    polygon: {
      ...polygonColor,
      fill: polyStyle?.querySelector('fill')?.textContent !== '0',
      outline: polyStyle?.querySelector('outline')?.textContent !== '0',
    },
  };
}

function parseKmlExtendedData(placemark) {
  const properties = {};
  placemark.querySelectorAll('ExtendedData Data').forEach((node) => {
    const key = node.getAttribute('name');
    const value = node.querySelector('value')?.textContent?.trim();
    if (key && value) properties[key] = value;
  });
  placemark.querySelectorAll('ExtendedData SimpleData').forEach((node) => {
    const key = node.getAttribute('name');
    const value = node.textContent?.trim();
    if (key && value) properties[key] = value;
  });
  return properties;
}

function parseKmlGeometryNode(node) {
  const geometryType = node.localName;
  if (geometryType === 'Point') {
    const coordinate = parseKmlCoordinates(node.querySelector('coordinates')?.textContent || '')[0];
    return coordinate ? [{ geometry_type: 'point', coordinates: coordinate }] : [];
  }
  if (geometryType === 'LineString') {
    const coordinates = parseKmlCoordinates(node.querySelector('coordinates')?.textContent || '');
    return coordinates.length >= 2 ? [{ geometry_type: 'line', coordinates }] : [];
  }
  if (geometryType === 'Polygon') {
    const rings = Array.from(node.querySelectorAll('LinearRing coordinates'))
      .map((ring) => parseKmlCoordinates(ring.textContent || ''))
      .filter((ring) => ring.length >= 3);
    return rings.length ? [{ geometry_type: 'polygon', coordinates: rings.length === 1 ? rings[0] : rings }] : [];
  }
  if (geometryType === 'MultiGeometry') {
    return Array.from(node.children).flatMap((child) => parseKmlGeometryNode(child));
  }
  return [];
}

function parseKmlPlacemarkGeometries(placemark) {
  return Array.from(placemark.children)
    .filter((child) => ['Point', 'LineString', 'Polygon', 'MultiGeometry'].includes(child.localName))
    .flatMap((child) => parseKmlGeometryNode(child));
}

function parseKmlDocument(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('ملف KML غير صالح.');
  const points = [];
  const paths = [];
  const assets = [];
  let pointIndex = 0;
  let pathIndex = 0;
  let assetIndex = 0;
  const placemarks = Array.from(xml.querySelectorAll('Placemark'));
  const hasStyledFeatures = placemarks.some((placemark) => Boolean(kmlStyleKey(placemark)));
  const styles = new Map(Array.from(xml.querySelectorAll('Style[id]')).map((node) => [node.id, parseKmlStyle(node)]));
  const styleMaps = new Map(Array.from(xml.querySelectorAll('StyleMap[id]')).map((node) => {
    const normal = Array.from(node.querySelectorAll('Pair')).find((pair) => pair.querySelector('key')?.textContent?.trim() === 'normal');
    return [node.id, normal?.querySelector('styleUrl')?.textContent?.trim().replace(/^#/, '') || ''];
  }));
  function styleDataFor(key) {
    let resolvedKey = key;
    const visited = new Set();
    while (styleMaps.has(resolvedKey) && !visited.has(resolvedKey)) {
      visited.add(resolvedKey);
      resolvedKey = styleMaps.get(resolvedKey);
    }
    return styles.get(resolvedKey) || {};
  }
  placemarks.forEach((placemark) => {
    const name = placemark.querySelector('name')?.textContent?.trim() || '';
    const styleKey = kmlStyleKey(placemark);
    const styleLabel = kmlStyleLabel(styleKey);
    const styleData = styleDataFor(styleKey);
    const properties = parseKmlExtendedData(placemark);
    const featureName = name || properties.ID || properties.Id || properties.id || styleLabel;
    parseKmlPlacemarkGeometries(placemark).forEach((geometry, geometryIndex) => {
      if (geometry.geometry_type === 'point' && (isPlannedPoleStyle(styleKey) || (!styleKey && !hasStyledFeatures))) {
        const [latitude, longitude] = geometry.coordinates;
        pointIndex += 1;
        points.push({
          id: `PLAN-${Date.now()}-${String(pointIndex).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          latitude,
          longitude,
          point_name: name || properties.ID || properties.Id || properties.id || `Point ${pointIndex}`,
        });
        return;
      }
      if (geometry.geometry_type === 'line') {
        pathIndex += 1;
        paths.push({
          id: `ROUTE-${Date.now()}-${String(pathIndex).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          path_name: name || properties.ID || properties.Id || properties.id || styleLabel || `Cable route ${pathIndex}`,
          path_part: geometryIndex + 1,
          style_key: styleKey,
          style_data: styleData,
          properties,
          coordinates: geometry.coordinates,
        });
        return;
      }
      assetIndex += 1;
      assets.push({
        id: `ASSET-${Date.now()}-${String(assetIndex).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        asset_type: geometry.geometry_type,
        asset_name: featureName || `Imported feature ${assetIndex}`,
        style_key: styleKey,
        style_data: styleData,
        properties,
        coordinates: geometry.coordinates,
      });
    });
  });
  return { points, paths, assets };
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
    const timers = [80, 250, 600].map((delay) => window.setTimeout(resize, delay));
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(map.getContainer());
    window.addEventListener('resize', resize);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [map, expanded]);

  return null;
}

function MapFullscreenControl() {
  const map = useMap();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const frame = map.getContainer().parentElement;
    frame?.classList.toggle('expandedMap', expanded);
    document.body.classList.toggle('map-fullscreen-active', expanded);

    return () => {
      frame?.classList.remove('expandedMap');
      document.body.classList.remove('map-fullscreen-active');
    };
  }, [map, expanded]);

  return <>
    <button
      className="mapExpandButton"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setExpanded((value) => !value);
      }}
      title={expanded ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}
      aria-label={expanded ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}
      aria-pressed={expanded}
    >
      {expanded ? <Minimize2 size={19} /> : <Expand size={19} />}
    </button>
    <MapResizeSync expanded={expanded} />
  </>;
}

function CurrentLocationControl({ onLocated }) {
  const map = useMap();
  const [position, setPosition] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  function locate() {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع.');
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = {
          latitude: Number(coords.latitude.toFixed(7)),
          longitude: Number(coords.longitude.toFixed(7)),
        };
        setPosition([next.latitude, next.longitude]);
        map.flyTo([next.latitude, next.longitude], Math.max(map.getZoom(), 17), { animate: true, duration: 0.8 });
        onLocated?.(next);
        setLocating(false);
      },
      () => {
        setError('لم يتم السماح بالوصول إلى موقع الجهاز.');
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  return <>
    <div className="mapLocationControl">
      <button className={locating ? 'locating' : ''} type="button" onClick={locate} title="موقعي" aria-label="تحديد موقعي">
        <LocateFixed size={20} />
      </button>
      {error && <span className="mapLocationError" role="alert">{error}</span>}
    </div>
    {position && <CircleMarker center={position} radius={8} pathOptions={{ color: '#ffffff', fillColor: '#2563eb', fillOpacity: 0.95, weight: 3 }} />}
  </>;
}

function MapLayers() {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="Satellite">
        <TileLayer
          className="satelliteTiles"
          attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a>'
          maxZoom={22}
          maxNativeZoom={19}
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Street map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={22}
          maxNativeZoom={19}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}

function KmlMapLabel({ text, style = {} }) {
  const scale = Number(style.scale);
  if (!text) return null;
  const fontSize = Math.max(8, Math.min(11, 9 * (Number.isFinite(scale) && scale > 0 ? scale : 1)));
  return (
    <Tooltip permanent direction="center" className="kmzMapLabel" opacity={1}>
      <span style={{ color: style.color || '#16a34a', opacity: style.opacity ?? 1, fontSize: `${fontSize}px` }}>{text}</span>
    </Tooltip>
  );
}

function importedFeatureLabel(name, styleKey, properties = {}) {
  const normalizedStyle = kmlStyleLabel(styleKey).replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedName = String(name || '').replace(/\s+/g, ' ').trim();
  if (normalizedName && normalizedName.toLowerCase() !== normalizedStyle) return normalizedName;
  return properties.ID || properties.Id || properties.id || properties.Name || properties.name || '';
}

function CablePaths({ paths = [] }) {
  return paths.map((path) => {
    const label = importedFeatureLabel(path.path_name, path.style_key, path.properties);
    return (
      <Polyline
        key={path.id}
        positions={path.coordinates || []}
        pathOptions={{ color: path.style_data?.line?.color || importedAssetMeta(path).color, opacity: (path.style_data?.line?.opacity ?? 1) * 0.95, weight: Math.max(2, Math.min(Number(path.style_data?.line?.width) || 4, 8)) }}
      >
        <Popup>
          <div className="mapPointPopup" dir="rtl">
            <strong>{path.path_name || label || 'Cable route'}</strong>
            <span>مسار كابل</span>
            {Object.entries(path.properties || {}).slice(0, 8).map(([key, value]) => <span key={key}><b>{key}:</b> {value}</span>)}
          </div>
        </Popup>
      </Polyline>
    );
  });
}

function importedAssetMeta(asset = {}) {
  const key = `${asset.style_key || ''} ${asset.asset_name || asset.path_name || ''}`.toLowerCase();
  let fallback;
  if (key.includes('building')) fallback = { color: '#f97316', fillColor: '#fb923c', label: 'Buildings' };
  else if (key.includes('new') && key.includes('pole')) fallback = { color: '#16a34a', fillColor: '#22c55e', label: 'New poles' };
  else if (key.includes('pole')) fallback = { color: '#2563eb', fillColor: '#60a5fa', label: 'Poles' };
  else if (key.includes('customer')) fallback = { color: '#64748b', fillColor: '#94a3b8', label: 'Customers' };
  else if (key.includes('box') || key.includes('core') || key.includes('hub')) fallback = { color: '#7c3aed', fillColor: '#a78bfa', label: 'Boxes' };
  else if (key.includes('tree')) fallback = { color: '#15803d', fillColor: '#4ade80', label: 'Trees' };
  else if (key.includes('problem') || key.includes('probleme')) fallback = { color: '#dc2626', fillColor: '#f87171', label: 'Problems' };
  else if (key.includes('cable') || key.includes('route') || key.includes('feeder')) fallback = { color: '#db2777', fillColor: '#f472b6', label: 'Cable routes' };
  else fallback = { color: '#475569', fillColor: '#94a3b8', label: 'Imported design' };
  const style = asset.style_data || {};
  return {
    ...fallback,
    color: style.icon?.color || style.line?.color || style.polygon?.color || fallback.color,
    fillColor: style.polygon?.color || style.icon?.color || fallback.fillColor,
    opacity: style.icon?.opacity ?? style.line?.opacity ?? style.polygon?.opacity ?? 1,
    iconScale: Number(style.icon?.scale) || 1,
    fill: style.polygon?.fill !== false,
    outline: style.polygon?.outline !== false,
  };
}

function flattenMapCoordinates(value) {
  if (!Array.isArray(value)) return [];
  if (typeof value[0] === 'number' && typeof value[1] === 'number') return [[Number(value[0]), Number(value[1])]];
  return value.flatMap((item) => flattenMapCoordinates(item));
}

function ImportedDesignAssets({ assets = [] }) {
  return assets.slice(0, MAX_IMPORTED_ASSETS_TO_RENDER).map((asset) => {
    const meta = importedAssetMeta(asset);
    const label = importedFeatureLabel(asset.asset_name, asset.style_key, asset.properties);
    const showBoxLabel = meta.label === 'Boxes';
    const popupTitle = label || asset.asset_name || meta.label;
    const popup = (
      <Popup>
        <div className="mapPointPopup" dir="rtl">
          <strong>{popupTitle}</strong>
          <span>{meta.label}</span>
          {asset.style_key && <span>{asset.style_key}</span>}
          {Object.entries(asset.properties || {}).slice(0, 12).map(([key, value]) => <span key={key}><b>{key}:</b> {value}</span>)}
        </div>
      </Popup>
    );
    if (asset.asset_type === 'line') {
      return <Polyline key={asset.id} positions={asset.coordinates || []} pathOptions={{ color: asset.style_data?.line?.color || meta.color, opacity: asset.style_data?.line?.opacity ?? 0.72, weight: Math.max(1, Math.min(Number(asset.style_data?.line?.width) || 2, 8)) }}>{popup}</Polyline>;
    }
    if (asset.asset_type === 'polygon') {
      return <Polygon key={asset.id} positions={asset.coordinates || []} pathOptions={{ color: meta.color, fillColor: meta.fillColor, fillOpacity: meta.fill ? meta.opacity : 0, opacity: meta.outline ? meta.opacity : 0, weight: 1 }}>{showBoxLabel && <KmlMapLabel text={label} style={asset.style_data?.label} />}{popup}</Polygon>;
    }
    const iconHref = asset.style_data?.icon?.href || '';
    if (iconHref && !/placemark_circle\.png$/i.test(iconHref)) {
      const size = Math.max(14, Math.min(40, 28 * meta.iconScale));
      const icon = L.icon({
        iconUrl: iconHref.replace(/^http:\/\//i, 'https://'),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });
      return <Marker key={asset.id} position={asset.coordinates || []} icon={icon} opacity={meta.opacity}>{showBoxLabel && <KmlMapLabel text={label} style={asset.style_data?.label} />}{popup}</Marker>;
    }
    return (
      <CircleMarker
        key={asset.id}
        center={asset.coordinates || []}
        radius={Math.max(3, Math.min(7, (meta.label === 'Buildings' ? 4 : 5) * Math.min(meta.iconScale, 1.4)))}
        renderer={canvasRenderer}
        pathOptions={{ color: '#ffffff', fillColor: meta.fillColor, fillOpacity: meta.opacity * 0.86, opacity: 0.9, weight: 1.5 }}
      >
        {showBoxLabel && <KmlMapLabel text={label} style={asset.style_data?.label} />}
        {popup}
      </CircleMarker>
    );
  });
}

function MapFitToContent({ rows = [], paths = [], assets = [] }) {
  const map = useMap();
  const signature = useMemo(
    () => JSON.stringify({
      rows: rows.map((row) => [row.latitude, row.longitude]),
      paths: paths.map((path) => path.coordinates),
      assets: assets.map((asset) => asset.coordinates),
    }),
    [rows, paths, assets],
  );

  useEffect(() => {
    const points = rows
      .map((row) => [Number(row.latitude), Number(row.longitude)])
      .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
    const routePoints = paths.flatMap((path) => path.coordinates || []);
    const assetPoints = assets.flatMap((asset) => flattenMapCoordinates(asset.coordinates));
    const allPoints = [...points, ...routePoints, ...assetPoints];
    if (allPoints.length < 2) return;
    const bounds = L.latLngBounds(allPoints);
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 18, animate: false });
  }, [map, signature]);

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

function PolePlantingDashboard({ records, onRefresh, busy, onDelete, readOnly = false }) {
  const [filters, setFilters] = useState({ city: '', district: '', tech: '', status: 'all', fromDate: '', toDate: '' });

  const sourceRows = useMemo(
    () => (records || []).map((row) => ({ ...normalizeRow(row, 'column_checks'), city: inferCity(row), record_iso_date: (row.created_at || row.survey_date || '').slice(0, 10) })),
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
    if (filters.fromDate && row.record_iso_date < filters.fromDate) return false;
    if (filters.toDate && row.record_iso_date > filters.toDate) return false;
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
  const dailyTotals = useMemo(() => {
    const groups = new Map();
    filteredRows.forEach((row) => {
      const key = `${row.city || 'Other'}|||${row.record_iso_date || 'unknown'}`;
      const current = groups.get(key) || { city: row.city || 'Other', date: row.record_iso_date || 'unknown', total: 0 };
      current.total += 1;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || a.city.localeCompare(b.city));
  }, [filteredRows]);

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
        <label>From date<input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} /></label>
        <label>To date<input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} /></label>
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
            <MapContainer center={mapCenter} zoom={12} maxZoom={22} scrollWheelZoom className="dashboardMap" zoomControl rotate touchRotate rotateControl={{ closeOnZeroBearing: false, position: 'topright' }} bearing={0}>
              <MapLayers />
              <CurrentLocationControl />
              <MapFullscreenControl />
          <FastSurveyMarkers groupedRecords={{ column_checks: mapRows }} onDelete={onDelete} canDelete={!readOnly} />
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
        <div className="dashboardPanelHead"><div><h3>Planting by date</h3><span>Daily totals for the selected filters</span></div><ClipboardList size={20} /></div>
        <div className="dashboardMiniTableWrap"><table className="dashboardMiniTable"><thead><tr><th>City</th><th>Date</th><th>Total planting records</th></tr></thead><tbody>{dailyTotals.map((item) => <tr key={`${item.city}-${item.date}`}><td>{item.city}</td><td>{item.date === 'unknown' ? '-' : formatDate(item.date)}</td><td className="successText">{item.total}</td></tr>)}{!dailyTotals.length && <tr><td colSpan="3" className="dashboardEmptyCell">No date data.</td></tr>}</tbody></table></div>
      </article>

      <article className="dashboardPanel dashboardRecentPanel">
        <div className="dashboardPanelHead"><div><h3>Recent pole planting records</h3><span>Latest points matching the current filters</span></div><span className="dashboardResultCount">{filteredRows.length} records</span></div>
        <div className="dashboardRecentWrap"><table className="dashboardRecentTable"><thead><tr><th>ID</th><th>City</th><th>District</th><th>Technician</th><th>Planted</th><th>Objection</th><th>Date</th><th>Location</th></tr></thead><tbody>{filteredRows.slice(0, 15).map((row) => <tr key={row.id}><td className="idCell">{row.id}</td><td>{row.city}</td><td>{row.district || '-'}</td><td>{row.tech_name || '-'}</td><td><span className={`statusPill ${yesNoToBoolean(row.is_planted) ? 'statusGood' : 'statusWarn'}`}>{yesNoToBoolean(row.is_planted) ? 'Yes' : 'No'}</span></td><td><span className={`statusPill ${yesNoToBoolean(row.has_objection) ? 'statusBad' : 'statusGood'}`}>{yesNoToBoolean(row.has_objection) ? 'Yes' : 'No'}</span></td><td>{row.record_date} {row.record_time}</td><td dir="ltr">{row.latitude}, {row.longitude}</td></tr>)}{!filteredRows.length && <tr><td colSpan="8" className="dashboardEmptyCell">No records for the selected filters.</td></tr>}</tbody></table></div>
      </article>
    </section>
  );
}

function ManagementWorkspace({ plannedRows, plannedRoutes, plannedAssets, plantingRows, activityRows, activityAvailable, onRefresh, busy }) {
  const [activityFilter, setActivityFilter] = useState('all');
  const [search, setSearch] = useState('');

  const summary = useMemo(() => {
    const active = plannedRows.filter((row) => !row.deleted_at);
    return {
      uploaded: new Set([...plannedRows, ...plannedRoutes, ...plannedAssets].map((row) => row.batch_id).filter(Boolean)).size,
      pending: active.filter((row) => row.validation_status === 'pending').length,
      validated: active.filter((row) => row.validation_status === 'validated').length,
      assigned: active.filter((row) => row.validation_status === 'validated' && row.assigned_to).length,
      planted: plantingRows.filter((row) => yesNoToBoolean(row.is_planted)).length,
      fieldRecords: plantingRows.length,
    };
  }, [plannedRows, plannedRoutes, plannedAssets, plantingRows]);

  const batches = useMemo(() => {
    const activityByBatch = new Map(activityRows
      .filter((item) => item.action === 'design_batch_uploaded' && item.batch_id)
      .map((item) => [item.batch_id, item]));
    const grouped = new Map();
    [...plannedRows, ...plannedRoutes, ...plannedAssets].forEach((row) => {
      if (!row.batch_id) return;
      const batch = grouped.get(row.batch_id) || {
        id: row.batch_id,
        city: row.city || '-',
        district: row.district || '-',
        poles: 0,
        routes: 0,
        features: 0,
        uploadedAt: row.created_at || '',
        uploadedBy: row.created_by || '',
      };
      if (row.asset_type) batch.features += 1;
      else if (row.latitude !== undefined) batch.poles += 1;
      else batch.routes += 1;
      if (row.created_at && (!batch.uploadedAt || row.created_at < batch.uploadedAt)) batch.uploadedAt = row.created_at;
      if (!batch.uploadedBy && row.created_by) batch.uploadedBy = row.created_by;
      grouped.set(row.batch_id, batch);
    });
    return [...grouped.values()]
      .map((batch) => {
        const upload = activityByBatch.get(batch.id);
        return {
          ...batch,
          uploadedAt: upload?.occurred_at || batch.uploadedAt,
          uploadedBy: upload?.actor_name || upload?.actor_username || batch.uploadedBy,
        };
      })
      .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  }, [plannedRows, plannedRoutes, plannedAssets, activityRows]);

  const filteredActivity = useMemo(() => activityRows.filter((item) => {
    if (activityFilter !== 'all' && item.action !== activityFilter) return false;
    if (search && !JSON.stringify(item).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [activityRows, activityFilter, search]);

  const recentPlanned = useMemo(() => [...plannedRows]
    .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
    .slice(0, 30), [plannedRows]);
  const recentPlantings = useMemo(() => [...plantingRows]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 30), [plantingRows]);

  return (
    <section className="managementOps">
      <div className="managementOpsHeading">
        <div><span>MANAGEMENT · READ ONLY</span><h2>Operations overview</h2><p>Designer uploads, engineer validation and assignments, and technician field work.</p></div>
        <button className="ghost" type="button" onClick={onRefresh} disabled={busy}><RefreshCcw size={17} /> Refresh</button>
      </div>

      {activityAvailable === false && <div className="notice managementActivityNotice">Activity history will appear after the database migration is published. Current uploaded areas, workflow status, and planting records are shown below.</div>}

      <div className="managementOpsStats">
        <article><Upload size={19} /><span>Active design batches</span><strong>{summary.uploaded}</strong></article>
        <article><Activity size={19} /><span>Pending engineer review</span><strong>{summary.pending}</strong></article>
        <article><CheckCircle2 size={19} /><span>Validated and assigned</span><strong>{summary.assigned} / {summary.validated}</strong></article>
        <article><MapPin size={19} /><span>Technician planted</span><strong>{summary.planted} / {summary.fieldRecords}</strong></article>
      </div>

      <div className="managementOpsGrid">
        <article className="dashboardPanel">
          <div className="dashboardPanelHead"><div><h3>Designer uploads</h3><span>{batches.length} active imported areas</span></div><Upload size={19} /></div>
          <div className="dashboardRecentWrap"><table className="dashboardRecentTable managementTable"><thead><tr><th>Area / batch</th><th>Uploaded by</th><th>Time</th><th>Poles</th><th>Routes</th><th>Features</th></tr></thead><tbody>
            {batches.slice(0, 15).map((batch) => <tr key={batch.id}><td><strong>{batch.city} · {batch.district}</strong><small>{batch.id}</small></td><td>{batch.uploadedBy || '-'}</td><td>{formatDate(batch.uploadedAt)} {formatTime(batch.uploadedAt)}</td><td>{batch.poles}</td><td>{batch.routes}</td><td>{batch.features}</td></tr>)}
            {!batches.length && <tr><td colSpan="6" className="dashboardEmptyCell">No uploaded areas found.</td></tr>}
          </tbody></table></div>
        </article>

        <article className="dashboardPanel">
          <div className="dashboardPanelHead"><div><h3>Engineer workflow</h3><span>Latest 30 of {plannedRows.length} points · current status and technician assignment</span></div><ClipboardList size={19} /></div>
          <div className="dashboardRecentWrap"><table className="dashboardRecentTable managementTable"><thead><tr><th>Point</th><th>Area</th><th>Status</th><th>Validated by</th><th>Assigned to</th><th>Updated</th></tr></thead><tbody>
            {recentPlanned.map((row) => <tr key={row.id}><td className="idCell">{row.point_name || row.id}</td><td>{row.city || '-'} · {row.district || '-'}</td><td><span className={`statusPill ${row.validation_status === 'validated' || row.validation_status === 'planted' ? 'statusGood' : row.validation_status === 'rejected' ? 'statusBad' : 'statusWarn'}`}>{row.validation_status || 'pending'}</span></td><td>{row.validated_by || '-'}</td><td>{row.assigned_to || '-'}</td><td>{formatDate(row.updated_at || row.created_at)} {formatTime(row.updated_at || row.created_at)}</td></tr>)}
            {!recentPlanned.length && <tr><td colSpan="6" className="dashboardEmptyCell">No planned points found.</td></tr>}
          </tbody></table></div>
        </article>
      </div>

      <article className="dashboardPanel managementActivityPanel">
        <div className="dashboardPanelHead"><div><h3>Uploaded design map</h3><span>Read-only preview · {Math.min(plannedRows.length, MAX_MAP_MARKERS)} poles, {Math.min(plannedRoutes.length, MAX_MAP_MARKERS)} routes, {Math.min(plannedAssets.length, MAX_IMPORTED_ASSETS_TO_RENDER)} features</span></div><MapPinned size={19} /></div>
        <div className="managementDesignMap"><EngineerMap rows={plannedRows.slice(0, MAX_MAP_MARKERS)} paths={plannedRoutes.slice(0, MAX_MAP_MARKERS)} assets={plannedAssets.slice(0, MAX_IMPORTED_ASSETS_TO_RENDER)} selectedId="" onSelect={() => {}} onMapClick={() => {}} /></div>
      </article>

      <article className="dashboardPanel managementActivityPanel">
        <div className="dashboardPanelHead"><div><h3>Activity history</h3><span>Who did what, where, and when</span></div><span className="dashboardResultCount">{filteredActivity.length} events</span></div>
        <div className="managementActivityFilters">
          <label>Action<select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
            <option value="all">All actions</option>
            <option value="design_batch_uploaded">Designer uploads</option>
            <option value="design_batch_deleted">Deleted design batches</option>
            <option value="point_validated">Engineer approvals</option>
            <option value="point_rejected">Engineer rejections</option>
            <option value="point_assigned">Technician assignments</option>
            <option value="point_unassigned">Removed assignments</option>
            <option value="engineer_point_added">Engineer added points</option>
            <option value="engineer_point_deleted">Engineer removed points</option>
            <option value="point_location_updated">Point location edits</option>
            <option value="technician_planting_record">Technician plantings</option>
            <option value="technician_field_record">Technician field records</option>
            <option value="technician_record_updated">Technician record edits</option>
            <option value="technician_record_deleted">Technician record deletions</option>
          </select></label>
          <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, area, point, or batch" /></label>
        </div>
        <div className="dashboardRecentWrap"><table className="dashboardRecentTable managementTable"><thead><tr><th>When</th><th>Action</th><th>By</th><th>Role</th><th>Area</th><th>Point / batch</th><th>Details</th></tr></thead><tbody>
          {filteredActivity.slice(0, 200).map((item) => <tr key={item.id}><td>{formatDate(item.occurred_at)} {formatTime(item.occurred_at)}{item.source === 'baseline' && <small>Historical snapshot</small>}</td><td>{managementActionLabel(item.action)}</td><td>{item.actor_name || item.actor_username || 'Unknown user'}</td><td>{item.actor_role || '-'}</td><td>{item.city || '-'} · {item.district || '-'}</td><td className="idCell">{item.entity_id || item.batch_id || '-'}</td><td>{item.target_username ? `Assigned to ${item.target_username}` : item.summary}</td></tr>)}
          {!filteredActivity.length && <tr><td colSpan="7" className="dashboardEmptyCell">{activityAvailable === false ? 'Activity history is not installed yet.' : 'No activity matches the selected filters.'}</td></tr>}
        </tbody></table></div>
        {filteredActivity.length > 200 && <p className="managementTableHint">Showing the latest 200 matching events. Use search and action filters to narrow the list.</p>}
      </article>

      <article className="dashboardPanel managementActivityPanel">
        <div className="dashboardPanelHead"><div><h3>Technician field work</h3><span>Latest 30 of {plantingRows.length} planting and field records</span></div><UsersRound size={19} /></div>
        <div className="dashboardRecentWrap"><table className="dashboardRecentTable managementTable"><thead><tr><th>When</th><th>Technician</th><th>Area</th><th>Planted</th><th>Existing</th><th>Objection</th><th>Record</th></tr></thead><tbody>
          {recentPlantings.map((row) => <tr key={row.id}><td>{formatDate(row.created_at)} {formatTime(row.created_at)}</td><td>{row.tech_name || '-'}</td><td>{row.city || '-'} · {row.district || '-'}</td><td><span className={`statusPill ${yesNoToBoolean(row.is_planted) ? 'statusGood' : 'statusWarn'}`}>{yesNoToBoolean(row.is_planted) ? 'Yes' : 'No'}</span></td><td>{yesNoToBoolean(row.is_existing) ? 'Yes' : 'No'}</td><td>{yesNoToBoolean(row.has_objection) ? 'Yes' : 'No'}</td><td className="idCell">{row.id}</td></tr>)}
          {!recentPlantings.length && <tr><td colSpan="7" className="dashboardEmptyCell">No technician records found.</td></tr>}
        </tbody></table></div>
      </article>
    </section>
  );
}

function managementActionLabel(action) {
  const labelsByAction = {
    design_batch_uploaded: 'Designer uploaded an area',
    design_batch_deleted: 'Designer deleted an area',
    engineer_point_added: 'Engineer added a point',
    point_validated: 'Engineer validated a point',
    point_rejected: 'Engineer rejected a point',
    point_assigned: 'Engineer assigned a technician',
    point_unassigned: 'Engineer removed an assignment',
    point_location_updated: 'Engineer moved a point',
    engineer_point_deleted: 'Engineer removed a point',
    technician_planting_record: 'Technician recorded a planting',
    technician_field_record: 'Technician recorded a field check',
    technician_record_updated: 'Field record updated',
    technician_record_deleted: 'Field record deleted',
  };
  return labelsByAction[action] || action || 'Activity';
}

function DesignWorkspace({ profile, plannedRows, plannedRoutes, plannedAssets = [], plantingRows, technicians, onUpload, onDeleteBatch, onValidateAll, onRefresh, onLogout, busy }) {
  const [city, setCity] = useState(profile.city || 'Misrata');
  const [district, setDistrict] = useState(profile.district || '');
  const [error, setError] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState(() => {
    try {
      return localStorage.getItem(`bulk-validate-technician:${profile.username || 'ryadh'}`) || '';
    } catch {
      return '';
    }
  });
  const [bulkCity, setBulkCity] = useState('');
  const [bulkDistrict, setBulkDistrict] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!city || !district) {
      setError('اختر المدينة والمنطقة قبل رفع الملف.');
      return;
    }
    setError('');
    try {
      const text = await readKmlFromFile(file);
       const { points, paths, assets } = parseKmlDocument(text);
       if (!points.length && !paths.length && !assets.length) throw new Error('لم يتم العثور على عناصر داخل الملف.');
       await onUpload(points, { city, district, fileName: file.name, paths, assets });
    } catch (uploadError) {
      setError(uploadError.message);
    }
  }

  const pendingRows = useMemo(
    () => plannedRows.filter((row) => row.validation_status === 'pending' && !row.deleted_at),
    [plannedRows],
  );
  const pending = pendingRows.length;
  const validated = plannedRows.filter((row) => ['validated', 'planted'].includes(row.validation_status)).length;
  const canValidateAll = profile.role === 'design' && String(profile.username || '').trim().toLowerCase() === 'ryadh';
  const pendingCities = useMemo(
    () => [...new Set(pendingRows.map((row) => String(row.city || '').trim()).filter(Boolean))].sort(),
    [pendingRows],
  );
  const pendingDistricts = useMemo(
    () => [...new Set(pendingRows
      .filter((row) => String(row.city || '').trim().toLowerCase() === bulkCity.toLowerCase())
      .map((row) => String(row.district || '').trim())
      .filter(Boolean))].sort(),
    [pendingRows, bulkCity],
  );
  const selectedPendingRows = useMemo(
    () => pendingRows.filter((row) =>
      String(row.city || '').trim().toLowerCase() === bulkCity.toLowerCase()
      && String(row.district || '').trim().toLowerCase() === bulkDistrict.toLowerCase()),
    [pendingRows, bulkCity, bulkDistrict],
  );
  const previewRows = plannedRows.slice(0, MAX_MAP_MARKERS);
  const previewAssets = plannedAssets.slice(0, MAX_IMPORTED_ASSETS_TO_RENDER);
  const districtOptions = CITY_DISTRICTS[city] || [];
  const batches = useMemo(() => {
    const grouped = new Map();
    [...plannedRows, ...plannedRoutes, ...plannedAssets].forEach((row) => {
      if (!row.batch_id) return;
      const current = grouped.get(row.batch_id) || {
        batchId: row.batch_id,
        city: row.city || '-',
        district: row.district || '-',
        count: 0,
        routeCount: 0,
        assetCount: 0,
        hasPlanted: false,
        latest: row.created_at || '',
      };
      if (row.asset_type) current.assetCount += 1;
      else if (row.latitude !== undefined) current.count += 1;
      else current.routeCount += 1;
      current.hasPlanted = current.hasPlanted || row.validation_status === 'planted' || row.is_planted;
      if (row.created_at > current.latest) current.latest = row.created_at;
      grouped.set(row.batch_id, current);
    });
    return Array.from(grouped.values()).sort((a, b) => String(b.latest).localeCompare(String(a.latest)));
  }, [plannedRows, plannedRoutes, plannedAssets]);

  const previewRoutes = plannedRoutes.slice(0, MAX_MAP_MARKERS);

  async function validateAllPending() {
    if (!canValidateAll || !selectedPendingRows.length || !bulkCity || !bulkDistrict) return;
    if (!bulkAssignedTo) {
      setBulkMessage('اختر الفني الذي ستُسند إليه النقاط.');
      return;
    }
    const count = selectedPendingRows.length;
    if (!window.confirm(`Validate ${count} pending points in ${bulkDistrict}, ${bulkCity} and assign them to ${bulkAssignedTo}?`)) return;

    setBulkMessage('');
    try {
      const updated = await onValidateAll(selectedPendingRows.map((row) => row.id), bulkCity, bulkDistrict, bulkAssignedTo);
      try {
        localStorage.setItem(`bulk-validate-technician:${profile.username || 'ryadh'}`, bulkAssignedTo);
      } catch {
        // The database assignment remains authoritative if local storage is unavailable.
      }
      const skipped = count - updated.length;
      setBulkMessage(`تم اعتماد ${updated.length} نقطة في ${bulkDistrict}، ${bulkCity} وإسنادها إلى ${bulkAssignedTo}.${skipped ? ` تم تجاوز ${skipped} نقطة لم تعد بحالة Pending.` : ''}`);
    } catch (validationError) {
      setBulkMessage(`تعذر اعتماد النقاط: ${validationError.message}`);
    }
  }

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
        <article><Upload size={19} /><span>Imported poles / design features</span><strong>{plannedRows.length} / {plannedAssets.length}</strong></article>
        <article><Target size={19} /><span>Pending validation</span><strong>{pending}</strong></article>
        <article><CheckCircle2 size={19} /><span>Validated / planted</span><strong>{validated}</strong></article>
      </section>

      {canValidateAll && <section className="records" style={{ padding: 20, marginBottom: 16 }}>
        <div className="recordsHeader"><div><h2>Validate an area</h2><span>Choose a city and district to validate only its pending poles.</span></div><Target size={20} /></div>
        <div className="bulkValidatePanel" style={{ marginTop: 14, marginBottom: 0 }}>
          <div><strong>{selectedPendingRows.length} pending points in selected area</strong><span>{pending ? 'Only pending poles in the selected city and district will be validated.' : 'There are no pending points to validate.'}</span></div>
          <div className="fieldGrid">
            <label>City<select value={bulkCity} onChange={(event) => { setBulkCity(event.target.value); setBulkDistrict(''); }}><option value="">Choose city...</option>{pendingCities.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label>District<select value={bulkDistrict} onChange={(event) => setBulkDistrict(event.target.value)} disabled={!bulkCity}><option value="">Choose district...</option>{pendingDistricts.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label>Assign to technician<select value={bulkAssignedTo} onChange={(event) => setBulkAssignedTo(event.target.value)}><option value="">Select technician...</option>{technicians.map((technician) => <option key={technician} value={technician}>{technician}</option>)}</select></label>
          </div>
          <button className="save" type="button" onClick={validateAllPending} disabled={busy || !selectedPendingRows.length || !bulkCity || !bulkDistrict || !bulkAssignedTo}>Validate area ({selectedPendingRows.length})</button>
        </div>
        {bulkMessage && <div className="notice" style={{ marginTop: 12 }}>{bulkMessage}</div>}
      </section>}

      <section className="records" style={{ padding: 20, marginBottom: 16 }}>
        <div className="recordsHeader"><div><h2>Upload KMZ plan</h2><span>New poles go to validation; other design features stay as map references.</span></div></div>
        <div className="fieldGrid" style={{ marginTop: 14 }}>
          <label>City<select value={city} onChange={(event) => { setCity(event.target.value); setDistrict(''); }}><option value="Misrata">Misrata</option><option value="Tripoli">Tripoli</option></select></label>
          <label>District<select required value={district} onChange={(event) => setDistrict(event.target.value)}><option value="">Choose district...</option>{districtOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
        <label className="ghost fileButton" style={{ marginTop: 14, display: 'inline-flex' }}>
          <Upload size={18} /> {busy ? 'Uploading...' : 'Choose KMZ / KML'}
          <input type="file" accept=".kmz,.kml,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" onChange={handleFile} disabled={busy || !city || !district} />
        </label>
        {error && <div className="notice" style={{ marginTop: 14 }}>{error}</div>}
      </section>

       {!!batches.length && <section className="records designBatchCard" style={{ marginBottom: 16 }}>
        <div className="recordsHeader"><div><h2>Uploaded areas</h2><span>Delete only a selected uploaded batch.</span></div><span>{batches.length} batches</span></div>
        <div className="batchList">{batches.map((batch) => <div className="batchRow" key={batch.batchId}><div><strong>{batch.city} · {batch.district}</strong><span>{batch.count} poles · {batch.assetCount} design features · {batch.routeCount} cable routes · {batch.batchId}</span></div><button className="dangerMini" type="button" disabled={busy || batch.hasPlanted} title={batch.hasPlanted ? 'Cannot delete a batch with planted points' : 'Delete batch'} onClick={async () => { if (!window.confirm(`Delete ${batch.count} poles, ${batch.assetCount} design features and ${batch.routeCount} cable routes from ${batch.city} / ${batch.district}?`)) return; setError(''); try { await onDeleteBatch(batch.batchId); } catch (deleteError) { setError(deleteError.message); } }}><Trash2 size={16} /> Delete</button></div>)}</div>
      </section>}

       {(plannedRows.length || plannedRoutes.length || plannedAssets.length) > 0 && <section className="records designMapCard" style={{ marginBottom: 16 }}>
        <div className="recordsHeader"><div><h2>Map preview</h2><span>Poles, buildings, boxes and cable routes are shown from the uploaded design.</span></div><span>{previewRows.length} poles · {previewAssets.length} features · {previewRoutes.length} routes</span></div>
        <div className="designPreviewMap"><EngineerMap rows={previewRows} paths={previewRoutes} assets={previewAssets} selectedId="" onSelect={() => {}} onMapClick={() => {}} /></div>
      </section>}

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

function EngineerMapClickHandler({ enabled, onMapClick }) {
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useMapEvents({
    click: (event) => {
      if (enabled) onMapClickRef.current?.(event.latlng);
    },
  });
  return null;
}

function engineerPointIcon(color, selected) {
  return L.divIcon({
    className: 'engineerPointIcon',
    html: `<span class="engineerPointDot${selected ? ' selected' : ''}" style="--point-color:${color}"></span>`,
    iconSize: [selected ? 24 : 18, selected ? 24 : 18],
    iconAnchor: [selected ? 12 : 9, selected ? 12 : 9],
  });
}

function EngineerMap({ rows, paths = [], assets = [], selectedId, onSelect, onMapClick, onMovePoint, addMode = false, moveMode = false }) {
  const first = rows.find((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)));
  const firstPathPoint = paths.flatMap((path) => path.coordinates || [])[0];
  const firstAssetPoint = assets.flatMap((asset) => flattenMapCoordinates(asset.coordinates))[0];
  const center = first
    ? [Number(first.latitude), Number(first.longitude)]
    : firstPathPoint || firstAssetPoint || [defaultLocation.latitude, defaultLocation.longitude];
  return (
    <MapContainer center={center} zoom={14} maxZoom={22} scrollWheelZoom className="map" zoomControl rotate touchRotate rotateControl={{ closeOnZeroBearing: false, position: 'topright' }} bearing={0}>
      <MapLayers />
      <CurrentLocationControl />
      <MapFullscreenControl />
      <MapFitToContent rows={rows} paths={paths} assets={assets} />
      <EngineerMapClickHandler enabled={addMode} onMapClick={onMapClick} />
      <ImportedDesignAssets assets={assets} />
      <CablePaths paths={paths} />
      {rows.map((row) => {
        const statusColor = row.validation_status === 'validated' ? '#2563eb' : row.validation_status === 'planted' ? '#16a34a' : row.validation_status === 'rejected' ? '#dc2626' : '#f59e0b';
        const selected = row.id === selectedId;
        return <Marker
          key={row.id}
          position={[Number(row.latitude), Number(row.longitude)]}
          icon={engineerPointIcon(statusColor, selected)}
          interactive={!addMode}
          draggable={!addMode && Boolean(onMovePoint) && moveMode && selected}
          eventHandlers={{
            click: () => {
              if (!moveMode) onSelect(row.id);
            },
            dragstart: () => {
              if (!moveMode) onSelect(row.id);
            },
            dragend: (event) => {
              const position = event.target.getLatLng();
              onMovePoint?.(row, position);
            },
          }}
        >
          {!moveMode && <Popup>
              <div className="mapPointPopup" dir="rtl">
                <strong>{row.point_name || row.id}</strong>
                <span><b>Area / City:</b> {row.city || '-'}</span>
                <span><b>District:</b> {row.district || '-'}</span>
                <span><b>Status:</b> {row.validation_status || '-'}</span>
                <span><b>Assign to:</b> {row.assigned_to || '-'}</span>
                <span dir="ltr"><b>Coordinates:</b> {row.latitude}, {row.longitude}</span>
              </div>
            </Popup>}
        </Marker>;
      })}
    </MapContainer>
  );
}

function EngineerWorkspace({ profile, plannedRows, plannedRoutes, plannedAssets = [], technicians, onRefresh, onLogout, onValidate, onMove, onDelete, onAdd, busy }) {
  const [selectedId, setSelectedId] = useState(plannedRows[0]?.id || '');
  const [status, setStatus] = useState('validated');
  const [rememberedAssignedTo, setRememberedAssignedTo] = useState(() => {
    try {
      return localStorage.getItem(`engineer-default-technician:${profile.username || profile.techName}`) || '';
    } catch {
      return '';
    }
  });
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [city, setCity] = useState(profile.city || 'Misrata');
  const [district, setDistrict] = useState(profile.district || '');
  const [addMode, setAddMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const selected = plannedRows.find((row) => row.id === selectedId) || null;
  const pending = plannedRows.filter((row) => row.validation_status === 'pending' && !row.deleted_at);

  useEffect(() => {
    if (!selected && plannedRows[0]) setSelectedId(plannedRows[0].id);
  }, [plannedRows, selected]);

  useEffect(() => {
    setMoveMode(false);
    setStatus(selected?.validation_status === 'rejected' ? 'rejected' : 'validated');
    setNotes(selected?.validation_notes || '');
    setAssignedTo(selected?.assigned_to || rememberedAssignedTo || '');
  }, [selectedId, selected?.validation_status, selected?.validation_notes, selected?.assigned_to]);

  function rememberTechnician(value) {
    setAssignedTo(value);
    setRememberedAssignedTo(value);
    try {
      localStorage.setItem(`engineer-default-technician:${profile.username || profile.techName}`, value);
    } catch {
      // Local preference is optional; the database assignment remains authoritative.
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setMessage('');
    try {
      await onValidate(selected, { status, notes, assignedTo });
      if (status === 'validated' && assignedTo) rememberTechnician(assignedTo);
      setMessage('تم حفظ قرار الـ Validation.');
    } catch (error) {
      setMessage(`تعذر الحفظ: ${error.message}`);
    }
  }

  async function handleMapClick(latlng) {
    if (!addMode) return;
    try {
      const created = await onAdd({ latitude: latlng.lat, longitude: latlng.lng, city, district });
      setSelectedId(created.id);
      setAddMode(false);
      setMessage('تمت إضافة نقطة جديدة بحالة Pending.');
    } catch (error) {
      setMessage(`تعذر إضافة النقطة: ${error.message}`);
    }
  }

  async function handleMovePoint(row, position) {
    setSelectedId(row.id);
    setControlsOpen(true);
    setMessage('');
    try {
      await onMove(row, { latitude: position.lat, longitude: position.lng });
      setMoveMode(false);
      setMessage('تم تحديث موقع النقطة وحفظه.');
    } catch (error) {
      setMessage(`تعذر تحديث الموقع: ${error.message}`);
    }
  }

  function toggleMoveMode() {
    const nextMoveMode = !moveMode;
    setAddMode(false);
    setMoveMode(nextMoveMode);
    if (nextMoveMode && window.matchMedia('(max-width: 980px)').matches) {
      setControlsOpen(false);
    }
  }

  async function deleteSelected() {
    if (!selected || selected.validation_status === 'planted') return;
    if (!window.confirm(`Delete ${selected.point_name || selected.id}?`)) return;
    setMessage('');
    try {
      await onDelete(selected);
      setMessage('تم حذف النقطة من قائمة العمل.');
    } catch (error) {
      setMessage(`تعذر حذف النقطة: ${error.message}`);
    }
  }

  return (
    <main className="app adminMode">
      <header className="topbar"><div><p className="eyebrow">Site Survey Pro</p><h1>Engineer Validation</h1></div><div className="actions"><div className="profilePill"><UserRound size={17} /><span>{profile.techName}</span><strong>Engineer</strong></div><button className="ghost" type="button" onClick={onLogout}><LogOut size={18} /> Logout</button><button className="ghost" type="button" onClick={onRefresh} disabled={busy}><RefreshCcw size={18} /> Refresh</button></div></header>
      <section className="stats"><article><Target size={19} /><span>Pending</span><strong>{pending.length}</strong></article><article><CheckCircle2 size={19} /><span>Validated</span><strong>{plannedRows.filter((row) => row.validation_status === 'validated').length}</strong></article><article><X size={19} /><span>Rejected</span><strong>{plannedRows.filter((row) => row.validation_status === 'rejected').length}</strong></article></section>
      {message && <div className="notice">{message}</div>}
      <button className="mobileLogoutButton" type="button" onClick={onLogout}><LogOut size={18} /><span>تسجيل الخروج</span></button>
      <button className="engineerPanelToggle" type="button" onClick={() => setControlsOpen((value) => !value)} aria-expanded={controlsOpen} aria-controls="engineer-controls" aria-label={controlsOpen ? 'إخفاء لوحة المهندس' : 'إظهار لوحة المهندس'}>
        <Menu size={24} />
      </button>
      <section className="workspace">
         <div className="mapShell" style={{ minHeight: 650 }}><EngineerMap rows={plannedRows} paths={plannedRoutes} assets={plannedAssets} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setControlsOpen(true); }} onMapClick={handleMapClick} onMovePoint={handleMovePoint} addMode={addMode} moveMode={moveMode} />{addMode && <div className="mapAddHint">Click on the map to place a new point</div>}{moveMode && <><button className="mapMoveFinishButton" type="button" onClick={() => setMoveMode(false)}>Finish editing location</button><div className="mapMoveHint">Drag the selected point to the correct location.</div></>}<div className="fixedPin" aria-hidden="true"><MapPin size={36} /></div></div>
        <section id="engineer-controls" className={`panel engineerControls ${controlsOpen ? 'open' : ''}`}>
          <div className="panelHeader"><div><p>Engineer review</p><h2>Validation queue</h2><span className="autoId">{plannedRows.length} planned points</span></div><Target color="#2563eb" /></div>
          {selected && <><div className="pointDetails"><div><span>Point</span><strong>{selected.point_name || selected.id}</strong></div><div><span>Area / City</span><strong>{selected.city || '-'}</strong></div><div><span>District</span><strong>{selected.district || '-'}</strong></div><div><span>Status</span><strong>{selected.validation_status || '-'}</strong></div></div><div className="coordinateGrid"><label>Latitude<input value={selected.latitude} readOnly /></label><label>Longitude<input value={selected.longitude} readOnly /></label></div><button className={`ghost moveLocationButton${moveMode ? ' active' : ''}`} type="button" onClick={toggleMoveMode} disabled={busy}><MapPin size={17} />{moveMode ? 'Finish editing location' : 'Edit location'}</button>{moveMode && <div className="moveLocationHint">Drag the selected point to the correct location.</div>}<label>Decision<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="validated">Validate</option><option value="rejected">Reject</option></select></label>{status === 'validated' && <label>Assign technician<select value={assignedTo} onChange={(event) => rememberTechnician(event.target.value)}><option value="">Select technician...</option>{technicians.map((technician) => <option key={technician} value={technician}>{technician}</option>)}</select></label>}<label>Notes<textarea rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button className="save" type="button" onClick={saveSelected} disabled={busy || (status === 'validated' && !assignedTo)}>Save decision</button><button className="dangerMini engineerDeleteButton" type="button" onClick={deleteSelected} disabled={busy || selected.validation_status === 'planted'}><Trash2 size={17} /> Delete point</button></>}
          {addMode && <div className="fieldGrid" style={{ marginBottom: 14 }}><label>City<select value={city} onChange={(event) => setCity(event.target.value)}><option value="Misrata">Misrata</option><option value="Tripoli">Tripoli</option></select></label><label>District<input value={district} onChange={(event) => setDistrict(event.target.value)} /></label></div>}
          <button className="ghost" type="button" style={{ width: '100%', marginTop: 12 }} onClick={() => { setMoveMode(false); setAddMode((value) => !value); }}>{addMode ? 'Cancel add point' : 'Add point on map'}</button>
        </section>
      </section>
    </main>
  );
}

function LegacyTechnicianWorkspace({ assignments, records, onAdd, onSwitchMode, busy }) {
  const activeAssignments = (assignments || []).filter((assignment) => assignment.active !== false);
  const [selectedAreaId, setSelectedAreaId] = useState(activeAssignments[0]?.id || '');
  const [location, setLocation] = useState(defaultLocation);
  const [hasObjection, setHasObjection] = useState('لا');
  const [isExisting, setIsExisting] = useState('لا');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [message, setMessage] = useState('');
  const [controlsOpen, setControlsOpen] = useState(false);
  const selectedArea = activeAssignments.find((assignment) => assignment.id === selectedAreaId) || activeAssignments[0] || null;
  const areaRows = useMemo(
    () => (records || []).filter((row) => row.city === selectedArea?.city && row.district === selectedArea?.district),
    [records, selectedArea?.city, selectedArea?.district],
  );
  const mapRows = useMemo(
    () => areaRows.filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))).slice(0, MAX_MAP_MARKERS),
    [areaRows],
  );

  useEffect(() => {
    if (!selectedArea && activeAssignments[0]) setSelectedAreaId(activeAssignments[0].id);
  }, [activeAssignments, selectedArea]);

  useEffect(() => {
    const lastRecord = areaRows[0];
    if (lastRecord) {
      setLocation({ latitude: Number(lastRecord.latitude), longitude: Number(lastRecord.longitude) });
    } else if (selectedArea?.city === 'Misrata') {
      setLocation({ latitude: 32.3754, longitude: 15.0925 });
    } else {
      setLocation(defaultLocation);
    }
  }, [selectedAreaId]);

  async function submit() {
    if (!selectedArea) return;
    setMessage('');
    try {
      await onAdd({
        latitude: location.latitude,
        longitude: location.longitude,
        city: selectedArea.city,
        district: selectedArea.district,
        hasObjection: hasObjection === 'نعم',
        isExisting: isExisting === 'نعم',
        notes,
        photoFile,
      });
      setPhotoFile(null);
      setNotes('');
      setHasObjection('لا');
      setIsExisting('لا');
      setMessage('تم تسجيل زراعة العمود بنجاح.');
    } catch (error) {
      setMessage(`تعذر الحفظ: ${error.message}`);
    }
  }

  if (!activeAssignments.length) {
    return <div className="empty legacyEmpty">لا توجد منطقة Legacy معيّنة لك من الأدمن حتى الآن.</div>;
  }

  return (
    <section className="workspace legacyWorkspace">
      <div className="mapShell" style={{ minHeight: 650 }}>
        <MapContainer
          center={[location.latitude, location.longitude]}
          zoom={18}
          maxZoom={22}
          scrollWheelZoom
          zoomControl
          rotate
          touchRotate
          rotateControl={{ closeOnZeroBearing: false, position: 'topright' }}
          bearing={0}
          className="map"
        >
          <MapLayers />
          <CurrentLocationControl onLocated={(next) => { setLocation(next); setMessage('تم تحديد موقعك الحالي.'); }} />
          <MapCenterSync value={location} onChange={setLocation} />
          <MapFitToContent rows={mapRows} />
          <MapFullscreenControl />
          <FastSurveyMarkers groupedRecords={{ column_checks: mapRows }} />
        </MapContainer>
        <div className="fixedPin" aria-hidden="true"><MapPin size={36} /></div>
        <div className="limitBadge">حرّك الخريطة وضع الدبوس على موقع العمود</div>
      </div>
      <button className="engineerPanelToggle legacyPanelToggle" type="button" onClick={() => setControlsOpen((value) => !value)} aria-expanded={controlsOpen} aria-controls="legacy-controls" aria-label={controlsOpen ? 'إخفاء لوحة الزراعة' : 'إظهار لوحة الزراعة'}><Menu size={24} /></button>
      <section id="legacy-controls" className={`records panel legacyControls ${controlsOpen ? 'open' : ''}`} style={{ padding: 20 }}>
        <div className="recordsHeader">
          <div><h2>Legacy planting</h2><span>إضافة مباشرة للمناطق التي بدأ العمل فيها سابقًا</span></div>
        </div>
        {onSwitchMode && <div className="mobileWorkflowTabs"><button type="button" onClick={onSwitchMode}>Assigned validated points</button></div>}
        <label style={{ marginTop: 14 }}>Assigned area
          <select value={selectedArea?.id || ''} onChange={(event) => setSelectedAreaId(event.target.value)}>
            {activeAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.city} · {assignment.district}</option>)}
          </select>
        </label>
        <div className="coordinateGrid">
          <label>Latitude<input value={location.latitude} readOnly /></label>
          <label>Longitude<input value={location.longitude} readOnly /></label>
        </div>
        <div className="fieldGrid">
          <label>هل عليه اعتراض<select value={hasObjection} onChange={(event) => setHasObjection(event.target.value)}><option>لا</option><option>نعم</option></select></label>
          <label>هل هو موجود<select value={isExisting} onChange={(event) => setIsExisting(event.target.value)}><option>لا</option><option>نعم</option></select></label>
        </div>
        <label style={{ marginTop: 14 }}>ملاحظة<textarea rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <label className="photoBox" style={{ marginTop: 14 }}><Camera size={22} /><span>{photoFile ? photoFile.name : 'التقاط صورة للعمود'}</span><input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} /></label>
        <button className="save" type="button" onClick={submit} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'تسجيل الزراعة'}</button>
        {message && <div className="notice">{message}</div>}
        <div className="legacyCount">تم تسجيل {areaRows.length} عمود في هذه المنطقة.</div>
      </section>
    </section>
  );
}

function SupervisorWorkspace({ profile, plannedRows, plannedRoutes = [], plannedAssets = [], legacyAssignments = [], legacyRecords = [], onRefresh, onLogout, onPlant, onLegacyAdd, busy }) {
  const isTechnician = profile.role === 'tech';
  const available = plannedRows.filter((row) => ['validated', 'planted'].includes(row.validation_status) && (profile.role === 'supervisor' || row.assigned_to === profile.username || row.assigned_to === profile.techName));
  const pointsForPlanting = isTechnician ? available.filter((row) => row.validation_status === 'validated') : available;
  const [selectedId, setSelectedId] = useState(pointsForPlanting[0]?.id || '');
  const [hasObjection, setHasObjection] = useState('لا');
  const [isExisting, setIsExisting] = useState('لا');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [message, setMessage] = useState('');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [workflowMode, setWorkflowMode] = useState('validated');
  const selected = pointsForPlanting.find((row) => row.id === selectedId) || null;

  useEffect(() => {
    if (!selected) setSelectedId(pointsForPlanting[0]?.id || '');
  }, [pointsForPlanting, selected]);

  function switchWorkflowMode(mode) {
    setWorkflowMode(mode);
    setControlsOpen(false);
    if (mode === 'legacy' && !legacyAssignments.length) onRefresh().catch(() => {});
  }

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
      <header className="topbar"><div><p className="eyebrow">Site Survey Pro</p><h1>{isTechnician ? 'Technician Planting' : 'Supervisor Planting'}</h1></div><div className="actions"><div className="profilePill"><UserRound size={17} /><span>{profile.techName}</span><strong>{isTechnician ? 'Technician' : 'Supervisor'}</strong></div><button className="ghost" type="button" onClick={onLogout}><LogOut size={18} /> Logout</button><button className="ghost" type="button" onClick={onRefresh} disabled={busy}><RefreshCcw size={18} /> Refresh</button></div></header>
      <section className="stats"><article><CheckCircle2 size={19} /><span>Validated points</span><strong>{available.filter((row) => row.validation_status === 'validated').length}</strong></article><article><MapPin size={19} /><span>Planted</span><strong>{available.filter((row) => row.validation_status === 'planted').length}</strong></article><article><Camera size={19} /><span>Photos</span><strong>{available.filter((row) => row.is_planted && row.photo_url).length}</strong></article></section>
      {message && <div className="notice">{message}</div>}
      {isTechnician && <div className="workflowModeTabs desktopWorkflowTabs"><button type="button" className={workflowMode === 'validated' ? 'active' : ''} onClick={() => switchWorkflowMode('validated')}>Assigned validated points</button><button type="button" className={workflowMode === 'legacy' ? 'active' : ''} onClick={() => switchWorkflowMode('legacy')}>Legacy areas</button></div>}
      <button className="mobileLogoutButton" type="button" onClick={onLogout}><LogOut size={18} /><span>تسجيل الخروج</span></button>
      {workflowMode === 'validated' && <button className="engineerPanelToggle" type="button" onClick={() => setControlsOpen((value) => !value)} aria-expanded={controlsOpen} aria-controls="supervisor-controls" aria-label={controlsOpen ? 'إخفاء لوحة الفني' : 'إظهار لوحة الفني'}>
        <Menu size={24} />
      </button>}
      {isTechnician && workflowMode === 'legacy' ? <LegacyTechnicianWorkspace assignments={legacyAssignments} records={legacyRecords} onAdd={onLegacyAdd} onSwitchMode={() => setWorkflowMode('validated')} busy={busy} /> : <>
      <section className="workspace">
      <div className="mapShell" style={{ minHeight: 650 }}><EngineerMap rows={pointsForPlanting} paths={isTechnician ? [] : plannedRoutes} assets={isTechnician ? [] : plannedAssets} selectedId={selectedId} onSelect={setSelectedId} onMapClick={() => {}} /><div className="fixedPin" aria-hidden="true"><MapPin size={36} /></div><div className="limitBadge">الأزرق: معتمد · الأخضر: تمت زراعته</div></div>
      <section id="supervisor-controls" className={`records panel supervisorControls ${controlsOpen ? 'open' : ''}`} style={{ padding: 20 }}>
        {isTechnician && <div className="mobileWorkflowTabs"><button type="button" className={workflowMode === 'validated' ? 'active' : ''} onClick={() => switchWorkflowMode('validated')}>Assigned validated points</button><button type="button" className={workflowMode === 'legacy' ? 'active' : ''} onClick={() => switchWorkflowMode('legacy')}>Legacy areas</button></div>}
        <div className="recordsHeader"><div><h2>Validated planting points</h2><span>Only engineer-approved points are shown.</span></div></div>
        <label style={{ marginTop: 14 }}>Point<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select point...</option>{pointsForPlanting.map((row) => <option key={row.id} value={row.id}>{row.point_name || row.id} - {row.validation_status}</option>)}</select></label>
        {selected && <>
          <div className="coordinateGrid"><label>Latitude<input value={selected.latitude} readOnly /></label><label>Longitude<input value={selected.longitude} readOnly /></label></div>
          <div className="fieldGrid"><label>هل عليه اعتراض<select value={hasObjection} onChange={(event) => setHasObjection(event.target.value)}><option>لا</option><option>نعم</option></select></label><label>هل هو موجود<select value={isExisting} onChange={(event) => setIsExisting(event.target.value)}><option>لا</option><option>نعم</option></select></label></div>
          <label style={{ marginTop: 14 }}>ملاحظة<textarea rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <label className="photoBox" style={{ marginTop: 14 }}><Camera size={22} /><span>{photoFile ? photoFile.name : 'التقاط صورة للعمود'}</span><input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} /></label>
          <button className="save" type="button" onClick={submit} disabled={busy || selected.validation_status === 'planted'}>{selected.validation_status === 'planted' ? 'تمت الزراعة' : (busy ? 'جارٍ الحفظ...' : 'تسجيل الزراعة')}</button>
        </>}
        {!pointsForPlanting.length && <div className="empty" style={{ marginTop: 20 }}>{isTechnician ? 'لا توجد أعمدة معتمدة بانتظار الزراعة.' : 'لا توجد نقاط معتمدة من المهندس حتى الآن.'}</div>}
      </section>
      </section>
      <section className="records" style={{ marginTop: 16 }}><div className="recordsHeader"><h2>Point list</h2><span>{pointsForPlanting.length} points</span></div><div className="tableWrap"><table><thead><tr><th>ID</th><th>City</th><th>District</th><th>Status</th></tr></thead><tbody>{pointsForPlanting.slice(0, 500).map((row) => <tr key={row.id} onClick={() => setSelectedId(row.id)}><td>{row.id}</td><td>{row.city || '-'}</td><td>{row.district || '-'}</td><td>{row.validation_status}</td></tr>)}</tbody></table></div></section>
      </>}
    </main>
  );
}

function WorkflowQueue({ plannedRows, technicians, onAssign, onRefresh, busy }) {
  const [selectedId, setSelectedId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const readyRows = plannedRows.filter((row) => ['validated', 'planted'].includes(row.validation_status) && !row.deleted_at);
  const selected = readyRows.find((row) => row.id === selectedId) || null;

  useEffect(() => {
    if (!selected && readyRows[0]) setSelectedId(readyRows[0].id);
  }, [readyRows, selected]);

  useEffect(() => {
    setAssignedTo(selected?.assigned_to || '');
  }, [selectedId, selected?.assigned_to]);

  async function assign() {
    if (!selected || !assignedTo || selected.validation_status !== 'validated') return;
    await onAssign(selected.id, assignedTo);
  }

  return (
    <section className="records workflowQueue">
      <div className="recordsHeader"><div><h2>Validation & assignment</h2><span>اعتماد النقاط ثم إرسالها للفني</span></div><button className="ghost" type="button" onClick={onRefresh} disabled={busy}><RefreshCcw size={17} /> Refresh</button></div>
      <div className="fieldGrid workflowControls">
        <label>Validated point<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select point...</option>{readyRows.map((row) => <option key={row.id} value={row.id}>{row.point_name || row.id} · {row.city || '-'} · {row.district || '-'}</option>)}</select></label>
        <label>Technician<select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Select technician...</option>{technicians.map((technician) => <option key={technician} value={technician}>{technician}</option>)}</select></label>
        <button className="save" type="button" onClick={assign} disabled={busy || !selected || !assignedTo || selected.validation_status !== 'validated'}>Send to technician</button>
      </div>
      <div className="tableWrap"><table><thead><tr><th>ID</th><th>City</th><th>District</th><th>Status</th><th>Assigned to</th></tr></thead><tbody>{readyRows.slice(0, 200).map((row) => <tr key={row.id} onClick={() => setSelectedId(row.id)}><td>{row.id}</td><td>{row.city || '-'}</td><td>{row.district || '-'}</td><td>{row.validation_status}</td><td>{row.assigned_to || '-'}</td></tr>)}{!readyRows.length && <tr><td colSpan="5" className="empty">No validated points yet.</td></tr>}</tbody></table></div>
    </section>
  );
}

function UserManagement({ users, loading, error, onRefresh, onCreate, onToggle, legacyAssignments = [], onAssignLegacy, onRemoveLegacy }) {
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    role: 'tech',
    city: '',
    district: '',
  });
  const [legacyForm, setLegacyForm] = useState({ technicianUsername: '', city: 'Misrata', district: 'راس عمار' });
  const legacyTechnicians = users.filter((user) => user.role === 'tech' && user.active);
  const legacyDistricts = LEGACY_AREA_OPTIONS.filter((area) => area.city === legacyForm.city);

  async function submit(event) {
    event.preventDefault();
    await onCreate(form);
    setForm({ username: '', displayName: '', password: '', role: 'tech', city: '', district: '' });
  }

  async function submitLegacyAssignment(event) {
    event.preventDefault();
    await onAssignLegacy(legacyForm);
    setLegacyForm((previous) => ({ ...previous, technicianUsername: '' }));
  }

  return (
    <section className="userManagement">
      <div className="recordsHeader">
        <div><h2>User management</h2><span>Create accounts and control application permissions.</span></div>
        <button className="ghost" type="button" onClick={onRefresh} disabled={loading}><RefreshCcw size={17} /> Refresh</button>
      </div>
      {error && <div className="notice">{error}</div>}
      <form className="userCreateForm" onSubmit={submit}>
        <div className="userFormTitle"><UserCog size={20} /><strong>Add user</strong></div>
        <div className="fieldGrid">
          <label>Username<input required value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} placeholder="hamza" autoComplete="off" /></label>
          <label>Display name<input value={form.displayName} onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="Hamza" /></label>
          <label>Password<input required minLength="6" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} autoComplete="new-password" /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
            <option value="tech">Technician</option><option value="design">Designer</option><option value="engineer">Engineer</option><option value="supervisor">Supervisor</option><option value="management">Management</option><option value="admin">Admin</option>
          </select></label>
          <label>City<select value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value, district: '' }))}><option value="">Not assigned</option><option value="Misrata">Misrata</option><option value="Tripoli">Tripoli</option></select></label>
          <label>District<input value={form.district} onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))} placeholder="Optional district" /></label>
        </div>
        <button className="save" type="submit" disabled={loading}>Create user</button>
      </form>
      <div className="tableWrap userTableWrap"><table><thead><tr><th>Username</th><th>Display name</th><th>Role</th><th>City</th><th>District</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}><td>{user.username}</td><td>{user.display_name || '-'}</td><td>{roleLabel(user.role)}</td><td>{user.city || '-'}</td><td>{user.district || '-'}</td><td><span className={`statusPill ${user.active ? 'statusGood' : 'statusBad'}`}>{user.active ? 'Active' : 'Disabled'}</span></td><td><button className="ghost compactButton" type="button" onClick={() => onToggle(user)} disabled={loading}>{user.active ? 'Disable' : 'Enable'}</button></td></tr>)}
        {!users.length && <tr><td colSpan="7" className="empty">No managed users yet.</td></tr>}
      </tbody></table></div>
      <form className="userCreateForm legacyAssignmentForm" onSubmit={submitLegacyAssignment}>
        <div className="userFormTitle"><MapPinned size={20} /><strong>Assign Legacy area</strong></div>
        <p className="formHint">هذه المناطق الخمس تعمل بالطريقة القديمة: الفني يضيف العمود مباشرة بدون ملف تصميم.</p>
        <div className="fieldGrid">
          <label>Technician<select required value={legacyForm.technicianUsername} onChange={(event) => setLegacyForm((prev) => ({ ...prev, technicianUsername: event.target.value }))}><option value="">Select technician...</option>{legacyTechnicians.map((user) => <option key={user.id} value={user.username}>{user.display_name || user.username}</option>)}</select></label>
          <label>City<select value={legacyForm.city} onChange={(event) => { const city = event.target.value; setLegacyForm((prev) => ({ ...prev, city, district: LEGACY_AREA_OPTIONS.find((area) => area.city === city)?.district || '' })); }}><option value="Misrata">Misrata</option><option value="Tripoli">Tripoli</option></select></label>
          <label>District<select required value={legacyForm.district} onChange={(event) => setLegacyForm((prev) => ({ ...prev, district: event.target.value }))}>{legacyDistricts.map((area) => <option key={area.district} value={area.district}>{area.district}</option>)}</select></label>
        </div>
        <button className="save" type="submit" disabled={loading || !legacyTechnicians.length}>Assign area</button>
      </form>
      <div className="tableWrap userTableWrap legacyAssignmentsTable"><table><thead><tr><th>Technician</th><th>City</th><th>District</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {legacyAssignments.map((assignment) => <tr key={assignment.id}><td>{assignment.technician_username}</td><td>{assignment.city}</td><td>{assignment.district}</td><td><span className="statusPill statusGood">Active</span></td><td><button className="ghost compactButton" type="button" onClick={() => onRemoveLegacy(assignment)} disabled={loading}>Remove</button></td></tr>)}
        {!legacyAssignments.length && <tr><td colSpan="5" className="empty">No Legacy areas assigned yet.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function App() {
  const [profile, setProfile] = useState(readSavedProfile);
  const [active, setActive] = useState(() => (readSavedProfile()?.role === 'tech' ? 'column_checks' : 'buildings'));
  const [forms, setForms] = useState(() => makeEmptyForms(readSavedProfile()));
  const [records, setRecords] = useState({ buildings: [], poles: [], column_checks: [] });
  const [plannedRows, setPlannedRows] = useState([]);
  const [plannedRoutes, setPlannedRoutes] = useState([]);
  const [plannedAssets, setPlannedAssets] = useState([]);
  const [legacyAssignments, setLegacyAssignments] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [adminFilters, setAdminFilters] = useState({ district: '', techName: '', type: 'all' });
  const [adminPage, setAdminPage] = useState(() => readSavedProfile()?.role === 'management' ? 'operations' : 'data');
  const [managementActivity, setManagementActivity] = useState([]);
  const [activityAvailable, setActivityAvailable] = useState(null);
  const [managedUsers, setManagedUsers] = useState([]);
  const [technicianUsers, setTechnicianUsers] = useState([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(null);
  const [onlineUsersOpen, setOnlineUsersOpen] = useState(false);
  const onlineUsersRef = useRef(null);
  const loadAllRef = useRef(null);
  const activityRefreshTimerRef = useRef(null);

  const isAdmin = profile?.role === 'admin';
  const isManagement = profile?.role === 'management';
  const isAdminView = isAdmin || isManagement;
  const isTechnician = profile?.role === 'tech';
  const isStaffRole = profile?.role === 'design';
  const current = resources[active];
  const form = forms[active];

  const scopedRecords = useMemo(() => {
    const filtered = {};
    for (const [type, rows] of Object.entries(records)) {
      filtered[type] = rows
        .map((row) => normalizeRow(row, type))
        .filter((row) => {
          if (isStaffRole && !isManagement) return true;
          if (!isAdminView) return row.tech_name === profile?.techName && row.district === profile?.district;
          if (adminFilters.type !== 'all' && adminFilters.type !== type) return false;
          if (adminFilters.district && row.district !== adminFilters.district) return false;
          if (adminFilters.techName && row.tech_name !== adminFilters.techName) return false;
          if (query && !JSON.stringify(row).toLowerCase().includes(query.toLowerCase())) return false;
          return true;
        });
    }
    return filtered;
  }, [records, isAdminView, isManagement, isStaffRole, profile, adminFilters, query]);

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

  const technicianOptions = useMemo(
    () => [...new Set([
      ...technicianUsers,
      ...Object.values(records).flat().map((row) => row.tech_name).filter(Boolean),
    ])].sort(),
    [records, technicianUsers],
  );

  useEffect(() => {
    if (profile) {
      loadAll();
      requestCurrentLocation(true);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.role === 'management') setAdminPage('operations');
    else if (profile?.role === 'admin') setAdminPage('data');
  }, [profile?.role]);

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
    if (!profile || !supabase) {
      setOnlineUsers(null);
      return undefined;
    }

    let mounted = true;
    setOnlineUsers(null);
    const channel = supabase
      .channel('site-survey-online-sessions')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const usersByIdentity = new Map();
        Object.entries(state).forEach(([presenceKey, presences]) => {
          (Array.isArray(presences) ? presences : []).forEach((presence) => {
            const identity = String(presence.username || presence.display_name || presenceKey).trim().toLowerCase();
            const user = {
              identity,
              name: presence.display_name || presence.username || 'Connected user',
              role: presence.role || '',
              onlineAt: presence.online_at || '',
            };
            const previous = usersByIdentity.get(identity);
            if (!previous || user.onlineAt > previous.onlineAt) usersByIdentity.set(identity, user);
          });
        });
        const users = [...usersByIdentity.values()].sort((a, b) => b.onlineAt.localeCompare(a.onlineAt));
        if (mounted) setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            const trackStatus = await channel.track({
              username: profile.username || profile.techName || 'admin',
              display_name: profile.techName || profile.username || 'Admin',
              role: profile.role,
              online_at: new Date().toISOString(),
            });
            if (trackStatus === 'error' && mounted) setOnlineUsers(null);
          } catch {
            if (mounted) setOnlineUsers(null);
          }
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && mounted) {
          setOnlineUsers(null);
        }
      });

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    if (!onlineUsersOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!onlineUsersRef.current?.contains(event.target)) setOnlineUsersOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOnlineUsersOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onlineUsersOpen]);

  useEffect(() => {
    if (!isManagement || !supabase) return undefined;
    let mounted = true;
    const channel = supabase
      .channel('management-activity-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'management_activity' }, (payload) => {
        if (!mounted || !payload.new) return;
        setManagementActivity((current) => [payload.new, ...current.filter((item) => item.id !== payload.new.id)]);
        if (activityRefreshTimerRef.current) clearTimeout(activityRefreshTimerRef.current);
        activityRefreshTimerRef.current = setTimeout(() => {
          if (mounted) loadAllRef.current?.();
        }, 1200);
      })
      .subscribe();
    return () => {
      mounted = false;
      if (activityRefreshTimerRef.current) clearTimeout(activityRefreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [isManagement]);

  async function saveProfile(loginDetails) {
    if (loginDetails.legacyAdmin) {
      const nextProfile = { techName: loginDetails.username.trim() || 'Admin', district: 'ALL', role: 'admin' };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
      setForms(makeEmptyForms(nextProfile));
      setMessage('تم الدخول كأدمن.');
      return;
    }

    if (loginDetails.legacyTech) {
      const nextProfile = {
        techName: loginDetails.username.trim(),
        city: loginDetails.city.trim(),
        district: loginDetails.district.trim(),
        role: 'tech',
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
      setForms(makeEmptyForms(nextProfile));
      setActive('column_checks');
      setMessage('تم تسجيل دخول الفني.');
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
    setActive('buildings');
    setMessage('');
  }

  async function manageUsers(action, payload = {}) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setUsersBusy(true);
    setUsersError('');
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', { body: { action, ...payload } });
      if (error) throw error;
      if (action === 'list') setManagedUsers(data?.users || []);
      else if (action === 'create') {
        setMessage('تم إنشاء المستخدم بنجاح.');
        await manageUsers('list');
      } else if (action === 'toggle') {
        setMessage('تم تحديث صلاحية المستخدم.');
        await manageUsers('list');
      }
    } catch (error) {
      const details = error?.context?.error || error.message || 'تعذر تنفيذ العملية.';
      setUsersError(typeof details === 'string' ? details : 'تعذر تنفيذ العملية.');
      throw error;
    } finally {
      setUsersBusy(false);
    }
  }

  async function assignLegacyArea(details) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setUsersBusy(true);
    setUsersError('');
    try {
      const { data, error } = await supabase.rpc('admin_assign_legacy_area', {
        p_technician_username: details.technicianUsername,
        p_city: details.city,
        p_district: details.district,
      });
      if (error) throw error;
      setLegacyAssignments((currentAssignments) => [
        data,
        ...currentAssignments.filter((assignment) => assignment.id !== data.id),
      ]);
      setMessage('تم تعيين المنطقة Legacy للفني.');
    } catch (error) {
      const detailsText = error?.message || 'تعذر تعيين المنطقة.';
      setUsersError(detailsText);
      throw error;
    } finally {
      setUsersBusy(false);
    }
  }

  async function removeLegacyArea(assignment) {
    if (!window.confirm(`إزالة منطقة ${assignment.district} من الفني؟`)) return;
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setUsersBusy(true);
    setUsersError('');
    try {
      const { error } = await supabase.rpc('admin_remove_legacy_area', { p_id: assignment.id });
      if (error) throw error;
      setLegacyAssignments((currentAssignments) => currentAssignments.filter((item) => item.id !== assignment.id));
      setMessage('تمت إزالة تعيين المنطقة.');
    } catch (error) {
      setUsersError(error?.message || 'تعذر إزالة تعيين المنطقة.');
      throw error;
    } finally {
      setUsersBusy(false);
    }
  }

  useEffect(() => {
    if (isAdmin && adminPage === 'users' && supabase) manageUsers('list').catch(() => {});
  }, [isAdmin, adminPage]);

  async function loadAll() {
    if (!hasSupabaseConfig) {
      setMessage('ضع إعدادات Supabase في ملف .env حتى يتم حفظ وقراءة البيانات.');
      return;
    }

    setBusy(true);
    try {
      const nextRecords = {};
      for (const [key, config] of Object.entries(resources)) {
        nextRecords[key] = await fetchAllRows(() => supabase
          .from(config.table)
          .select('*')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }));
      }
      let planned = [];
      try {
        planned = await fetchAllRows(() => supabase
          .from('planned_poles')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }));
      } catch (error) {
        if (error.code !== '42P01') throw error;
      }
      let routes = [];
      let assets = [];
      if (profile?.role !== 'tech') {
        try {
          routes = await fetchAllRows(() => supabase
            .from('planned_routes')
            .select('*')
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }));
        } catch (error) {
          if (error.code !== '42P01') throw error;
        }
        try {
          assets = await fetchAllRows(() => supabase
            .from('planned_assets')
            .select('*')
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }));
        } catch (error) {
          if (error.code !== '42P01') throw error;
        }
      }
      let activity = [];
      if (isManagement) {
        try {
          activity = await fetchAllRows(() => supabase
            .from('management_activity')
            .select('*')
            .order('occurred_at', { ascending: false })
            .order('id', { ascending: false }));
          activity.reverse();
          setActivityAvailable(true);
        } catch (error) {
          if (['42P01', 'PGRST205'].includes(error.code)) {
            setActivityAvailable(false);
          } else {
            throw error;
          }
        }
      }
      if (['admin', 'design', 'engineer', 'tech'].includes(profile?.role)) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('legacy_area_assignments')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending: false });
        if (assignmentsError && assignmentsError.code !== '42P01') throw assignmentsError;
        setLegacyAssignments(assignments || []);
      } else {
        setLegacyAssignments([]);
      }
      if (['design', 'engineer'].includes(profile?.role) || (profile?.role === 'admin' && profile?.username)) {
        const { data: users, error: usersError } = await supabase
          .from('user_profiles')
          .select('username, role, active')
          .eq('role', 'tech')
          .eq('active', true)
          .order('username', { ascending: true });
        if (usersError) throw usersError;
        setTechnicianUsers((users || []).map((user) => user.username).filter(Boolean));
      } else {
        setTechnicianUsers([]);
      }
      const districtResult = canonicalizeDistricts(nextRecords);
      if (!isManagement) {
        for (const change of districtResult.changes) {
          const update = { district: change.district };
          if (change.city) update.city = change.city;
          const { error: districtError } = await supabase.from(resources[change.type].table).update(update).eq('id', change.id);
          if (districtError) throw districtError;
        }
      }
      setRecords(districtResult.normalized);
      setPlannedRows(planned || []);
      setPlannedRoutes(routes || []);
      setPlannedAssets(assets || []);
      if (isManagement) setManagementActivity(activity);
      setMessage('تم تحديث البيانات بنجاح.');
    } catch (error) {
      setMessage(`تعذر تحميل البيانات: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }
  loadAllRef.current = loadAll;

  async function uploadPlannedPoints(points, metadata) {
    if (!hasSupabaseConfig || !supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const batchId = `KMZ-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const rows = points.map((point) => ({
        ...point,
        city: metadata.city,
        district: resolveDistrict(metadata.district, metadata.city, records) || null,
        created_by: profile.username || profile.techName,
        batch_id: batchId,
        validation_status: 'pending',
      }));
      const routes = (metadata.paths || []).map((path) => ({
        ...path,
        city: metadata.city,
        district: resolveDistrict(metadata.district, metadata.city, records) || null,
        created_by: profile.username || profile.techName,
        batch_id: batchId,
      }));
      const assets = (metadata.assets || []).map((asset) => ({
        ...asset,
        city: metadata.city,
        district: resolveDistrict(metadata.district, metadata.city, records) || null,
        created_by: profile.username || profile.techName,
        batch_id: batchId,
      }));
      if (rows.length) {
        const { error } = await supabase.from('planned_poles').insert(rows);
        if (error) throw error;
      }
      if (routes.length) {
        const { error } = await supabase.from('planned_routes').insert(routes);
        if (error) {
          if (rows.length) await supabase.from('planned_poles').delete().eq('batch_id', batchId);
          throw error;
        }
      }
      if (assets.length) {
        const { error } = await supabase.from('planned_assets').insert(assets);
        if (error) {
          if (rows.length) await supabase.from('planned_poles').delete().eq('batch_id', batchId);
          if (routes.length) await supabase.from('planned_routes').delete().eq('batch_id', batchId);
          throw error;
        }
      }
      setPlannedRows((currentRows) => [...rows, ...currentRows]);
      setPlannedRoutes((currentRoutes) => [...routes, ...currentRoutes]);
      setPlannedAssets((currentAssets) => [...assets, ...currentAssets]);
      setMessage(`تم رفع ${rows.length} نقطة و${assets.length} عنصر تصميم و${routes.length} مسار كابل من ${metadata.fileName}.`);
    } finally {
      setBusy(false);
    }
  }

  async function deletePlannedBatch(batchId) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const { data: batchRows, error: readError } = await supabase.from('planned_poles').select('id, validation_status, is_planted').eq('batch_id', batchId);
      if (readError) throw readError;
      if ((batchRows || []).some((row) => row.validation_status === 'planted' || row.is_planted)) {
        throw new Error('لا يمكن حذف دفعة تحتوي نقاطًا تمت زراعتها.');
      }
      const { error } = await supabase.from('planned_poles').delete().eq('batch_id', batchId);
      if (error) throw error;
      const { error: routesError } = await supabase.from('planned_routes').delete().eq('batch_id', batchId);
      if (routesError && routesError.code !== '42P01') throw routesError;
      const { error: assetsError } = await supabase.from('planned_assets').delete().eq('batch_id', batchId);
      if (assetsError && assetsError.code !== '42P01') throw assetsError;
      setPlannedRows((currentRows) => currentRows.filter((row) => row.batch_id !== batchId));
      setPlannedRoutes((currentRoutes) => currentRoutes.filter((row) => row.batch_id !== batchId));
      setPlannedAssets((currentAssets) => currentAssets.filter((row) => row.batch_id !== batchId));
      setMessage('تم حذف الدفعة والمنطقة المرفوعة بنجاح.');
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
        p_assigned_to: changes.assignedTo || null,
      });
      if (error) throw error;
      setPlannedRows((currentRows) => currentRows.map((item) => item.id === row.id ? data : item));
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function validateAreaPendingPlannedPoles(ids, city, district, technician) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    if (profile?.role !== 'design' || String(profile.username || '').trim().toLowerCase() !== 'ryadh') {
      throw new Error('Not authorized');
    }
    if (!ids.length || !city || !district) return [];

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('design_validate_area_pending_poles', {
        p_ids: ids,
        p_city: city,
        p_district: district,
        p_technician: technician,
      });
      if (error) throw error;
      const updatedRows = data || [];
      const updatedById = new Map(updatedRows.map((row) => [row.id, row]));
      setPlannedRows((currentRows) => currentRows.map((row) => updatedById.get(row.id) || row));
      return updatedRows;
    } finally {
      setBusy(false);
    }
  }

  async function movePlannedPole(row, location) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('engineer_move_planned_pole', {
        p_id: row.id,
        p_latitude: location.latitude,
        p_longitude: location.longitude,
      });
      if (error) throw error;
      setPlannedRows((currentRows) => currentRows.map((item) => item.id === row.id ? data : item));
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function deletePlannedPole(row) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const { error } = await supabase.rpc('engineer_delete_planned_pole', { p_id: row.id });
      if (error) throw error;
      setPlannedRows((currentRows) => currentRows.filter((item) => item.id !== row.id));
    } finally {
      setBusy(false);
    }
  }

  async function assignPlannedPole(id, technician) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const { error } = await supabase.rpc('assign_planned_poles', { p_ids: [id], p_technician: technician });
      if (error) throw error;
      setPlannedRows((currentRows) => currentRows.map((item) => item.id === id ? { ...item, assigned_to: technician, assigned_at: new Date().toISOString() } : item));
      setMessage('تم إرسال النقطة إلى الفني.');
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
        p_district: resolveDistrict(point.district, point.city, records) || null,
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

  async function addLegacyPlanting(details) {
    if (!supabase) throw new Error('إعدادات Supabase غير موجودة.');
    setBusy(true);
    try {
      const provisionalId = `legacy-${Date.now()}`;
      const photoUrl = details.photoFile ? await uploadPhotoFile(details.photoFile, 'column_checks', provisionalId) : '';
      const { data, error } = await supabase.rpc('technician_add_legacy_planting', {
        p_latitude: Number(details.latitude),
        p_longitude: Number(details.longitude),
        p_city: details.city,
        p_district: details.district,
        p_has_objection: details.hasObjection,
        p_is_existing: details.isExisting,
        p_notes: details.notes || null,
        p_photo_url: photoUrl || null,
      });
      if (error) throw error;
      setRecords((currentRecords) => ({ ...currentRecords, column_checks: [data, ...currentRecords.column_checks] }));
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
      const parsedRows = canonicalizeDistricts(importData.rows).normalized;
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
    if (isManagement) {
      setMessage('حساب Management للقراءة فقط.');
      return;
    }
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
        district: resolveDistrict(form.district, form.city, records),
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
    if (isManagement) {
      setMessage('حساب Management للقراءة فقط.');
      return;
    }
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
    return <DesignWorkspace profile={profile} plannedRows={plannedRows} plannedRoutes={plannedRoutes} plannedAssets={plannedAssets} plantingRows={records.column_checks} technicians={technicianOptions} onUpload={uploadPlannedPoints} onDeleteBatch={deletePlannedBatch} onValidateAll={validateAreaPendingPlannedPoles} onRefresh={loadAll} onLogout={changeProfile} busy={busy} />;
  }

  if (profile.role === 'engineer') {
    return <EngineerWorkspace profile={profile} plannedRows={plannedRows} plannedRoutes={plannedRoutes} plannedAssets={plannedAssets} technicians={technicianOptions} onRefresh={loadAll} onLogout={changeProfile} onValidate={validatePlannedPole} onMove={movePlannedPole} onDelete={deletePlannedPole} onAdd={addPlannedPole} busy={busy} />;
  }

  if (profile.role === 'supervisor') {
    return <SupervisorWorkspace profile={profile} plannedRows={plannedRows} plannedRoutes={plannedRoutes} plannedAssets={plannedAssets} legacyRecords={records.column_checks} onRefresh={loadAll} onLogout={changeProfile} onPlant={plantPlannedPole} busy={busy} />;
  }

  if (profile.role === 'tech' && profile.username) {
    return <SupervisorWorkspace profile={profile} plannedRows={plannedRows} plannedRoutes={plannedRoutes} plannedAssets={plannedAssets} legacyAssignments={legacyAssignments} legacyRecords={records.column_checks} onRefresh={loadAll} onLogout={changeProfile} onPlant={plantPlannedPole} onLegacyAdd={addLegacyPlanting} busy={busy} />;
  }

  return (
    <main className={`app ${isAdminView ? 'adminMode' : ''} ${isAdminView && adminPage === 'dashboard' ? 'dashboardMode' : ''} ${isAdminView && adminPage === 'data' ? 'dataMode' : ''} ${isManagement && adminPage === 'operations' ? 'managementOpsMode' : ''}`}>
      <header className="topbar">
        {isAdminView ? (
          <div className="tbF" aria-label="Admin toolbar">
            <button className="d" type="button" onClick={exportKml} aria-label="KML">
              <Download className="dl" size={16} />
              <span>KML</span>
            </button>
            <button className="d" type="button" onClick={exportExcel} aria-label="Excel">
              <Download className="dl" size={16} />
              <span>Excel</span>
            </button>
            <span className="sep" aria-hidden="true" />
            <button className="pri rf" type="button" onClick={loadAll} disabled={busy} aria-label="Refresh">
              <RefreshCcw size={16} />
              <span>Refresh</span>
            </button>
            <span className="sep" aria-hidden="true" />
            <button className="d out" type="button" onClick={changeProfile} aria-label="Logout">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
            <div className="who" title="Current user">
              <span className="av">{(profile.techName || 'A').slice(0, 1).toUpperCase()}</span>
              <div><b>{profile.techName || (isManagement ? 'Management' : 'Admin')}</b><small>{isManagement ? 'MANAGEMENT' : 'ADMIN'}</small></div>
            </div>
          </div>
        ) : (
          <div className="actions">
            <div className="profilePill" title="بيانات المستخدم الحالية">
              <UserRound size={17} />
              <span>{profile.techName}</span>
              <strong>{`${profile.city} · ${profile.district}`}</strong>
            </div>
            <button className="ghost" type="button" onClick={changeProfile} aria-label="Logout">
              <LogOut size={18} />
              Logout
            </button>
            <button className="ghost" type="button" onClick={loadAll} disabled={busy}>
              <RefreshCcw size={18} />
              Refresh
            </button>
          </div>
        )}
        <div className="topbarHeading">
          <p className="eyebrow">Site Survey Pro</p>
          <h1>{isAdminView ? 'Dashboard' : 'خريطة الرفع الميداني'}</h1>
        </div>
      </header>

      {isAdmin && <div className="onlineSessionsWrap" ref={onlineUsersRef}>
        <button
          className="onlineSessionsBadge"
          type="button"
          aria-expanded={onlineUsersOpen}
          aria-controls="online-users-list"
          onClick={() => setOnlineUsersOpen((open) => !open)}
          title="Show users currently online"
        >
          <UsersRound size={18} />
          <span>Online</span>
          <strong>{onlineUsers?.length ?? '...'}</strong>
          <i aria-hidden="true" />
        </button>
        {onlineUsersOpen && <div className="onlineUsersPopover" id="online-users-list" role="dialog" aria-label="Users currently online">
          <div className="onlineUsersHeading">
            <strong>Online users</strong>
            <span>Active now</span>
          </div>
          {onlineUsers === null ? <p className="onlineUsersEmpty">Connecting...</p> : onlineUsers.length ? onlineUsers.map((user) => (
            <div className="onlineUserRow" key={user.identity}>
              <div className="onlineUserStatus"><strong>{user.name}</strong><span>{roleLabel(user.role) || 'User'}</span></div>
              <i aria-label="Online now" />
            </div>
          )) : <p className="onlineUsersEmpty">No users online.</p>}
        </div>}
      </div>}

      {(!isAdminView || adminPage === 'data') && <section className="stats">
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

      {isAdminView && (
        <section className="adminPages" aria-label="Admin pages">
          <button type="button" className={adminPage === 'dashboard' ? 'active' : ''} onClick={() => setAdminPage('dashboard')}>
            Dashboard
          </button>
          {isManagement && <button type="button" className={adminPage === 'operations' ? 'active' : ''} onClick={() => setAdminPage('operations')}>
            Operations
          </button>}
          <button type="button" className={adminPage === 'data' ? 'active' : ''} onClick={() => setAdminPage('data')}>
            Data
          </button>
          <button type="button" className={adminPage === 'photos' ? 'active' : ''} onClick={() => setAdminPage('photos')}>
            Photos
            <span>{visiblePhotos.length}</span>
          </button>
          {isAdmin && <button type="button" className={adminPage === 'users' ? 'active' : ''} onClick={() => setAdminPage('users')}>
            Users
          </button>}
        </section>
      )}

      {isAdminView && adminPage === 'dashboard' && (
        <PolePlantingDashboard records={records.column_checks} onRefresh={loadAll} busy={busy} onDelete={deleteRecord} readOnly={isManagement} />
      )}

      {isManagement && adminPage === 'operations' && (
        <ManagementWorkspace
          plannedRows={plannedRows}
          plannedRoutes={plannedRoutes}
          plannedAssets={plannedAssets}
          plantingRows={records.column_checks}
          activityRows={managementActivity}
          activityAvailable={activityAvailable}
          onRefresh={loadAll}
          busy={busy}
        />
      )}

      {isAdmin && adminPage === 'users' && (
        <UserManagement
          users={managedUsers}
          legacyAssignments={legacyAssignments}
          loading={usersBusy}
          error={usersError || (!supabase ? 'إعدادات Supabase غير موجودة.' : '')}
          onRefresh={() => manageUsers('list').catch(() => {})}
          onCreate={(user) => manageUsers('create', { user })}
          onToggle={(user) => manageUsers('toggle', { id: user.id, active: !user.active })}
          onAssignLegacy={assignLegacyArea}
          onRemoveLegacy={removeLegacyArea}
        />
      )}

      {isAdminView && adminPage === 'data' && (
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

      {isAdmin && adminPage === 'data' && <WorkflowQueue plannedRows={plannedRows} technicians={technicianOptions} onAssign={assignPlannedPole} onRefresh={loadAll} busy={busy} />}

      {(!isAdminView || (isAdmin && adminPage === 'data')) && <nav className="tabs" aria-label="Survey sections">
        {(isTechnician ? Object.entries(resources).filter(([key]) => key === 'column_checks') : Object.entries(resources)).map(([key, item]) => (
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

      {message && (!isAdminView || adminPage === 'data' || (isManagement && adminPage === 'operations')) && <div className="notice">{message}</div>}

      {(!isAdminView || adminPage === 'data') && <section className="workspace">
        <div className="mapShell">
          {!isManagement && <button className="mapAddButton" type="button" onClick={() => setFormDrawerOpen(true)}>
            <Plus size={18} />
            إضافة
          </button>}
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
            <MapLayers />
            <CurrentLocationControl onLocated={(next) => { setLocation(next); setMessage('تم تحديد موقعك الحالي.'); }} />
            <MapCenterSync value={form} onChange={setLocation} />
            <MapFullscreenControl />
            <FastSurveyMarkers groupedRecords={mapRecords} onDelete={deleteRecord} canDelete={isAdmin} />
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
            <span>{form.latitude}, {form.longitude}</span>
          </div>
        </div>

        {!isManagement && <form className={`panel ${formDrawerOpen ? 'open' : ''}`} onSubmit={saveRecord}>
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
        </form>}
      </section>}

      {isAdminView && adminPage === 'photos' && (
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

      {(!isAdminView || adminPage === 'data') && (
      <section className="records">
        <div className="recordsHeader">
          <h2>{isAdminView ? 'All Records' : 'سجلاتي'}</h2>
          {hiddenTableRows > 0 && <span className="softHint">يظهر أول {MAX_TABLE_ROWS} من {currentRows.length} فقط. استخدم الفلاتر لعرض أدق.</span>}
          {!isAdminView && (
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
                {isAdmin && <th>حذف</th>}
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
                  {isAdmin && <td>
                    <button className="dangerIcon" type="button" onClick={() => deleteRecord(active, row.id)} title="حذف">
                      <Trash2 size={16} />
                    </button>
                  </td>}
                </tr>
              ))}
              {!currentRows.length && (
                <tr>
                  <td colSpan={current.columns.length + (isAdmin ? 1 : 0)} className="empty">لا توجد سجلات حسب المستخدم والمنطقة الحالية.</td>
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
    if (!username.trim() || !password.trim()) {
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
        <p className="loginText">{adminMode ? 'أدخل رمز الأدمن للمتابعة.' : 'استخدم اسم المستخدم وكلمة المرور الخاصة بك.'}</p>

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
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="كلمة المرور" autoComplete="current-password" />
          </label>
        )}
        {adminMode && (
          <label>
            رمز الأدمن
            <input type="password" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="رمز الأدمن" />
          </label>
        )}

        {error && <div className="notice">{error}</div>}

        <button className="save" type="submit" disabled={loading || (adminMode ? !adminPin.trim() : !username.trim() || !password.trim())}>
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
