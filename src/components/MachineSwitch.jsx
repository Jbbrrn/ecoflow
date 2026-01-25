import { useId } from 'react';
import './MachineSwitch.css';

const MachineSwitch = ({ isOn, onToggle, disabled = false }) => {
  const reactId = useId();
  const inputId = `holo-toggle-${reactId}`;

  return (
    <div className={`toggle-container${disabled ? ' is-disabled' : ''}`}>
      <div className="toggle-wrap">
        <input
          className="toggle-input"
          id={inputId}
          type="checkbox"
          checked={!!isOn}
          disabled={disabled}
          onChange={() => {
            if (!disabled) onToggle();
          }}
        />
        <label className="toggle-track" htmlFor={inputId}>
          <div className="track-lines">
            <div className="track-line" />
          </div>

          <div className="toggle-thumb">
            <div className="thumb-core" />
            <div className="thumb-inner" />
            <div className="thumb-scan" />
            <div className="thumb-particles">
              <div className="thumb-particle" />
              <div className="thumb-particle" />
              <div className="thumb-particle" />
              <div className="thumb-particle" />
              <div className="thumb-particle" />
            </div>
          </div>

          <div className="toggle-data">
            <div className="data-text off">OFF</div>
            <div className="data-text on">ON</div>
            <div className="status-indicator off" />
            <div className="status-indicator on" />
          </div>

          <div className="energy-rings">
            <div className="energy-ring" />
            <div className="energy-ring" />
            <div className="energy-ring" />
          </div>

          <div className="interface-lines">
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
          </div>

          <div className="toggle-reflection" />
          <div className="holo-glow" />
        </label>
      </div>
    </div>
  );
};

export default MachineSwitch;
