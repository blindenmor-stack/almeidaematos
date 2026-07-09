/**
 * Gera public/geo/globe-data.json — dados geograficos quantizados pro globo 3D
 * da secao #brasil (globe.js). Ver docs/GLOBE-SPEC.md (secao "Dados").
 *
 * Fontes:
 *  - Mundo (land mask): world-atlas land-110m (TopoJSON, jsdelivr CDN)
 *  - Estados do Brasil: click_that_hood/brazil-states.geojson (GeoJSON, github raw)
 *    fallback: IBGE malhas API se o github raw falhar
 *
 * Sem dependencias npm novas — so Node core (fetch, fs, path) + JS puro pra
 * decodificar TopoJSON e fazer ponto-em-poligono (ray casting, todos os rings).
 *
 * Uso: node scripts/generate-globe-data.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'geo');
const OUT_FILE = join(OUT_DIR, 'globe-data.json');

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';
const BRAZIL_URL = 'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson';
const IBGE_FALLBACK_URL = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF';

const WORLD_STEP = 1.75;
const WORLD_JITTER = 0.3;
const BRAZIL_STEP = 0.6;
const BRAZIL_JITTER = 0.12;

// Bbox aproximado do Brasil (com folga) — usado só pra podar testes caros
// na malha mundial (não precisamos testar "Brasil" fora dessa janela).
const BRAZIL_BBOX = { minLon: -74.5, maxLon: -28.5, minLat: -34.5, maxLat: 6 };

// Sigla por nome — fallback caso a fonte não traga `properties.sigla`
// (ex.: fallback IBGE, que pode vir só com nome/UF numérica).
const NAME_TO_UF = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA',
  'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO',
  'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
  'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', 'Rondônia': 'RO',
  'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE',
  'Tocantins': 'TO',
};

// ---------------------------------------------------------------------------
// PRNG determinístico (mulberry32) — jitter reproduzível entre execuções.
// ---------------------------------------------------------------------------
function makePrng(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// TopoJSON -> arrays de polígonos (lon,lat) puro JS.
// ---------------------------------------------------------------------------
function decodeArcs(topology) {
  const { scale, translate } = topology.transform;
  return topology.arcs.map((rawArc) => {
    let x = 0;
    let y = 0;
    const points = new Array(rawArc.length);
    for (let i = 0; i < rawArc.length; i++) {
      x += rawArc[i][0];
      y += rawArc[i][1];
      points[i] = [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    }
    return points;
  });
}

function arcPoints(index, decodedArcs) {
  if (index >= 0) return decodedArcs[index];
  // índice negativo = arco compartilhado, invertido (convenção TopoJSON: ~i)
  return decodedArcs[~index].slice().reverse();
}

function ringFromArcIndices(arcIndices, decodedArcs) {
  const ring = [];
  for (let i = 0; i < arcIndices.length; i++) {
    const pts = arcPoints(arcIndices[i], decodedArcs);
    if (i === 0) {
      for (const p of pts) ring.push(p);
    } else {
      // primeiro ponto do próximo arco == último ponto do arco anterior (nó compartilhado)
      for (let j = 1; j < pts.length; j++) ring.push(pts[j]);
    }
  }
  return ring;
}

/** Extrai polígonos [ [ring0(outer), ring1(hole), ...], ... ] de uma geometry TopoJSON. */
function geometryToPolygons(geometry, decodedArcs) {
  const polygons = [];
  if (geometry.type === 'Polygon') {
    polygons.push(geometry.arcs.map((ringArcs) => ringFromArcIndices(ringArcs, decodedArcs)));
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.arcs) {
      polygons.push(poly.map((ringArcs) => ringFromArcIndices(ringArcs, decodedArcs)));
    }
  } else if (geometry.type === 'GeometryCollection') {
    for (const g of geometry.geometries) {
      polygons.push(...geometryToPolygons(g, decodedArcs));
    }
  }
  return polygons;
}

// ---------------------------------------------------------------------------
// GeoJSON MultiPolygon/Polygon (coordinates já em lon,lat) -> mesma forma
// [ [ring0, ring1, ...], ... ] usada pelo point-in-polygon abaixo.
// ---------------------------------------------------------------------------
function geoJsonGeometryToPolygons(geometry) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Ponto-em-polígono: ray casting sobre TODOS os rings (buracos subtraem
// naturalmente porque o XOR por ring equivale ao XOR sobre todas as arestas).
// ---------------------------------------------------------------------------
function rayCastRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersects = (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInRings(lon, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    if (rayCastRing(lon, lat, ring)) inside = !inside;
  }
  return inside;
}

function pointInPolygons(lon, lat, polygons) {
  for (const rings of polygons) {
    if (pointInRings(lon, lat, rings)) return true;
  }
  return false;
}

function ringBbox(ring) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function polygonsBbox(polygons) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const rings of polygons) {
    const b = ringBbox(rings[0]);
    if (b.minLon < minLon) minLon = b.minLon;
    if (b.maxLon > maxLon) maxLon = b.maxLon;
    if (b.minLat < minLat) minLat = b.minLat;
    if (b.maxLat > maxLat) maxLat = b.maxLat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function inBbox(lon, lat, bbox, pad = 0) {
  return lon >= bbox.minLon - pad && lon <= bbox.maxLon + pad &&
    lat >= bbox.minLat - pad && lat <= bbox.maxLat + pad;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Baixando world-atlas land-110m...');
  const topology = await fetchJson(WORLD_URL);
  const decodedArcs = decodeArcs(topology);
  const landGeometry = topology.objects.land;
  const worldPolygons = geometryToPolygons(landGeometry, decodedArcs);
  const worldBbox = polygonsBbox(worldPolygons);
  console.log(`  -> ${worldPolygons.length} polígonos de terra decodificados.`);

  console.log('Baixando estados do Brasil...');
  let brazilFeatureCollection;
  try {
    brazilFeatureCollection = await fetchJson(BRAZIL_URL);
    if (!brazilFeatureCollection?.features?.length) throw new Error('sem features');
  } catch (err) {
    console.warn(`  fonte principal falhou (${err.message}), tentando fallback IBGE...`);
    brazilFeatureCollection = await fetchJson(IBGE_FALLBACK_URL);
  }

  const ufs = [];
  const stateEntries = []; // { polygons, bbox, index }
  for (const feature of brazilFeatureCollection.features) {
    const props = feature.properties || {};
    const name = props.name || props.NM_ESTADO || props.NOME || 'Desconhecido';
    const uf = props.sigla || props.SIGLA_UF || props.UF || NAME_TO_UF[name] || '??';
    const polygons = geoJsonGeometryToPolygons(feature.geometry);
    if (!polygons.length) continue;

    // Centroide simples = média dos vértices do maior ring (maior nº de vértices,
    // proxy pro contorno principal/continental do estado).
    let biggestRing = null;
    for (const rings of polygons) {
      for (const ring of rings) {
        if (!biggestRing || ring.length > biggestRing.length) biggestRing = ring;
      }
    }
    let sumLon = 0, sumLat = 0;
    for (const [lon, lat] of biggestRing) { sumLon += lon; sumLat += lat; }
    const centroidLon = sumLon / biggestRing.length;
    const centroidLat = sumLat / biggestRing.length;

    const index = ufs.length;
    ufs.push({
      name,
      uf,
      lat: Math.round(centroidLat * 100) / 100,
      lon: Math.round(centroidLon * 100) / 100,
    });
    stateEntries.push({ polygons, bbox: polygonsBbox(polygons), index });
  }
  console.log(`  -> ${ufs.length} estados carregados.`);
  if (ufs.length !== 27) {
    console.warn(`  AVISO: esperado 27 estados, obtido ${ufs.length}.`);
  }

  // Testa se um ponto cai em algum estado; retorna o ufIndex ou -1.
  function findUfIndex(lon, lat) {
    for (const entry of stateEntries) {
      if (!inBbox(lon, lat, entry.bbox, 0.05)) continue;
      if (pointInPolygons(lon, lat, entry.polygons)) return entry.index;
    }
    return -1;
  }

  function isInsideBrazil(lon, lat) {
    return findUfIndex(lon, lat) !== -1;
  }

  // -------------------------------------------------------------------------
  // Grade do mundo (exclui Brasil)
  //
  // Grade lat/lon "crua" (mesmo passo de longitude em toda latitude) super-
  // amostra os polos: as linhas de longitude convergem lá, então a mesma
  // contagem de pontos por linha representa uma área física cada vez menor
  // -> clumping visual feio no globo e ~3x mais pontos que o necessário.
  // Escalamos o passo de longitude por 1/cos(lat) (mais espaçado perto dos
  // polos) pra manter densidade ~uniforme na esfera, igual todo globo de
  // pontos decente faz. O passo em latitude continua exatamente WORLD_STEP.
  // -------------------------------------------------------------------------
  console.log('Gerando grade do mundo...');
  const worldRand = makePrng(20260709); // seed fixa
  const world = [];
  for (let lat = -90; lat <= 90; lat += WORLD_STEP) {
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.02);
    const lonStep = WORLD_STEP / cosLat;
    if (lat < worldBbox.minLat - 1 || lat > worldBbox.maxLat + 1) continue; // linha inteira fora da terra
    for (let lon = -180; lon <= 180; lon += lonStep) {
      if (!inBbox(lon, lat, worldBbox, 1)) continue;
      if (!pointInPolygons(lon, lat, worldPolygons)) continue;
      // poda: só testamos exclusão do Brasil se o ponto cai na bbox dele
      if (inBbox(lon, lat, BRAZIL_BBOX, 0) && isInsideBrazil(lon, lat)) continue;

      const jLat = lat + (worldRand() * 2 - 1) * WORLD_JITTER;
      const jLon = lon + (worldRand() * 2 - 1) * WORLD_JITTER;
      world.push([Math.round(jLat * 100), Math.round(jLon * 100)]);
    }
  }
  console.log(`  -> ${world.length} pontos no mundo.`);

  // -------------------------------------------------------------------------
  // Grade do Brasil (com ufIndex) — mesma correção cos(lat), efeito pequeno
  // dentro da faixa de latitude do Brasil mas mantém a densidade consistente
  // com a grade do mundo.
  // -------------------------------------------------------------------------
  console.log('Gerando grade do Brasil...');
  const brazilRand = makePrng(20260709171); // seed fixa (distinta da do mundo)
  const brazil = [];
  for (let lat = BRAZIL_BBOX.minLat; lat <= BRAZIL_BBOX.maxLat; lat += BRAZIL_STEP) {
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.02);
    const lonStep = BRAZIL_STEP / cosLat;
    for (let lon = BRAZIL_BBOX.minLon; lon <= BRAZIL_BBOX.maxLon; lon += lonStep) {
      const ufIndex = findUfIndex(lon, lat);
      if (ufIndex === -1) continue;

      const jLat = lat + (brazilRand() * 2 - 1) * BRAZIL_JITTER;
      const jLon = lon + (brazilRand() * 2 - 1) * BRAZIL_JITTER;
      brazil.push([Math.round(jLat * 100), Math.round(jLon * 100), ufIndex]);
    }
  }
  console.log(`  -> ${brazil.length} pontos no Brasil.`);

  // -------------------------------------------------------------------------
  // Salva
  // -------------------------------------------------------------------------
  const data = { world, brazil, ufs };
  const json = JSON.stringify(data);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, json, 'utf8');

  const bytes = Buffer.byteLength(json, 'utf8');
  console.log('---');
  console.log(`Pontos mundo:  ${world.length}`);
  console.log(`Pontos Brasil: ${brazil.length}`);
  console.log(`Estados:       ${ufs.length}`);
  console.log(`Arquivo:       ${OUT_FILE}`);
  console.log(`Tamanho:       ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);
  if (bytes > 90 * 1024) {
    console.warn('AVISO: acima da meta de 90KB.');
  }
}

main().catch((err) => {
  console.error('Falha ao gerar globe-data.json:', err);
  process.exit(1);
});
