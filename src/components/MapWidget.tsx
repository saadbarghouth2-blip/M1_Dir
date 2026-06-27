import React, { useMemo, useState, useEffect, useRef } from "react";
import { junctions, manualCountStations, directions, zones } from "../data";
import { Junction, Direction, Zone, ManualCountStation, TrafficCount } from "../types";
import { utmToLatLng } from "../utils/geo";
import { Compass, AlertCircle, RefreshCw, Layers, ZoomIn, Info } from "lucide-react";
import { Language, ui } from "../i18n";

interface MapWidgetProps {
  activeTab: "COUNTS" | "DIRECTIONS";
  selectedJunction: string | null;
  selectedDirection: number | null;
  onSelectJunction: (code: string | null) => void;
  onSelectDirection: (id: number | null) => void;
  hourlyData: TrafficCount[];
  language?: Language;
}

type MapProvider = "DARK" | "STREET" | "SATELLITE";

const pointColors = [
  "#38bdf8", "#22c55e", "#f43f5e", "#ec4899", "#eab308", "#a855f7",
  "#ff7300", "#06b6d4", "#10b981", "#6366f1", "#ef4444", "#f59e0b",
  "#d946ef", "#84cc16", "#14b8a6", "#7cfc00", "#b45309", "#1e90ff",
  "#e11d48", "#7c3aed", "#0f766e", "#059669"
];

const getPointNumber = (code: string) => {
  const exactIndex = junctions.findIndex((junction) => junction.code === code);
  if (exactIndex >= 0) return exactIndex + 1;

  const compoundMatch = code.match(/[A-Z](\d+)-(\d+)/i);
  if (compoundMatch) {
    return (Number(compoundMatch[1]) - 1) * 5 + Number(compoundMatch[2]);
  }

  const match = code.match(/[A-Z](\d+)/i);
  return match ? Number(match[1]) : 1;
};

export const getGroupColor = (memberCode: string) => {
  return pointColors[(getPointNumber(memberCode) - 1) % pointColors.length];
};

export const getPersonColor = (code: string) => {
  return getGroupColor(code);
};

// 1c. Get a unique high-contrast color for each specific direction/route ID
export const getDirectionColor = (dirId: number) => {
  const colors = [
    "#38bdf8", // Sky Blue
    "#f43f5e", // Crimson Rose
    "#10b981", // Mint Green
    "#eab308", // Yellow
    "#ec4899", // Hot Pink
    "#a855f7", // Electric Violet
    "#ff7300", // Electric Orange
    "#06b6d4", // Cyan
    "#6366f1", // Indigo
    "#ef4444", // Red
    "#14b8a6", // Teal
    "#d946ef", // Fuchsia
    "#f59e0b", // Amber
    "#84cc16", // Lime
    "#7cfc00", // Lawn Green
    "#1e90ff", // Dodger Blue
    "#b45309", // Rust Orange
    "#e11d48", // Rose Red
    "#7c3aed", // Violet
    "#0f766e", // Teal Cyan
    "#059669", // Forest Emerald
    "#f97316", // Orange-500
    "#3b82f6", // Blue-500
    "#8b5cf6", // Purple-500
  ];
  return colors[dirId % colors.length];
};

const getZoneColor = (code: string) => {
  switch (code) {
    case "A": return "#38bdf8";
    case "B": return "#10b981";
    case "C": return "#f59e0b";
    case "D": return "#f43f5e";
    case "E": return "#a855f7";
    case "F": return "#14b8a6";
    case "G": return "#eab308";
    default: return "#94a3b8";
  }
};

// Helper to calculate segment midpoint and orientation bearing in degrees (0 to 360)
export const getMidpointAndAngle = (latLngs: [number, number][]) => {
  if (latLngs.length < 2) return null;
  const midIndex = Math.floor(latLngs.length / 2);
  const p1 = latLngs[midIndex - 1];
  const p2 = latLngs[midIndex];
  const midLat = (p1[0] + p2[0]) / 2;
  const midLng = (p1[1] + p2[1]) / 2;
  
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;
  const lat1Rad = p1[0] * Math.PI / 180;
  const lat2Rad = p2[0] * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  const angle = (brng + 360) % 360;
  return { midLat, midLng, angle };
};

// Helper to offset path coordinates perpendicularly to prevent overlapping of two-way or parallel routes
export const offsetPath = (latLngs: [number, number][], offsetAmount: number): [number, number][] => {
  if (latLngs.length < 2 || offsetAmount === 0) return latLngs;

  const result: [number, number][] = [];

  for (let i = 0; i < latLngs.length; i++) {
    let dy = 0;
    let dx = 0;

    if (i === 0) {
      dy = latLngs[1][0] - latLngs[0][0];
      dx = latLngs[1][1] - latLngs[0][1];
    } else if (i === latLngs.length - 1) {
      dy = latLngs[i][0] - latLngs[i - 1][0];
      dx = latLngs[i][1] - latLngs[i - 1][1];
    } else {
      const dy1 = latLngs[i][0] - latLngs[i - 1][0];
      const dx1 = latLngs[i][1] - latLngs[i - 1][1];
      const dy2 = latLngs[i + 1][0] - latLngs[i][0];
      const dx2 = latLngs[i + 1][1] - latLngs[i][1];

      const len1 = Math.sqrt(dy1 * dy1 + dx1 * dx1) || 1;
      const len2 = Math.sqrt(dy2 * dy2 + dx2 * dx2) || 1;

      dy = (dy1 / len1) + (dy2 / len2);
      dx = (dx1 / len1) + (dx2 / len2);
    }

    const len = Math.sqrt(dy * dy + dx * dx);
    if (len === 0) {
      result.push([latLngs[i][0], latLngs[i][1]]);
      continue;
    }

    // Perpendicular vector to the right (clockwise)
    const ny = -dx / len;
    const nx = dy / len;

    result.push([
      latLngs[i][0] + ny * offsetAmount,
      latLngs[i][1] + nx * offsetAmount
    ]);
  }

  return result;
};

// Helper to interpolate a latitude/longitude coordinate at a specific progress (0 to 1) along a polyline path
export const getPointAlongPath = (path: [number, number][], p: number): [number, number] => {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];
  if (p <= 0) return path[0];
  if (p >= 1) return path[path.length - 1];

  const totalSegments = path.length - 1;
  const floatIndex = p * totalSegments;
  const index = Math.floor(floatIndex);
  const remainder = floatIndex - index;

  const start = path[index];
  const end = path[index + 1];

  const lat = start[0] + (end[0] - start[0]) * remainder;
  const lng = start[1] + (end[1] - start[1]) * remainder;
  return [lat, lng];
};

// Helper to calculate heading bearing (0 to 360 degrees) between two LatLng coords
export const getBearing = (start: [number, number], end: [number, number]): number => {
  const lat1 = start[0] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const dLng = (end[1] - start[1]) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
};

// 2. Dynamic high-tech vector avatar/person symbology helper that varies per point
export const getPersonIconHtml = (code: string, isSelected: boolean, groupColor: string, loadPercentage: number) => {
  const group = code.split("-")[0];
  let avatarSvg = "";
  let roleTitle = "راصد";
  
  switch (group) {
    case "J2":
      roleTitle = "رائد حركة";
      avatarSvg = `
        <g stroke="${groupColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3" fill="${groupColor}" fill-opacity="0.25"/>
          <path d="M8 8.5c0-1.8 1.8-2.5 4-2.5s4 .7 4 2.5H8z" fill="${groupColor}"/>
          <path d="M5 20c0-3 3-4 7-4s7 1 7 4" />
          <polygon points="12,16.5 13,18 11,18" fill="${groupColor}" />
        </g>
      `;
      break;
    case "J3":
      roleTitle = "مهندس حركة";
      avatarSvg = `
        <g stroke="${groupColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3" fill="${groupColor}" fill-opacity="0.25"/>
          <path d="M8.5 7.5c0-2.5 2-3.5 3.5-3.5s3.5 1 3.5 3.5h-7z" fill="${groupColor}"/>
          <path d="M5 20c0-3 3-4 7-4s7 1 7 4" />
          <path d="M9 16.5v3.5M15 16.5v3.5" stroke="#ffffff" stroke-width="1" />
        </g>
      `;
      break;
    case "J4":
      roleTitle = "مشرف شبكة";
      avatarSvg = `
        <g stroke="${groupColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3" fill="${groupColor}" fill-opacity="0.25"/>
          <path d="M8 8a4 4 0 0 1 8 0" />
          <rect x="7" y="7.5" width="1.5" height="2" rx="0.5" fill="${groupColor}" />
          <rect x="15.5" y="7.5" width="1.5" height="2" rx="0.5" fill="${groupColor}" />
          <path d="M5 20c0-3 3-4 7-4s7 1 7 4" />
          <path d="M11.5 16.5l.5 2.5.5-2.5h-1z" fill="${groupColor}" />
        </g>
      `;
      break;
    case "J5":
      roleTitle = "فني صيانة";
      avatarSvg = `
        <g stroke="${groupColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3" fill="${groupColor}" fill-opacity="0.25"/>
          <path d="M9 6.5c1-1 3-1 4 0l1.5.5v1.5H9v-2z" fill="${groupColor}"/>
          <path d="M5 20c0-3 3-4 7-4s7 1 7 4" />
          <circle cx="12" cy="18" r="1.2" fill="${groupColor}"/>
        </g>
      `;
      break;
    case "J6":
      roleTitle = "خبير ذكاء";
      avatarSvg = `
        <g stroke="${groupColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3" fill="${groupColor}" fill-opacity="0.25"/>
          <path d="M9.5 8h5" stroke="${groupColor}" stroke-width="2.5" />
          <path d="M5 20c0-3 3-4 7-4s7 1 7 4" />
          <circle cx="12" cy="17.5" r="1" fill="#ffffff" />
        </g>
      `;
      break;
    case "J7":
      roleTitle = "مراقب بلدي";
      avatarSvg = `
        <g stroke="${groupColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3" fill="${groupColor}" fill-opacity="0.25"/>
          <path d="M8.5 6h7l-1 2H9.5l-1-2z" fill="${groupColor}"/>
          <path d="M5 20c0-3 3-4 7-4s7 1 7 4" />
          <rect x="11" y="17" width="2" height="2.5" rx="0.2" fill="${groupColor}"/>
        </g>
      `;
      break;
    case "J8":
    default:
      roleTitle = "راصد ميداني";
      avatarSvg = `
        <g stroke="${groupColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3" fill="${groupColor}" fill-opacity="0.25"/>
          <path d="M5 20c0-3 3-4 7-4s7 1 7 4" />
          <path d="M9.5 11h5" stroke="${groupColor}" stroke-width="1.5" />
        </g>
      `;
      break;
  }

  const activeRing = isSelected 
    ? `border: 2px solid #ffffff; box-shadow: 0 0 14px ${groupColor}, inset 0 0 6px ${groupColor}; transform: scale(1.1); z-index: 1000;` 
    : `border: 1.5px solid ${groupColor}cc; box-shadow: 0 0 6px ${groupColor}40;`;

  return `
    <div class="relative w-12 h-12 -ml-6 -mt-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110">
      <div class="w-9 h-9 rounded-full bg-slate-950/95 flex items-center justify-center relative shadow-lg" style="${activeRing}">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${avatarSvg}
        </svg>
        <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-slate-950 shadow-md ${
          loadPercentage > 75 ? "bg-red-500 animate-pulse" : loadPercentage > 40 ? "bg-amber-500" : "bg-emerald-400"
        }"></span>
      </div>
      <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-slate-800 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1 z-10">
        <span class="text-slate-300 font-mono">${code}</span>
        <span style="color: ${groupColor}; opacity: 0.9;">${roleTitle}</span>
      </div>
    </div>
  `;
};

// 2b. Helper to generate modern glowing SVG elements for vehicles (cars, buses, trucks)
export const getVehicleIconHtml = (type: "car" | "bus" | "truck", angle: number, isDimmed: boolean) => {
  let color = "#38bdf8"; // car sky blue
  let svgContent = "";

  if (type === "car") {
    color = "#38bdf8"; // sky blue
    svgContent = `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM6 16c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="currentColor" />`;
  } else if (type === "bus") {
    color = "#10b981"; // emerald green
    svgContent = `<path d="M4 16c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h10v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-3.5l-.34-2.72c-.17-.86-.92-1.28-1.78-1.28H7.12c-.86 0-1.61.42-1.78 1.28L5 12.5V16zm12-8.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm-8 0C7.17 7.5 6.5 8.17 6.5 9s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5S8.83 7.5 8 7.5z" fill="currentColor" />`;
  } else {
    color = "#f59e0b"; // warm amber
    svgContent = `<path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm11.5-10h2.25L21 11.25V13h-3.5V8.5zM18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="currentColor" stroke="none" />`;
  }

  const opacity = isDimmed ? 0.15 : 0.95;

  return `
    <div class="relative flex items-center justify-center transition-all duration-100" style="width: 20px; height: 20px; opacity: ${opacity};">
      <div class="absolute w-5 h-5 rounded-full" style="background-color: ${color}; filter: blur(3px); opacity: 0.5;"></div>
      <div class="w-5.5 h-5.5 rounded-full flex items-center justify-center shadow-md bg-slate-950 border border-slate-700/60" style="transform: rotate(${angle}deg);">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" style="color: ${color};">
          ${svgContent}
        </svg>
      </div>
    </div>
  `;
};

export const MapWidget: React.FC<MapWidgetProps> = ({
  activeTab,
  selectedJunction,
  selectedDirection,
  onSelectJunction,
  onSelectDirection,
  hourlyData,
  language = "ar"
}) => {
  const t = ui[language];
  const isCountsMode = activeTab === "COUNTS";
  const [mapProvider, setMapProvider] = useState<MapProvider>("DARK");
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  // Interactive Simulation controls
  const [simSpeed, setSimSpeed] = useState<number>(1); // Speed multiplier: 0.5, 1, 1.5, 2
  const [vehicleDensity, setVehicleDensity] = useState<number>(2); // Vehicles per route: 1, 2, 3, 4
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | "car" | "bus" | "truck">("all");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const layersGroupRef = useRef<any>(null);

  // Get active volumes per direction to determine color coding
  const directionVolumes = useMemo(() => {
    const volumes: { [key: number]: { volume: number; speed: number } } = {};
    hourlyData.forEach((item) => {
      if (!volumes[item.directionId]) {
        volumes[item.directionId] = { volume: 0, speed: 0 };
      }
      volumes[item.directionId].volume += item.volume;
      volumes[item.directionId].speed = item.speed;
    });
    return volumes;
  }, [hourlyData]);

  // Determine line color based on volume intensity
  const getRouteColor = (dirId: number) => {
    const stats = directionVolumes[dirId];
    if (!stats) return "#475569"; // slate-600
    const vol = stats.volume;
    if (vol > 1500) return "#ef4444"; // high volume (red)
    if (vol > 800) return "#f59e0b"; // moderate volume (amber)
    return "#10b981"; // light volume (green)
  };

  // 1. Dynamically load Leaflet CDN JS and CSS
  useEffect(() => {
    const loadLeaflet = () => {
      if ((window as any).L) {
        setLeafletLoaded(true);
        return;
      }

      // Load CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Load JS
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    };

    loadLeaflet();
  }, []);

  // 2. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Calculate center based on all mapped point layers.
    const coords = [...junctions, ...manualCountStations].map((j) => utmToLatLng(j.x, j.y));
    const lats = coords.map((c) => c[0]);
    const lngs = coords.map((c) => c[1]);
    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      tapTolerance: 24
    });

    if (window.matchMedia("(max-width: 640px)").matches) {
      map.zoomControl.setPosition("bottomright");
    }

    mapInstanceRef.current = map;

    // Initialize Layers Group
    layersGroupRef.current = L.featureGroup().addTo(map);

    // Initial tile layer
    const getTileUrl = (provider: MapProvider) => {
      switch (provider) {
        case "STREET":
          return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        case "SATELLITE":
          return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        case "DARK":
        default:
          return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      }
    };

    const getTileAttrib = (provider: MapProvider) => {
      switch (provider) {
        case "SATELLITE":
          return "Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
        case "DARK":
          return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
        case "STREET":
        default:
          return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      }
    };

    tileLayerRef.current = L.tileLayer(getTileUrl(mapProvider), {
      attribution: getTileAttrib(mapProvider),
      maxZoom: 20
    }).addTo(map);

    // Fit map to layers bounds initially
    setTimeout(() => {
      if (mapInstanceRef.current && layersGroupRef.current) {
        const bounds = layersGroupRef.current.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
        }
      }
    }, 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded]);

  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;

    const invalidateMapSize = () => {
      window.setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 80);
    };

    invalidateMapSize();

    const resizeObserver = new ResizeObserver(invalidateMapSize);
    resizeObserver.observe(mapContainerRef.current);
    window.addEventListener("orientationchange", invalidateMapSize);
    window.addEventListener("resize", invalidateMapSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("orientationchange", invalidateMapSize);
      window.removeEventListener("resize", invalidateMapSize);
    };
  }, [leafletLoaded, isMapExpanded, isLegendOpen, activeTab]);

  // 3. Update Tile layer when provider changes
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const getTileUrl = (provider: MapProvider) => {
      switch (provider) {
        case "STREET":
          return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        case "SATELLITE":
          return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        case "DARK":
        default:
          return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      }
    };

    const getTileAttrib = (provider: MapProvider) => {
      switch (provider) {
        case "SATELLITE":
          return "Esri &mdash; Esri, DeLorme, NAVTEQ";
        case "DARK":
          return '&copy; <a href="https://carto.com/attributions">CARTO</a>';
        case "STREET":
        default:
          return '&copy; OSM contributors';
      }
    };

    tileLayerRef.current = L.tileLayer(getTileUrl(mapProvider), {
      attribution: getTileAttrib(mapProvider),
      maxZoom: 20
    }).addTo(mapInstanceRef.current);
  }, [mapProvider, leafletLoaded]);

  // 4. Plot / update items on leaflet map dynamically on state/filters changes
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !layersGroupRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Clear previous layers
    layersGroupRef.current.clearLayers();
    const mappedStations = isCountsMode ? manualCountStations : junctions;

    // Pool for tracking all animated vehicles
    const animatedVehicles: {
      id: string;
      type: "car" | "bus" | "truck";
      path: [number, number][];
      progress: number;
      speed: number;
      marker: any;
      directionId: number;
    }[] = [];

    // A. Plot Zones
    zones.forEach((zone) => {
      const latLngs = zone.rings[0].map((coord) => utmToLatLng(coord[0], coord[1]));
      const zoneColor = getZoneColor(zone.code);
      
      const polygon = L.polygon(latLngs, {
        color: zoneColor,
        weight: 1.4,
        fillColor: zoneColor,
        fillOpacity: 0.12,
        dashArray: "4, 4"
      }).addTo(layersGroupRef.current);

      polygon.bindTooltip(`<div class="text-right text-xs font-sans"><b>المنطقة المرورية ${zone.code}</b><br>رقم المنطقة: ${zone.id}<br>المساحة: ${zone.area.toFixed(0)} م²</div>`, {
        sticky: true,
        className: "custom-leaflet-tooltip"
      });
    });

    // B. Plot Directions
    const visibleDirections = directions
      .filter((dir) => !selectedJunction || dir.member_code === selectedJunction)
      .filter((dir) => !selectedDirection || dir.id === selectedDirection);
    const routeLaneOffsets = new Map<number, number>();
    const routesByObserver = new Map<string, Direction[]>();

    visibleDirections.forEach((dir) => {
      const key = dir.member_code;
      routesByObserver.set(key, [...(routesByObserver.get(key) || []), dir]);
    });

    routesByObserver.forEach((observerRoutes) => {
      observerRoutes.forEach((dir, index) => {
        const centeredIndex = index - ((observerRoutes.length - 1) / 2);
        routeLaneOffsets.set(dir.id, centeredIndex * 0.000022);
      });
    });

    // B. Plot Directions as separated lane-level routes. Each visible direction
    // gets its own offset lane and its own animated vehicle stream.
    if (!isCountsMode) visibleDirections
      .forEach((dir) => {
      let latLngs = dir.paths.map((coord) => utmToLatLng(coord[0], coord[1]));
      
      // Calculate a smart dynamic perpendicular offset to separate opposing & overlapping routes cleanly.
      // We vary the offset slightly based on dir.id so that multiple overlapping directions are displayed as parallel multi-lane roads.
      const laneOffset = routeLaneOffsets.get(dir.id) || 0;
      latLngs = offsetPath(latLngs, laneOffset);
      
      // In directions/observers mode, every observer/person owns a stable color,
      // and all roads assigned to that person use that same color.
      const color = getPersonColor(dir.member_code);
      const isSelected = selectedDirection === dir.id;
      
      const stats = directionVolumes[dir.id] || { volume: 0, speed: 50 };

      // Determine flow animation color & speed based on real-time volume density
      let flowColor = "#10b981"; // emerald for light
      let flowClassName = "traffic-flow-fast";
      if (stats.volume > 1500) {
        flowColor = "#ef4444"; // red for heavy
        flowClassName = "traffic-flow-slow";
      } else if (stats.volume > 800) {
        flowColor = "#f59e0b"; // amber for moderate
        flowClassName = "traffic-flow-medium";
      }

      // If in counts mode, we want a high-contrast bright flowing particle layer to represent moving cars on top of the colored congestion roads!
      if (isCountsMode) {
        flowColor = "#ffffff";
      }

      // Wide hover boundary polyline for easy clicking
      const clickHandlerPolyline = L.polyline(latLngs, {
        color: "transparent",
        weight: 18,
        interactive: true
      }).addTo(layersGroupRef.current);

      // Layer 1: Black backdrop line to make routes pop perfectly on all map views (satellite, street, dark)
      const basePolyline = L.polyline(latLngs, {
        color: "#020617",
        weight: isSelected ? 8 : 5.5,
        opacity: selectedDirection && !isSelected ? 0.15 : 0.95,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(layersGroupRef.current);

      // Layer 2: Main core colored polyline representing the road's active color
      const visualPolyline = L.polyline(latLngs, {
        color: color,
        weight: isSelected ? 5.5 : 3.8,
        opacity: selectedDirection && !isSelected ? 0.25 : 0.9,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(layersGroupRef.current);

      // Layer 3: Dynamic flow animator representing live cars running
      const flowPolyline = L.polyline(latLngs, {
        color: flowColor,
        weight: 1.8,
        opacity: selectedDirection && !isSelected ? 0.1 : 0.85,
        lineCap: "round",
        lineJoin: "round",
        className: flowClassName
      }).addTo(layersGroupRef.current);

      // Bind events
      const handleClick = () => {
        onSelectDirection(isSelected ? null : dir.id);
      };

      clickHandlerPolyline.on("click", handleClick);
      visualPolyline.on("click", handleClick);
      flowPolyline.on("click", handleClick);

      // Tooltip breakdown showing both the person responsible and the traffic count details depending on active mode
      const tooltipContent = isCountsMode ? `
        <div class="text-right font-sans text-xs p-1 w-[250px] max-w-[250px]">
          <div class="font-bold text-white mb-1 flex items-center justify-between gap-3">
            <span style="color: ${color};">مسار حركة ${dir.dir}</span>
            <span class="bg-indigo-950/80 px-1.5 py-0.5 rounded font-mono text-[9px] text-indigo-400">حجم المرور والعد</span>
          </div>
          <div class="text-slate-300">حالة تدفق السير: <span class="font-bold" style="color: ${color};">${stats.volume > 1500 ? "مزدحم ومتباطئ" : stats.volume > 800 ? "متوسط وكثيف" : "سلس وانسيابي"}</span></div>
          <div class="text-slate-300">حجم التدفق الحالي: <span class="font-bold text-white font-mono">${stats.volume.toLocaleString()}</span> مركبة/ساعة</div>
          <div class="text-slate-300">السرعة التشغيلية: <span class="font-bold text-amber-400 font-mono">${stats.speed} كم/ساعة</span></div>
          <div class="text-[10px] text-indigo-300 mt-1.5 border-t border-slate-800/60 pt-1">انقر للتصفية السريعة للمسار</div>
        </div>
      ` : `
        <div class="text-right font-sans text-xs p-1 w-[250px] max-w-[250px]">
          <div class="font-bold text-white mb-1 flex items-center justify-between gap-3">
            <span style="color: ${color};">مسار حركة ${dir.dir}</span>
            <span class="bg-indigo-950/80 px-1.5 py-0.5 rounded font-mono text-[9px]" style="color: ${color};">الراصد: ${dir.member_code}</span>
          </div>
          <div class="text-slate-300">توزيع الاتجاهات: <span class="font-bold font-mono" style="color: ${color};">${dir.dir}</span></div>
          <div class="text-slate-300">التدفق المرصود الحالي: <span class="font-bold text-white font-mono">${stats.volume.toLocaleString()}</span> مركبة/ساعة</div>
          <div class="text-slate-300">السرعة التشغيلية: <span class="font-bold text-amber-400 font-mono">${stats.speed} كم/ساعة</span></div>
          <div class="text-[10px] text-indigo-300 mt-1.5 border-t border-slate-800/60 pt-1">انقر للتصفية السريعة للمسار</div>
        </div>
      `;

      const tooltipOptions = { sticky: true, className: "custom-leaflet-tooltip" };
      visualPolyline.bindTooltip(tooltipContent, tooltipOptions);
      clickHandlerPolyline.bindTooltip(tooltipContent, tooltipOptions);

      // Add high-tech rotated flow direction arrow at the center of the road segment
      const midInfo = getMidpointAndAngle(latLngs);
      if (midInfo) {
        const { midLat, midLng, angle } = midInfo;
        
        const arrowHtml = `
          <div class="relative flex items-center justify-center transition-transform hover:scale-125 cursor-pointer" style="transform: rotate(${angle}deg); width: 24px; height: 24px;">
            <div class="absolute w-5 h-5 rounded-full bg-slate-950/95 border border-slate-800 shadow-xl flex items-center justify-center" style="box-shadow: 0 0 10px ${color}bf, inset 0 0 4px ${color}50;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 10H9V22H15V10H20L12 2Z" fill="${color}" stroke="#000000" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        `;
        
        const arrowIcon = L.divIcon({
          className: "custom-direction-arrow-icon",
          html: arrowHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        const arrowMarker = L.marker([midLat, midLng], {
          icon: arrowIcon,
          interactive: true
        }).addTo(layersGroupRef.current);
        
        arrowMarker.on("click", handleClick);
        arrowMarker.bindTooltip(tooltipContent, tooltipOptions);
      }

      // Spawn dynamic vehicles along this offset road path
      const numVehicles = Math.max(vehicleDensity, 2); // every separated lane carries its own vehicles
      for (let vIdx = 0; vIdx < numVehicles; vIdx++) {
        const p = (vIdx / numVehicles) + Math.random() * 0.15; // evenly distribute and add tiny random offset
        const progress = p % 1.0;
        
        let type: "car" | "bus" | "truck" = "car";
        if (activeTypeFilter === "all") {
          type = Math.random() < 0.65 ? "car" : Math.random() < 0.5 ? "bus" : "truck";
        } else {
          type = activeTypeFilter;
        }
        
        // Speed calculated based on the road's operational speed to reflect realistic congestion!
        const roadStats = directionVolumes[dir.id] || { volume: 0, speed: 50 };
        // Base increment per tick depending on operational speed
        const speed = (roadStats.speed / 100) * 0.0022 + Math.random() * 0.0006;
        
        const pos = getPointAlongPath(latLngs, progress);
        const nextPos = getPointAlongPath(latLngs, Math.min(progress + 0.005, 1));
        const angle = getBearing(pos, nextPos);
        
        const isDimmed = selectedDirection !== null && selectedDirection !== dir.id;
        const initialIconHtml = getVehicleIconHtml(type, angle, isDimmed);
        const customVehicleIcon = L.divIcon({
          className: "custom-vehicle-marker",
          html: initialIconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        
        const vehicleMarker = L.marker(pos, {
          icon: customVehicleIcon,
          interactive: false // Vehicles just float/move on top, no clicking needed
        }).addTo(layersGroupRef.current);
        
        animatedVehicles.push({
          id: `${dir.id}-${vIdx}`,
          type,
          path: latLngs,
          progress,
          speed,
          marker: vehicleMarker,
          directionId: dir.id
        });
      }
    });

    // C. Plot Junctions / manual count stations
    mappedStations.forEach((j) => {
      const latLng = utmToLatLng(j.x, j.y);
      const isSelected = selectedJunction === j.code;
      const manualStation = "crew" in j ? j as ManualCountStation : null;

      const junctionVolume = hourlyData
          .filter((item) => item.junctionCode === j.code)
          .reduce((sum, item) => sum + item.volume, 0);

      // Calculate load ratio (based on max volume capacity of 4000)
      const maxCapacity = 4000;
      const loadPercentage = Math.min(Math.round((junctionVolume / maxCapacity) * 100), 100);

      let iconHtml = "";
      if (isCountsMode) {
        // COUNTS Mode: High-Tech glowing radar sensor node
        let glowColor = "rgba(16, 185, 129, 0.45)"; // emerald
        let coreColorClass = "bg-emerald-400";
        let statusTextColor = "text-emerald-400";
        
        if (loadPercentage > 75) {
          glowColor = "rgba(239, 68, 68, 0.6)"; // red
          coreColorClass = "bg-red-500";
          statusTextColor = "text-red-400";
        } else if (loadPercentage > 40) {
          glowColor = "rgba(245, 158, 11, 0.6)"; // amber
          coreColorClass = "bg-amber-500";
          statusTextColor = "text-amber-400";
        }

        const ringColor = isSelected ? "border-indigo-400 scale-110 shadow-indigo-500/50" : "border-indigo-500/30";
        iconHtml = `
          <div class="relative w-16 h-16 -ml-8 -mt-8 flex items-center justify-center cursor-pointer transition-all duration-200">
            <div class="absolute w-10 h-10 rounded-full animate-ping opacity-25" style="box-shadow: 0 0 12px ${glowColor};"></div>
            <div class="absolute w-8 h-8 rounded-full" style="box-shadow: 0 0 16px ${glowColor}; opacity: 0.6;"></div>
            
            <div class="absolute w-8 h-8 rounded-full border-2 ${ringColor} bg-slate-950/95 flex items-center justify-center shadow-2xl">
              <span class="w-3.5 h-3.5 rounded-full ${coreColorClass} animate-pulse shadow-lg" style="box-shadow: 0 0 8px ${glowColor}"></span>
            </div>
            
            <div class="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-950/95 border border-slate-800 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1 z-10">
              <span class="text-white font-mono">${j.code}</span>
              <span class="text-slate-300 font-mono">${manualStation?.peopleCount || 0} أفراد</span>
              <span class="${statusTextColor} font-mono">${loadPercentage}%</span>
            </div>
          </div>
        `;
      } else {
        // DIRECTIONS/Observers Mode: High-Tech Person Symbology Marker
        const groupColor = getPersonColor(j.code);
        iconHtml = getPersonIconHtml(j.code, isSelected, groupColor, loadPercentage);
      }

      const customIcon = L.divIcon({
        className: "custom-junction-marker-icon",
        html: iconHtml,
        iconSize: isCountsMode ? [64, 64] : [48, 48],
        iconAnchor: isCountsMode ? [32, 32] : undefined
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(layersGroupRef.current);

      marker.on("click", () => {
        onSelectJunction(isSelected ? null : j.code);
      });

      // Get appropriate role name for tooltip
      const group = j.code.split("-")[0];
      let roleTitle = "راصد ميداني";
      if (group === "J2") roleTitle = "رائد حركة";
      else if (group === "J3") roleTitle = "مهندس حركة";
      else if (group === "J4") roleTitle = "مشرف شبكة";
      else if (group === "J5") roleTitle = "فني صيانة";
      else if (group === "J6") roleTitle = "خبير ذكاء";
      else if (group === "J7") roleTitle = "مراقب بلدي";

      const groupColor = getPersonColor(j.code);
      const stationLabel = manualStation ? manualStation.label : j.code;
      const stationPeopleCount = manualStation ? manualStation.peopleCount : 0;

      const tooltipText = isCountsMode ? `
        <div class="text-right font-sans text-xs p-1 w-[250px] max-w-[250px]">
          <div class="font-bold text-white mb-1 flex items-center justify-between gap-3">
            <span class="text-indigo-400">${j.code} - ${stationLabel}</span>
            <span class="bg-indigo-950/80 px-1.5 py-0.5 rounded font-mono text-[9px] text-indigo-400">${stationPeopleCount} أفراد</span>
          </div>
          <div class="text-slate-300">معدل الإشغال اللحظي: <span class="font-bold font-mono ${
            loadPercentage > 75 ? "text-red-400" : loadPercentage > 40 ? "text-amber-400" : "text-emerald-400"
          }">${loadPercentage}%</span></div>
          <div class="text-slate-300">إجمالي التدفق المار: <span class="font-mono text-white font-bold">${junctionVolume.toLocaleString()}</span> مركبة/ساعة</div>
          <div class="mt-1.5 text-[10px] text-indigo-300 font-bold">اضغط على رمز كل شخص لعرض المركبات المخصصة له فقط.</div>
          <div class="text-[9px] text-slate-400 mt-1 font-mono text-left">E: ${j.x.toFixed(1)} | N: ${j.y.toFixed(1)}</div>
          <div class="text-[10px] text-indigo-300 mt-0.5">انقر لتصفية التقارير لهذه المحطة</div>
        </div>
      ` : `
        <div class="text-right font-sans text-xs p-1 w-[250px] max-w-[250px]">
          <div class="font-bold text-white mb-1 flex items-center justify-between gap-3">
            <span style="color: ${groupColor};">${roleTitle} (${j.code})</span>
            <span class="bg-indigo-950/80 px-1.5 py-0.5 rounded font-mono text-[9px] text-indigo-400 font-bold">طاقم الرصد الميداني</span>
          </div>
          <div class="text-slate-300">معدل التحميل المرصود: <span class="font-bold font-mono" style="color: ${groupColor};">${loadPercentage}%</span></div>
          <div class="text-slate-300">إجمالي التدفق النشط: <span class="font-mono text-indigo-400 font-bold">${junctionVolume.toLocaleString()}</span> مركبة/ساعة</div>
          <div class="text-[9px] text-slate-400 mt-1 font-mono text-left">E: ${j.x.toFixed(1)} | N: ${j.y.toFixed(1)}</div>
          <div class="text-[10px] text-indigo-300 mt-0.5">انقر لتصفية التقارير لهذا التقاطع</div>
        </div>
      `;

      if (!isCountsMode) {
        marker.bindTooltip(tooltipText, { sticky: true, className: "custom-leaflet-tooltip" });
      }

      if (isCountsMode && manualStation) {
        const crewOffsets = [
          { lat: 0.00017, lng: 0, side: "أعلى", arrow: "↑" },
          { lat: 0, lng: 0.00020, side: "يمين", arrow: "→" },
          { lat: -0.00017, lng: 0, side: "أسفل", arrow: "↓" },
          { lat: 0, lng: -0.00020, side: "شمال", arrow: "←" },
          { lat: 0.00015, lng: -0.00018, side: "شمال أعلى", arrow: "↖" }
        ];

        manualStation.crew.forEach((person, index) => {
          const personColor = getPersonColor(person.id);
          const personTaskHtml = person.task
            .split("،")
            .map((taskPart) => taskPart.trim())
            .filter(Boolean)
            .map((taskPart) => `
              <li class="flex items-start gap-1.5">
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style="background-color: ${personColor};"></span>
                <span>${taskPart}</span>
              </li>
            `)
            .join("");
          const offset = crewOffsets[index] || {
            lat: -0.00017,
            lng: -0.00020 + ((index - crewOffsets.length + 1) * 0.00008),
            side: "إضافي",
            arrow: "•"
          };

          const personIcon = L.divIcon({
            className: "custom-count-person-marker-icon",
            html: `
              <div class="relative h-10 min-w-20 px-2 rounded-lg bg-slate-950/95 border flex items-center justify-center gap-1.5 shadow-xl cursor-pointer"
                style="border-color: ${personColor}; box-shadow: 0 0 12px ${personColor}70;">
                <span class="text-[12px] font-black leading-none" style="color: ${personColor};">${offset.arrow}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="7" r="4" fill="${personColor}" fill-opacity="0.95"/>
                  <path d="M5 21c0-4 3-7 7-7s7 3 7 7" fill="${personColor}" fill-opacity="0.35" stroke="${personColor}" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span class="text-[9px] leading-none font-black font-mono text-white">${person.id}</span>
                <span class="text-[8px] leading-none text-slate-400">${offset.side}</span>
              </div>
            `,
            iconSize: [80, 40],
            iconAnchor: [40, 20]
          });

          const personMarker = L.marker([latLng[0] + offset.lat, latLng[1] + offset.lng], {
            icon: personIcon
          }).addTo(layersGroupRef.current);

          const personPopupHtml = `
            <div class="text-right font-sans text-xs p-1 w-[250px] max-w-[250px]">
              <div class="font-bold text-white mb-1 flex items-center justify-between gap-3">
                <span style="color: ${personColor};">${person.id}</span>
                <span class="bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px]" style="color: ${personColor};">${person.role}</span>
              </div>
              <div class="text-[10px] text-slate-400 mb-1">موقع الشخص حول النقطة: <span style="color: ${personColor};">${offset.side}</span></div>
              <ul class="text-slate-300 leading-5 space-y-0.5 m-0 p-0 list-none">${personTaskHtml}</ul>
              <div class="text-[9px] text-slate-500 mt-1 font-mono">${manualStation.code} - ${manualStation.label}</div>
            </div>
          `;

          personMarker.bindPopup(personPopupHtml, {
            className: "custom-leaflet-tooltip",
            closeButton: true,
            autoPan: true,
            maxWidth: 280,
            minWidth: 240
          });

          personMarker.on("click", () => {
            personMarker.openPopup();
          });
        });
      }
    });

    // Start high-performance animation interval loop for all active vehicles
    const intervalId = setInterval(() => {
      if (isPaused) return; // Support live pausing
      
      animatedVehicles.forEach((v) => {
        v.progress += v.speed * simSpeed; // Dynamic speed multiplication
        if (v.progress >= 1.0) {
          v.progress = 0; // Wrap around to the start
        }

        const pos = getPointAlongPath(v.path, v.progress);
        const nextPos = getPointAlongPath(v.path, Math.min(v.progress + 0.005, 1));
        const angle = getBearing(pos, nextPos);

        const isDimmed = selectedDirection !== null && selectedDirection !== v.directionId;
        const iconHtml = getVehicleIconHtml(v.type, angle, isDimmed);

        if (v.marker) {
          v.marker.setLatLng(pos);
          v.marker.setIcon(L.divIcon({
            className: "custom-vehicle-marker",
            html: iconHtml,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          }));
        }
      });
    }, 45);

    return () => {
      clearInterval(intervalId);
    };

  }, [leafletLoaded, selectedJunction, selectedDirection, hourlyData, directionVolumes, activeTab, simSpeed, vehicleDensity, activeTypeFilter, isPaused]);

  return (
    <div
      id="gis-map-widget"
      className={`bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col ${
        isMapExpanded
          ? "fixed inset-0 z-[9999] rounded-none p-3"
          : "rounded-2xl p-3 sm:p-5 h-full"
      }`}
    >
      {/* Map Header Controls */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-3 sm:mb-4 z-10">
        <div className="min-w-0">
          <h3 className="text-white font-medium text-base sm:text-lg flex items-start sm:items-center gap-2 leading-snug">
            <Compass className="w-5 h-5 text-indigo-400 animate-spin-slow shrink-0 mt-0.5 sm:mt-0" />
            <span>
              {isCountsMode 
                ? t.mapCountsTitle
                : t.mapDirectionsTitle}
            </span>
          </h3>
          <p className="text-slate-400 text-[11px] sm:text-xs mt-1 leading-relaxed">
            {isCountsMode 
              ? t.mapCountsSubtitle
              : t.mapDirectionsSubtitle}
          </p>
        </div>

        {/* Base Map Type Selectors */}
        <div className="grid grid-cols-3 w-full lg:w-auto bg-slate-800 p-1 rounded-lg border border-slate-700 text-[11px] sm:text-xs gap-1">
          <button
            onClick={() => setMapProvider("DARK")}
            className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer min-h-10 sm:min-h-0 ${
              mapProvider === "DARK"
                ? "bg-indigo-600 text-white font-medium shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{t.darkMap}</span>
          </button>
          <button
            onClick={() => setMapProvider("STREET")}
            className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer min-h-10 sm:min-h-0 ${
              mapProvider === "STREET"
                ? "bg-indigo-600 text-white font-medium shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{t.streetMap}</span>
          </button>
          <button
            onClick={() => setMapProvider("SATELLITE")}
            className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer min-h-10 sm:min-h-0 ${
              mapProvider === "SATELLITE"
                ? "bg-indigo-600 text-white font-medium shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{t.satelliteMap}</span>
          </button>
        </div>
      </div>

      {/* Map Element Wrapper */}
      <div
        className={`relative flex-1 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center ${
          isMapExpanded ? "min-h-[calc(100dvh-145px)]" : "min-h-[70dvh] sm:min-h-[620px]"
        }`}
      >
        {!leafletLoaded ? (
          <div className="text-center text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <span>{t.loadingMap}</span>
          </div>
        ) : (
          <div
            ref={mapContainerRef}
            className={`w-full z-0 ${
              isMapExpanded
                ? "h-[calc(100dvh-145px)]"
                : "h-[70dvh] min-h-[520px] sm:h-[620px] lg:h-[72vh]"
            }`}
          />
        )}

        <button
          type="button"
          onClick={() => setIsMapExpanded((value) => !value)}
          className="absolute top-3 left-3 sm:hidden bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-[11px] font-bold shadow-2xl z-[1000] backdrop-blur-md"
        >
          {isMapExpanded ? "خروج" : "تكبير الخريطة"}
        </button>

        <button
          type="button"
          onClick={() => setIsLegendOpen((value) => !value)}
          className="absolute bottom-3 left-3 sm:hidden bg-slate-900/95 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-[11px] font-bold shadow-2xl z-[1000] backdrop-blur-md"
        >
          {isLegendOpen ? "إخفاء المفتاح" : "مفتاح الخريطة"}
        </button>

        {/* Legend Overlay */}
        <div className={`${isLegendOpen ? "flex" : "hidden"} sm:flex absolute bottom-14 sm:bottom-3 left-3 right-3 sm:left-auto sm:right-3 bg-slate-900/95 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 flex-col gap-2.5 backdrop-blur-md shadow-2xl z-[999] sm:max-w-xs max-h-[45vh] sm:max-h-[350px] overflow-y-auto`}>
          <div className="font-semibold text-white mb-0.5 border-b border-slate-800 pb-1.5 flex items-center gap-1.5 text-xs">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>
              {isCountsMode 
                ? t.legendCounts
                : t.legendDirections}
            </span>
          </div>

          {isCountsMode ? (
            <>
              {/* Counts mode description */}
              <div className="flex flex-col gap-1 bg-slate-950/40 p-2 rounded border border-slate-800/80">
                <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">تلوين الكثافة والتدفق</div>
                <p className="text-slate-400 text-[9px] leading-relaxed">
                  يتم تلوين مسارات الطرق ديناميكياً بناءً على حجم السيارات في الساعة (الأحمر = ازدحام، الأخضر = انسيابي).
                </p>
              </div>

              {/* Counts mode road statuses */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">حالة انسياب المسارات</div>
                <div className="flex flex-col gap-1 text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-full bg-[#ef4444]"></span>
                    <span className="text-slate-200">تدفق كثيف ومزدحم (&gt; 1500 مركبة/ساعة)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-full bg-[#f59e0b]"></span>
                    <span className="text-slate-200">تدفق متوسط ونشط (800 - 1500)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 rounded-full bg-[#10b981]"></span>
                    <span className="text-slate-200">تدفق منخفض وسلس (&lt; 800)</span>
                  </div>
                </div>
              </div>

              {/* Counts mode junction statuses */}
              <div className="flex flex-col gap-1.5 border-t border-slate-800/60 pt-2">
                <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">كواشف محطات الرصد</div>
                <div className="flex flex-col gap-1 text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-slate-200">معدل إشغال حرج (&gt; 75% من السعة)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-slate-200">معدل إشغال متوسط (40% - 75% من السعة)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-slate-200">معدل إشغال منخفض (&lt; 40% من السعة)</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Directions / Observers mode legend */}
              <div className="flex flex-col gap-1 bg-slate-950/40 p-2 rounded border border-slate-800/80">
                <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">{t.observerColorSystem}</div>
                <p className="text-slate-400 text-[9px] leading-relaxed">
                  {t.observerColorText}
                </p>
              </div>

              {/* Custom observer colors list */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{t.observerColors}</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] max-h-40 overflow-y-auto pr-1">
                  {junctions.map((point) => (
                    <div key={point.code} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getPersonColor(point.code) }}></span>
                      <span className="text-slate-200">{point.code}</span>
                      {point.label && <span className="text-slate-500 direction-ltr">({point.label})</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Directional Flow Arrow */}
          <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-2">
            <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{t.routeArrow}</div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
                <span className="text-[7px] text-slate-300">↑</span>
              </span>
              <span>{t.routeArrowText}</span>
            </div>
          </div>

          {/* Flow rates if not in counts mode */}
          {!isCountsMode && (
            <div className="flex flex-col gap-1 border-t border-slate-800/60 pt-2">
              <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{t.flowRate}</div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse"></span>
                <span>{t.heavyFlow}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                <span>{t.mediumFlow}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                <span>{t.smoothFlow}</span>
              </div>
            </div>
          )}

          {/* Animated Vehicle Types Legend */}
          <div className="flex flex-col gap-1.5 border-t border-slate-800/60 pt-2">
            <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{t.activeVehicles}</div>
            <div className="grid grid-cols-3 gap-1 text-[8px] text-slate-300">
              <div className="flex items-center gap-1 bg-slate-950/60 p-1.5 rounded border border-slate-800/40">
                <span className="text-[9px]">🚗</span>
                <span>{t.car}</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-950/60 p-1.5 rounded border border-slate-800/40">
                <span className="text-[9px]">🚌</span>
                <span>{t.bus}</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-950/60 p-1.5 rounded border border-slate-800/40">
                <span className="text-[9px]">🚚</span>
                <span>{t.truck}</span>
              </div>
            </div>
            <p className="text-slate-400 text-[8px] leading-normal mt-0.5">
              تتحرك المركبات بالاتجاه الصحيح وبسرعة تترابط لحظياً مع السرعة التشغيلية الفعلية للمسار.
            </p>
          </div>
        </div>

        {/* Active Filters Clear Button Overlay */}
        {(selectedJunction || selectedDirection) && (
          <button
            onClick={() => {
              onSelectJunction(null);
              onSelectDirection(null);
            }}
            className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-2 px-3 rounded-md flex items-center gap-1.5 shadow-md transition-all cursor-pointer backdrop-blur-sm z-[1000]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.resetFilters}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-3 text-[11px] sm:text-xs text-slate-400">
        <div className="flex items-start gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>{t.liveMapNote}</span>
        </div>
        <div className="font-mono text-[10px] text-indigo-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800/80">
          WGS 84 / UTM Zone 36N
        </div>
      </div>
    </div>
  );
};
