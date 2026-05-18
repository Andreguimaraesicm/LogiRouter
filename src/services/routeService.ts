import { TollClass, VehicleType } from '../types';

export async function geocodeAddress(address: string) {
  const query = address.toLowerCase().includes('portugal') ? address : `${address}, Portugal`;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await response.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export async function getRoute(stops: {lat: number, lng: number}[], vehicleType: VehicleType = 'Carrinha Kangoo', alternatives: boolean = false) {
  if (stops.length < 2) return null;
  
  const coordinates = stops.map(s => `${s.lng},${s.lat}`).join(';');
  const profile = vehicleType === 'Pesado' ? 'driving' : 'driving'; 
  
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`);
    const data = await response.json();
    
    if (data.code === 'Ok') {
      return data.routes.map((route: any) => ({
        distance: route.distance, // em metros
        duration: route.duration, // em segundos
        geometry: route.geometry,
        legs: route.legs
      }));
    }
    return null;
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
}

export function estimateTolls(distanceMeters: number, tollClass: number, rates: Record<number, number>) {
  const km = distanceMeters / 1000;
  const rate = rates[tollClass];
  
  if (!rate) {
    // Default estimated rates for Portugal if not set
    const defaultRates: Record<number, number> = {
      1: 0.08,
      2: 0.14,
      3: 0.21,
      4: 0.27
    };
    const baseRate = defaultRates[tollClass] || 0.1;
    // Heuristic: for heavy vehicles (C3/C4), we assume they use more toll roads (90%) for long haul
    const factor = tollClass >= 3 ? 0.9 : 0.7;
    return km * factor * baseRate;
  }

  const factor = tollClass >= 3 ? 0.85 : 0.7;
  return km * factor * rate;
}
