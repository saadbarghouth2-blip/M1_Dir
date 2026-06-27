import proj4 from "proj4";

// Define WGS84 and UTM Zone 36N (EPSG:32636) projection strings
const UTM36N = "+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs";
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

/**
 * Converts UTM Zone 36N coordinates [X, Y] to Latitude/Longitude [Lat, Lng]
 * @param x Easting in meters
 * @param y Northing in meters
 * @returns [latitude, longitude]
 */
export function utmToLatLng(x: number, y: number): [number, number] {
  // proj4 returns [longitude, latitude] for WGS84, so we reverse it to [latitude, longitude]
  const [lng, lat] = proj4(UTM36N, WGS84, [x, y]);
  return [lat, lng];
}
