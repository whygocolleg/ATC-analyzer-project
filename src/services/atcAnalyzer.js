const API_BASE = 'http://localhost:3001';

/**
 * Send an ATC dialog to the backend for Claude-powered analysis.
 * Results are automatically saved to the database.
 */
export async function analyzeDialog(dialogText, { sourceUrl, sourceType, title, categoryId } = {}) {
  const response = await fetch(`${API_BASE}/api/analyze-dialog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dialog: dialogText, sourceUrl, sourceType, title, categoryId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error ${response.status}`);
  }

  return data;
}

/**
 * Fetch all saved analyses (optionally filtered by category).
 */
export async function fetchAnalyses(categoryId) {
  const url = categoryId
    ? `${API_BASE}/api/analyses?category=${categoryId}`
    : `${API_BASE}/api/analyses`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch analyses');
  return response.json();
}

/**
 * Fetch a single analysis with full data.
 */
export async function fetchAnalysis(id) {
  const response = await fetch(`${API_BASE}/api/analyses/${id}`);
  if (!response.ok) throw new Error('Analysis not found');
  return response.json();
}

/**
 * Delete a saved analysis.
 */
export async function deleteAnalysis(id) {
  const response = await fetch(`${API_BASE}/api/analyses/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete');
  return response.json();
}

/**
 * Update the category of an analysis.
 */
export async function updateAnalysisCategory(id, categoryId) {
  const response = await fetch(`${API_BASE}/api/analyses/${id}/category`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId }),
  });
  if (!response.ok) throw new Error('Failed to update category');
  return response.json();
}

/**
 * Search analyses by keyword.
 */
export async function searchAnalyses(query) {
  const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Search failed');
  return response.json();
}

/**
 * Fetch all categories.
 */
export async function fetchCategories() {
  const response = await fetch(`${API_BASE}/api/categories`);
  if (!response.ok) throw new Error('Failed to fetch categories');
  return response.json();
}

/**
 * Create a new category.
 */
export async function createCategory({ name, description, icon, color }) {
  const response = await fetch(`${API_BASE}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, icon, color }),
  });
  if (!response.ok) throw new Error('Failed to create category');
  return response.json();
}

/**
 * Save study progress for an analysis.
 */
export async function saveStudyProgress(analysisId, { completed, notes, rating }) {
  const response = await fetch(`${API_BASE}/api/analyses/${analysisId}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed, notes, rating }),
  });
  if (!response.ok) throw new Error('Failed to save progress');
  return response.json();
}

/**
 * Fetch dashboard stats.
 */
export async function fetchStats() {
  const response = await fetch(`${API_BASE}/api/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

/**
 * Known airport coordinates for map centering.
 */
export const AIRPORT_COORDS = {
  KJFK: { lat: 40.6413, lng: -73.7781, zoom: 13 },
  KLAX: { lat: 33.9425, lng: -118.4081, zoom: 13 },
  KORD: { lat: 41.9742, lng: -87.9073, zoom: 13 },
  KATL: { lat: 33.6407, lng: -84.4277, zoom: 13 },
  KSFO: { lat: 37.6213, lng: -122.379, zoom: 13 },
  KDFW: { lat: 32.8998, lng: -97.0403, zoom: 13 },
  KDEN: { lat: 39.8561, lng: -104.6737, zoom: 13 },
  KSEA: { lat: 47.4502, lng: -122.3088, zoom: 13 },
  KMIA: { lat: 25.7959, lng: -80.287, zoom: 13 },
  KBOS: { lat: 42.3656, lng: -71.0096, zoom: 13 },
  JFK: { lat: 40.6413, lng: -73.7781, zoom: 13 },
  LAX: { lat: 33.9425, lng: -118.4081, zoom: 13 },
  ORD: { lat: 41.9742, lng: -87.9073, zoom: 13 },
};

/**
 * Color mapping by incident type.
 */
export const INCIDENT_COLORS = {
  EMERGENCY_DECLARATION: '#ff2222',
  RUNWAY_INCURSION: '#ff6600',
  RUNWAY_CLOSURE: '#ff8800',
  FUEL_ISSUE: '#ff00cc',
  EQUIPMENT_FAILURE: '#888888',
  COMMUNICATION_ERROR: '#4499ff',
  WEATHER_DEVIATION: '#00aaff',
  SEPARATION_ISSUE: '#ffee00',
  MEDICAL_EMERGENCY: '#ff0077',
  UNAUTHORIZED_ENTRY: '#ff4400',
  OTHER: '#00ffaa',
};

export const SEVERITY_COLORS = {
  HIGH: '#ff3333',
  MEDIUM: '#ffaa00',
  LOW: '#00dd00',
};

/**
 * Place incident markers in a circle around the airport center.
 */
export function getIncidentMarkerPositions(incidents, centerLat, centerLng) {
  const radius = 0.004;
  return incidents.map((incident, i) => {
    const angle = (2 * Math.PI * i) / incidents.length - Math.PI / 2;
    return {
      ...incident,
      markerLat: centerLat + radius * Math.cos(angle),
      markerLng: centerLng + radius * Math.sin(angle),
    };
  });
}
