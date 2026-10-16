import React from 'react';
import type { VehicleModel } from '../data/vehicles';
import { ROADSTER, MODEL3, MODELY, CYBERTRUCK, SEMI } from '../data/vehicles';

export interface FleetSelectorProps {
  onSelect: (v: VehicleModel) => void;
  selectedId?: string;
}

const ALL_VEHICLES: VehicleModel[] = [ROADSTER, CYBERTRUCK, SEMI, MODELY, MODEL3];

export const FleetSelector: React.FC<FleetSelectorProps> = ({ onSelect, selectedId }) => {
  return (
    <div className="fleet-strip" role="toolbar" aria-label="Tesla vehicle fleet selector">
      <span className="fleet-strip-label">FLEET:</span>
      {ALL_VEHICLES.map((v) => (
        <button
          key={v.id}
          className={`fleet-chip ${selectedId === v.id ? 'active' : ''}`}
          onClick={() => onSelect(v)}
          type="button"
          aria-label={`View specs for ${v.name}`}
        >
          {v.name.replace('Tesla ', '')}
        </button>
      ))}
    </div>
  );
};
