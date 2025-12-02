'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Map, { type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRTS } from '@/contexts/RTSContext';
import regionData from '@/../public/data/region.json';
import boxData from '@/../public/data/box.json';

const CORNER_TOOLTIP_POSITIONS = [
  { id: 'top-left', position: [119.7, 25.4] as [number, number] },
  { id: 'top-right', position: [122.2, 23.6] as [number, number] },
  { id: 'bottom-left', position: [119.7, 22] as [number, number] },
  { id: 'bottom-right', position: [121.6, 22] as [number, number]},
];

const TOOLTIP_WINDOW_OFFSETS = {
  'top-left': { x: -60, y: -35 },
  'top-right': { x: -70, y: -30 },
  'bottom-left': { x: -60, y: -45 },
  'bottom-right': { x: -50, y: -45 },
};

interface AlertTooltip {
  stationId: string;
  stationCode: string;
  intensity: number;
  pga: number;
  coordinates: [number, number];
  tooltipPosition: [number, number];
  cornerId: string;
  isActive: boolean;
}

// 快取 region 查詢結果
const regionNameCache: Record<string, string> = {};
const getRegionName = (code: string): string => {
  if (regionNameCache[code]) return regionNameCache[code];

  const codeNum = parseInt(code);
  for (const [city, towns] of Object.entries(regionData)) {
    for (const [town, info] of Object.entries(towns as Record<string, any>)) {
      if (info.code === codeNum) {
        const name = `${city}${town}`;
        regionNameCache[code] = name;
        return name;
      }
    }
  }
  regionNameCache[code] = code;
  return code;
};

// 預先建立可重用的 GeoJSON 物件
const reusableBoxGeoJSON = {
  type: 'FeatureCollection' as const,
  features: [] as any[]
};

const reusableLineGeoJSON = {
  type: 'FeatureCollection' as const,
  features: [] as any[]
};

const MapSection = React.memo(() => {
  const { data: rtsData } = useRTS();
  const mapRef = useRef<MapRef>(null);
  const [dataTime, setDataTime] = useState<number>(0);
  const [maxIntensity, setMaxIntensity] = useState<number>(-3);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [tooltipSwitchIndex, setTooltipSwitchIndex] = useState<number>(0);
  const [currentTooltipData, setCurrentTooltipData] = useState<AlertTooltip[]>([]);
  const [allAlertStations, setAllAlertStations] = useState<AlertTooltip[]>([]);
  const sourceInitializedRef = useRef<boolean>(false);
  const [boxVisible, setBoxVisible] = useState<boolean>(true);
  const connectedStationsRef = useRef<Set<string>>(new Set());

  // 重用 box features 物件
  const updateBoxGeoJSONInPlace = useCallback(() => {
    if (!rtsData?.box) return null;

    reusableBoxGeoJSON.features.length = 0;

    for (const feature of boxData.features as any[]) {
      const boxId = feature.properties.ID;
      const intensity = rtsData.box[boxId];
      if (intensity !== undefined) {
        // 直接修改原始 feature 的 properties（boxData 是靜態的）
        feature.properties.intensity = intensity;
        feature.properties.sortKey = intensity;
        reusableBoxGeoJSON.features.push(feature);
      }
    }

    return reusableBoxGeoJSON;
  }, [rtsData?.box]);

  const intensity_float_to_int = (float: number): number => {
    return float < 0 ? 0 : float < 4.5 ? Math.round(float) : float < 5 ? 5 : float < 5.5 ? 6 : float < 6 ? 7 : float < 6.5 ? 8 : 9;
  };

  const intensity_list = ['0', '1', '2', '3', '4', '5⁻', '5⁺', '6⁻', '6⁺', '7'];

  const INTENSITY_COLORS = {
    0: '#202020',
    1: '#003264',
    2: '#0064c8',
    3: '#1e9632',
    4: '#ffc800',
    5: '#ff9600',
    6: '#ff6400',
    7: '#ff0000',
    8: '#c00000',
    9: '#9600c8',
  };

  const INTENSITY_TEXT_COLORS = {
    0: '#ffffff',
    1: '#ffffff',
    2: '#ffffff',
    3: '#ffffff',
    4: '#000000',
    5: '#000000',
    6: '#000000',
    7: '#ffffff',
    8: '#ffffff',
    9: '#ffffff',
  };

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

  // 簡化：直接按震度排序，取前 4 個，固定分配到 4 個角落
  const assignTooltipPositions = useCallback((alertStations: AlertTooltip[]): AlertTooltip[] => {
    if (alertStations.length === 0) return [];

    // 按震度排序取前 4 個
    const sorted = alertStations
      .slice()
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 4);

    return sorted.map((station, i) => ({
      ...station,
      tooltipPosition: CORNER_TOOLTIP_POSITIONS[i].position,
      cornerId: CORNER_TOOLTIP_POSITIONS[i].id,
      isActive: true
    }));
  }, []);

  const initializeMapSource = useCallback(() => {
    if (!mapRef.current || !rtsData?.geojson || sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();

    if (!map.getSource('stations')) {
      map.addSource('stations', {
        type: 'geojson',
        data: rtsData.geojson,
      });

      map.addSource('tooltip-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.addSource('boxes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.addLayer({
        id: 'box-outlines',
        type: 'line',
        source: 'boxes',
        layout: {
          'line-sort-key': ['get', 'sortKey']
        },
        paint: {
          'line-color': [
            'case',
            ['<', ['get', 'intensity'], 2],
            '#00DB00',
            ['<', ['get', 'intensity'], 4],
            '#EAC100',
            '#FF0000'
          ],
          'line-width': 2,
          'line-opacity': 1,
        },
      });

      map.addLayer({
        id: 'tooltip-lines',
        type: 'line',
        source: 'tooltip-lines',
        paint: {
          'line-color': '#ffffff',
          'line-width': 1,
          'line-opacity': 0.8,
        },
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
          'circle-stroke-width': ['case', ['get', 'isConnected'], 3, 1],
          'circle-stroke-color': '#ffffff',
        },
      });

      sourceInitializedRef.current = true;
    }
  }, [rtsData?.geojson]);

  // 直接更新 station source，重用 geojson 物件
  const updateStationSource = useCallback(() => {
    if (!mapRef.current || !sourceInitializedRef.current || !rtsData?.geojson) return;

    const map = mapRef.current.getMap();
    const source = map.getSource('stations') as any;
    if (!source?.setData) return;

    // 直接修改現有 features 的 isConnected 屬性，不創建新物件
    const connectedIds = connectedStationsRef.current;
    for (const feature of rtsData.geojson.features) {
      feature.properties.isConnected = connectedIds.has(feature.properties.id);
    }

    source.setData(rtsData.geojson);
  }, [rtsData?.geojson]);

  const updateBoxSource = useCallback(() => {
    if (!mapRef.current || !sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    const source = map.getSource('boxes') as any;
    if (!source?.setData) return;

    const boxGeoJSON = updateBoxGeoJSONInPlace();
    if (boxGeoJSON) {
      source.setData(boxGeoJSON);
    }
  }, [updateBoxGeoJSONInPlace]);

  // 重用 line features
  const updateTooltipLines = useCallback((tooltips: AlertTooltip[]) => {
    if (!mapRef.current || !sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    const source = map.getSource('tooltip-lines') as any;
    if (!source?.setData) return;

    reusableLineGeoJSON.features.length = 0;

    for (const tooltip of tooltips) {
      if (tooltip.isActive) {
        reusableLineGeoJSON.features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [tooltip.coordinates, tooltip.tooltipPosition]
          },
          properties: {
            stationId: tooltip.stationId,
            cornerId: tooltip.cornerId
          }
        });
      }
    }

    source.setData(reusableLineGeoJSON);
  }, []);

  const handleMapLoad = useCallback(() => {
    setIsMapReady(true);
  }, []);

  // 處理 rtsData 變化 - 更新所有資料
  useEffect(() => {
    if (!rtsData) return;

    setDataTime(rtsData.time);

    // 計算最大震度
    let max = -3;
    const alertStations: AlertTooltip[] = [];

    for (const feature of rtsData.geojson.features) {
      if (feature.properties.intensity > max) {
        max = feature.properties.intensity;
      }
      if (feature.properties.hasAlert) {
        alertStations.push({
          stationId: feature.properties.id,
          stationCode: feature.properties.code,
          intensity: feature.properties.intensity,
          pga: feature.properties.pga || 0,
          coordinates: feature.geometry.coordinates,
          tooltipPosition: [0, 0],
          cornerId: '',
          isActive: false
        });
      }
    }

    setMaxIntensity(max);
    setAllAlertStations(alertStations);
  }, [rtsData]);

  // 當 allAlertStations 或 tooltipSwitchIndex 變化時，重新計算 tooltip 位置
  useEffect(() => {
    if (allAlertStations.length === 0) {
      setCurrentTooltipData([]);
      connectedStationsRef.current.clear();
      return;
    }

    const positioned = assignTooltipPositions(allAlertStations);
    setCurrentTooltipData(positioned);

    // 更新連接的站點 ID
    connectedStationsRef.current.clear();
    for (const t of positioned) {
      connectedStationsRef.current.add(t.stationId);
    }
  }, [allAlertStations, tooltipSwitchIndex, assignTooltipPositions]);

  // 更新地圖資料
  useEffect(() => {
    if (!rtsData || !isMapReady || !sourceInitializedRef.current) return;

    updateStationSource();
    updateTooltipLines(currentTooltipData);
  }, [rtsData, currentTooltipData, isMapReady, updateStationSource, updateTooltipLines]);

  // 初始化地圖 source
  useEffect(() => {
    if (isMapReady && rtsData?.geojson) {
      initializeMapSource();
    }
  }, [isMapReady, rtsData?.geojson, initializeMapSource]);

  // Tooltip 切換計時器
  useEffect(() => {
    const interval = setInterval(() => {
      setTooltipSwitchIndex(prev => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Box 閃爍計時器
  useEffect(() => {
    const interval = setInterval(() => {
      setBoxVisible(prev => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Box 可見性
  useEffect(() => {
    if (!mapRef.current || !sourceInitializedRef.current) return;
    const map = mapRef.current.getMap();
    if (map.getLayer('box-outlines')) {
      map.setLayoutProperty('box-outlines', 'visibility', boxVisible ? 'visible' : 'none');
    }
  }, [boxVisible]);

  // 更新 box 資料
  useEffect(() => {
    if (rtsData && isMapReady && sourceInitializedRef.current) {
      updateBoxSource();
    }
  }, [rtsData, isMapReady, updateBoxSource]);

  // 清理
  useEffect(() => {
    return () => {
      sourceInitializedRef.current = false;
      connectedStationsRef.current.clear();
    };
  }, []);

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
      
      {currentTooltipData.map((tooltip, index) => {
        if (!mapRef.current || !tooltip.isActive) return null;
        
        const [lon, lat] = tooltip.tooltipPosition;
        const pixel = mapRef.current.project([lon, lat]);
        
        const offset = TOOLTIP_WINDOW_OFFSETS[tooltip.cornerId as keyof typeof TOOLTIP_WINDOW_OFFSETS];
        let tooltipLeft = pixel.x + offset.x;
        let tooltipTop = pixel.y + offset.y;
        
        const mapContainer = mapRef.current.getContainer();
        const mapWidth = mapContainer.offsetWidth;
        const mapHeight = mapContainer.offsetHeight;
        
        tooltipLeft = Math.max(5, Math.min(mapWidth - 95, tooltipLeft));
        tooltipTop = Math.max(5, Math.min(mapHeight - 75, tooltipTop));
        
        return (
          <div
            key={`${tooltip.stationId}-${tooltip.cornerId}`}
            className="absolute z-50 pointer-events-none"
            style={{
              left: tooltipLeft,
              top: tooltipTop,
            }}
          >
            <div className="bg-gradient-to-br from-slate-900/98 to-gray-800/98 backdrop-blur-lg rounded-[5px] p-2 border border-white/30 min-w-[90px] shadow-lg flex flex-col justify-center items-start">
              <div className="mb-1.5 flex items-center">
                <div className="text-white text-xs font-medium">
                  {getRegionName(tooltip.stationCode)}
                </div>
              </div>

              <div className="flex items-center gap-1 mb-1.5">
                <div className="text-white/70 text-xs">震度</div>
                <div
                  className="rounded px-1.5 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: INTENSITY_COLORS[intensity_float_to_int(tooltip.intensity) as keyof typeof INTENSITY_COLORS],
                    color: INTENSITY_TEXT_COLORS[intensity_float_to_int(tooltip.intensity) as keyof typeof INTENSITY_TEXT_COLORS]
                  }}
                >
                  {intensity_list[intensity_float_to_int(tooltip.intensity)]}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
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