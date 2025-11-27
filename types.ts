
import { User } from 'firebase/auth';

export type HistoryEvent =
  | { id: string; type: 'start' | 'checkpoint' | 'consumption' | 'finish'; value: number; date: string; }
  | { id: string; type: 'refuel'; value: number; date: string; pricePerLiter?: number; discount?: number; }
  | { 
      id: string; 
      type: 'route'; 
      value: number; 
      date: string; 
      origin?: any;
      destination?: any;
      distanciaPercorrida?: number;
    };


export interface Cycle {
  id: string;
  name: string;
  startDate: string;
  finishDate?: string;
  initialMileage: number;
  currentMileage: number;
  fuelAmount: number;
  consumption: number;
  history: HistoryEvent[];
  status: 'active' | 'finished';
}
