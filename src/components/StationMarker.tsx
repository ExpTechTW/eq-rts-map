import React from 'react';

interface StationMarkerProps {
  intensity: number;
  color: string;
  alert?: boolean;
}

const StationMarker: React.FC<StationMarkerProps> = ({ intensity, color, alert }) => {
  const size = 23;

  if (!alert || intensity < 0.5) {
    return (
      <div
        style={{
          width: `${size / 2}px`,
          height: `${size / 2}px`,
          backgroundColor: color,
          borderRadius: '50%',
          border: '1px solid #ffffff',
          zIndex: 1,
        }}
      />
    );
  }

  let bgColor = '';
  let textColor = '';
  let text = '';

  if (intensity >= 0.5 && intensity <= 1.4) {
    bgColor = '#003264';
    textColor = '#ffffff';
    text = '1';
  } else if (intensity >= 1.5 && intensity <= 2.4) {
    bgColor = '#0064c8';
    textColor = '#ffffff';
    text = '2';
  } else if (intensity >= 2.5 && intensity <= 3.4) {
    bgColor = '#1e9632';
    textColor = '#ffffff';
    text = '3';
  } else if (intensity >= 3.5 && intensity <= 4.4) {
    bgColor = '#ffc800';
    textColor = '#000000';
    text = '4';
  } else if (intensity >= 4.5 && intensity <= 4.9) {
    bgColor = '#ff9600';
    textColor = '#000000';
    text = '5⁻';
  } else if (intensity >= 5.0 && intensity <= 5.4) {
    bgColor = '#ff6400';
    textColor = '#000000';
    text = '5⁺';
  } else if (intensity >= 5.5 && intensity <= 5.9) {
    bgColor = '#ff0000';
    textColor = '#ffffff';
    text = '6⁻';
  } else if (intensity >= 6.0 && intensity <= 6.4) {
    bgColor = '#c00000';
    textColor = '#ffffff';
    text = '6⁺';
  } else if (intensity >= 6.5) {
    bgColor = '#9600c8';
    textColor = '#ffffff';
    text = '7';
  }

  return (
    <div
      className="flex items-center justify-center font-semibold"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: bgColor,
        color: textColor,
        borderRadius: '50%',
        border: `1px solid ${textColor}`,
        fontSize: '12px',
        zIndex: Math.floor(intensity) + 10,
      }}
    >
      {text}
    </div>
  );
};

export default StationMarker;