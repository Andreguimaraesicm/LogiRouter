export type Role = 'master' | 'manager' | 'driver';
export type VehicleType = 'Carrinha Kangoo' | 'Ligeiro' | 'Furgão 10m' | 'Furgão com Báscula' | 'Pesado';
export type TollClass = 1 | 2 | 3 | 4;
export type StopStatus = 'pending' | 'arrived' | 'operating' | 'finished_op' | 'completed';
export type FuelType = 'gasoleo' | 'gnl' | 'adblue';

export interface FuelConsumption {
  type: FuelType;
  value: number; // L/100km or kg/100km
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  role: Role;
  email?: string;
  password?: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  status: StopStatus;
  order: number;
  emitterId?: string;
  emitterName?: string;
  arrivalAt?: string;
  departureAt?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  licensePlate: string;
  tollClass: TollClass;
  status: 'active' | 'maintenance' | 'inactive';
  fuels: FuelConsumption[];
}

export interface Route {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleName: string;
  date: string;
  stops: Client[];
  status: 'pending' | 'in_progress' | 'completed';
  totalDistance: number;
  totalTolls: number;
  estimatedTime: number;
}
