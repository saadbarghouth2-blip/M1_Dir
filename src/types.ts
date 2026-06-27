export interface Junction {
  id: number;
  code: string;
  label?: string;
  originalCode?: string;
  x: number;
  y: number;
}

export interface CountCrewMember {
  id: string;
  name: string;
  role: string;
  task: string;
}

export interface ManualCountStation extends Junction {
  label: string;
  peopleCount: number;
  crew: CountCrewMember[];
}

export interface Direction {
  id: number;
  member_code: string; // Junction code it belongs to, e.g., J2-1, J8-1
  dir: string; // e.g., "A to B", "C to D"
  length: number;
  paths: [number, number][]; // Simplified coordinates [[x, y], ...]
}

export interface Zone {
  id: number;
  code: string; // e.g., "A", "B", "C", "D"
  length: number;
  area: number;
  rings: [number, number][][]; // Polygons
}

export enum VehicleClass {
  CAR = "Passenger Cars",
  TRUCK = "Heavy Trucks",
  BUS = "Buses",
  MOTORCYCLE = "Motorcycles",
}

export interface TrafficCount {
  id: string;
  junctionCode: string;
  directionId: number;
  dirString: string; // e.g. "A to B"
  timestamp: string; // Date string or hour (e.g. "08:00")
  hour: number; // 0 to 23
  volume: number;
  vehicleBreakdown: {
    [key in VehicleClass]: number;
  };
  speed: number; // Average speed in km/h
}
