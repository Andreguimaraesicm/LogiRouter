export type Role = 'admin' | 'collaborator' | 'driver' | 'master';
export type VehicleType = 'Carrinha Kangoo' | 'Ligeiro' | 'Furgão 10m' | 'Furgão com Báscula' | 'Pesado';
export type TollClass = 1 | 2 | 3 | 4;
export type StopStatus = 
  | 'planned' 
  | 'en_route'
  | 'arrived' 
  | 'loading_unloading' 
  | 'finished_op' 
  | 'departed';
export type RouteStatus = 'planned' | 'dispatching' | 'in_transit' | 'completed' | 'cancelled';
export type FuelType = 'gasoleo' | 'gnl' | 'adblue';

export interface FuelConsumption {
  type: FuelType;
  value: number; // L/100km or kg/100km
}

export interface UserProfile {
  uid: string;
  username: string;
  password?: string;
  email?: string;
  displayName: string;
  role: Role;
  companyId?: string;
  status: 'active' | 'disabled';
  permissions?: string[];
}

export interface RouteStop {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  status: StopStatus;
  order: number;
  
  // Timestamps for audit
  arrivedAt?: string;
  opStartedAt?: string; 
  opEndedAt?: string;
  departedAt?: string;
}

export interface Vehicle {
  id: string;
  companyId: string;
  name: string;
  type: VehicleType;
  licensePlate: string;
  tollClass: TollClass;
  status: 'active' | 'maintenance' | 'inactive';
  fuels: FuelConsumption[];
}

export interface Route {
  id: string;
  companyId: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleName: string;
  date: string;
  stops: RouteStop[];
  status: RouteStatus;
  totalDistance: number;
  totalTolls: number;
  estimatedTime: number;
  
  startedAt?: string;
  completedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  adminId: string;
  createdAt: string;
}
