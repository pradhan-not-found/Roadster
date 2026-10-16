import React from 'react';
import type { VehicleModel } from '../data/vehicles';

export interface VehicleModalProps {
  vehicle: VehicleModel | null;
  onClose: () => void;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({ vehicle, onClose }) => {
  if (!vehicle) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
        >
          ✕
        </button>
        <div className="modal-header">
          <span className="modal-badge">FLEET TELEMETRY</span>
          <h2 id="modal-title" className="modal-title">{vehicle.name}</h2>
          <p className="modal-tagline">{vehicle.tagline}</p>
        </div>

        <div className="specs-grid">
          {vehicle.specs.acceleration && (
            <div className="spec-item">
              <span className="spec-label">0-60 MPH</span>
              <span className="spec-value">{vehicle.specs.acceleration}</span>
            </div>
          )}
          {vehicle.specs.topSpeed && (
            <div className="spec-item">
              <span className="spec-label">TOP SPEED</span>
              <span className="spec-value">{vehicle.specs.topSpeed}</span>
            </div>
          )}
          {vehicle.specs.range && (
            <div className="spec-item">
              <span className="spec-label">RANGE</span>
              <span className="spec-value">{vehicle.specs.range}</span>
            </div>
          )}
          {vehicle.specs.power && (
            <div className="spec-item">
              <span className="spec-label">POWERTRAIN</span>
              <span className="spec-value">{vehicle.specs.power}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="modal-desc">
            {vehicle.id === 'roadster' &&
              'Equipped with 10 SpaceX cold-gas composite-overwrapped pressure vessel (COPV) thrusters that seamlessly improve acceleration, top speed, braking, and enable impossible aerial maneuvers like this 360-degree kickflip.'}
            {vehicle.id === 'cybertruck' &&
              'Ultra-hard 30X cold-rolled stainless-steel exoskeleton, shatter-resistant armor glass, and adaptive air suspension with 12 inches of travel.'}
            {vehicle.id === 'semi' &&
              'Aerodynamic electric semi-truck with central seating position, consuming less than 2 kWh per mile under full 82,000 lb gross combination weight.'}
            {vehicle.id === 'modely' &&
              'Mid-size electric SUV featuring an ultra-rigid safety passenger cell, dual motor all-wheel drive, and panoramic all-glass roof.'}
            {vehicle.id === 'model3' &&
              'Clean, aerodynamic electric sports sedan with low center of gravity, ultra-fast 0-60 launch, and track mode dynamics.'}
          </p>
        </div>
      </div>
    </div>
  );
};
