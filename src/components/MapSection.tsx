'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Map, { NavigationControl, Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchAndProcessStationData, type StationGeoJSON } from '@/lib/rts';

const MapSection = React.memo(() => {
  const mapRef = useRef<MapRef>(null);
  const [stationData, setStationData] = useState<StationGeoJSON | null>(null);
  const [dataTime, setDataTime] = useState<number>(0);
  const [maxIntensity, setMaxIntensity] = useState<number>(-3);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const sourceInitializedRef = useRef<boolean>(false);

  const mapStyle: any = useMemo(() => ({
    version: 8,
    name: 'ExpTech Studio',
    sources: {
      map: {
        type: 'vector',
        url: 'https://lb.exptech.dev/api/v1/map/tiles/tiles.json',
        tileSize: 512,
        buffer: 64,
      },
    },
    sprite: '',
    glyphs: 'https://glyphs.geolonia.com/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#1f2025',
        },
      },
      {
        id: 'county',
        type: 'fill',
        source: 'map',
        'source-layer': 'city',
        paint: {
          'fill-color': '#3F4045',
          'fill-opacity': 1,
        },
      },
      {
        id: 'town',
        type: 'fill',
        source: 'map',
        'source-layer': 'town',
        paint: {
          'fill-color': '#3F4045',
          'fill-opacity': 1,
        },
      },
      {
        id: 'county-outline',
        source: 'map',
        'source-layer': 'city',
        type: 'line',
        paint: {
          'line-color': '#a9b4bc',
        },
      },
      {
        id: 'global',
        type: 'fill',
        source: 'map',
        'source-layer': 'global',
        paint: {
          'fill-color': '#3F4045',
          'fill-opacity': 1,
        },
      },
      {
        id: 'tsunami',
        type: 'line',
        source: 'map',
        'source-layer': 'tsunami',
        paint: {
          'line-opacity': 0,
          'line-width': 3,
        },
      },
    ],
  }), []);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  const initializeMapSource = useCallback(() => {
    if (!mapRef.current || !stationData || sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    
    if (!map.getSource('stations')) {
      map.addSource('stations', {
        type: 'geojson',
        data: stationData,
      });

      map.addLayer({
        id: 'station-circles',
        type: 'circle',
        source: 'stations',
        layout: {
          'circle-sort-key': ['get', 'sortKey'],
        },
        paint: {
          'circle-radius': 4,
          'circle-color': ['get', 'color'],
          'circle-opacity': 1,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      sourceInitializedRef.current = true;
    }
  }, [stationData]);

  const updateMapData = useCallback((newData: StationGeoJSON) => {
    if (!mapRef.current || !sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    const source = map.getSource('stations') as any;
    
    if (source && source.setData) {
      source.setData(newData);
    }
  }, []);

  const handleMapLoad = useCallback(() => {
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchAndProcessStationData();
        
        setStationData(data.geojson);
        setDataTime(data.time);

        let max = -3;
        data.geojson.features.forEach(feature => {
          if (feature.properties.intensity > max) {
            max = feature.properties.intensity;
          }
        });
        setMaxIntensity(max);

        if (isMapReady && sourceInitializedRef.current) {
          updateMapData(data.geojson);
        }
      } catch (error) {
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);

    return () => clearInterval(interval);
  }, [isMapReady, updateMapData]);

  useEffect(() => {
    if (isMapReady && stationData) {
      initializeMapSource();
    }
  }, [isMapReady, stationData, initializeMapSource]);

  return (
    <div className="w-1/2 h-full relative">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 120.8,
          latitude: 23.6,
          zoom: 6.5
        }}
        dragPan={false}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        attributionControl={false}
        scrollZoom={false}
        doubleClickZoom={false}
        keyboard={false}
        dragRotate={false}
        touchZoomRotate={false}
        boxZoom={false}
        onLoad={handleMapLoad}
        onError={() => {}}
      >
      </Map>
      {dataTime > 0 && (
        <div className="absolute bottom-3 right-3 z-50 flex flex-col gap-2 items-end">
          <div className="backdrop-blur-sm rounded-md p-2">
            <div className="flex items-start gap-1.5">
              <div className="flex flex-col text-[9px] text-white/90 font-medium text-right" style={{ height: '180px', justifyContent: 'space-between' }}>
                <span style={{ lineHeight: '9px' }}>7</span>
                <span style={{ lineHeight: '9px' }}>6</span>
                <span style={{ lineHeight: '9px' }}>5</span>
                <span style={{ lineHeight: '9px' }}>4</span>
                <span style={{ lineHeight: '9px' }}>3</span>
                <span style={{ lineHeight: '9px' }}>2</span>
                <span style={{ lineHeight: '9px' }}>1</span>
                <span style={{ lineHeight: '9px' }}>0</span>
                <span style={{ lineHeight: '9px' }}>-1</span>
                <span style={{ lineHeight: '9px' }}>-2</span>
                <span style={{ lineHeight: '9px' }}>-3</span>
              </div>
              <div className="relative" style={{ height: '180px' }}>
                <div
                  className="w-1.5 h-full rounded-full"
                  style={{
                    background: `linear-gradient(180deg,
                      #b720e9 0%,
                      #fc5235 10%,
                      #ff9300 20%,
                      #fff000 30%,
                      #beff0c 40%,
                      #44fa34 50%,
                      #49E9AD 60%,
                      #79E5FD 70%,
                      #009EF8 80%,
                      #004bf8 90%,
                      #0005d0 100%)`,
                    boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                  }}
                />
                <div
                  className="absolute -right-3 text-white text-[10px] transition-all duration-300"
                  style={{
                    top: `${((7 - maxIntensity) / 10) * 100}%`,
                    transform: 'translateY(-50%)',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'
                  }}
                >
                  ◀
                </div>
              </div>
            </div>
          </div>
          <div className="bg-background/90 backdrop-blur-sm border border-border/50 rounded-md px-3 py-2 shadow-md">
            <p className="text-xs text-white font-bold">
              {formatTime(dataTime)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

MapSection.displayName = 'MapSection';

export default MapSection;