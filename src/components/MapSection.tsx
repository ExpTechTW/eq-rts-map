'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Map, { NavigationControl, Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type StationGeoJSON } from '@/lib/rts';
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

const getRegionName = (code: string): string => {
  const codeNum = parseInt(code);
  for (const [city, towns] of Object.entries(regionData)) {
    for (const [town, info] of Object.entries(towns as Record<string, any>)) {
      if (info.code === codeNum) {
        return `${city}${town}`;
      }
    }
  }
  return code;
};

const MapSection = React.memo(() => {
  const { data: rtsData } = useRTS();
  const mapRef = useRef<MapRef>(null);
  const [stationData, setStationData] = useState<StationGeoJSON | null>(null);
  const [dataTime, setDataTime] = useState<number>(0);
  const [maxIntensity, setMaxIntensity] = useState<number>(-3);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [alertTooltips, setAlertTooltips] = useState<AlertTooltip[]>([]);
  const [tooltipUsage, setTooltipUsage] = useState<Record<string, boolean>>({});
  const [tooltipSwitchIndex, setTooltipSwitchIndex] = useState<number>(0);
  const tooltipSwitchIndexRef = useRef<number>(0);
  const [currentTooltipData, setCurrentTooltipData] = useState<AlertTooltip[]>([]);
  const [allAlertStations, setAllAlertStations] = useState<AlertTooltip[]>([]);
  const sourceInitializedRef = useRef<boolean>(false);
  const isMapReadyRef = useRef<boolean>(false);
  const updateMapDataRef = useRef<any>(null);
  const [boxVisible, setBoxVisible] = useState<boolean>(true);
  const isMountedRef = useRef<boolean>(true);

  const createBoxGeoJSON = useCallback(() => {
    if (!rtsData?.box) return null;

    const features = boxData.features.filter((feature: any) => {
      const boxId = feature.properties.ID;
      return rtsData.box[boxId] !== undefined;
    }).map((feature: any) => {
      const intensity = rtsData.box[feature.properties.ID];
      return {
        ...feature,
        properties: {
          ...feature.properties,
          intensity: intensity,
          sortKey: intensity
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }, [rtsData]);

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

  const calculateDistance = (stationCoords: [number, number], tooltipCoords: [number, number]): number => {
    const [lon1, lat1] = stationCoords;
    const [lon2, lat2] = tooltipCoords;
    return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
  };

  const calculateCrossings = (assignments: Array<{station: AlertTooltip, corner: any}>): number => {
    const doSegmentsIntersect = (
      p1: [number, number], p2: [number, number],
      p3: [number, number], p4: [number, number]
    ): boolean => {
      const ccw = (a: [number, number], b: [number, number], c: [number, number]): number => {
        return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]);
      };

      const d1 = ccw(p3, p4, p1);
      const d2 = ccw(p3, p4, p2);
      const d3 = ccw(p1, p2, p3);
      const d4 = ccw(p1, p2, p4);

      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
          ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
      }

      return false;
    };

    let crossings = 0;
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const line1Start: [number, number] = assignments[i].station.coordinates;
        const line1End: [number, number] = assignments[i].corner.position;
        const line2Start: [number, number] = assignments[j].station.coordinates;
        const line2End: [number, number] = assignments[j].corner.position;

        if (doSegmentsIntersect(line1Start, line1End, line2Start, line2End)) {
          crossings++;
        }
      }
    }
    return crossings;
  };

  const selectStationsToShow = (alertStations: AlertTooltip[]): AlertTooltip[] => {
    if (alertStations.length === 0) return [];

    const sortedStations = [...alertStations].sort((a, b) => b.intensity - a.intensity);

    const maxIntensityStation = sortedStations[0];
    if (!maxIntensityStation) return [];

    if (sortedStations.length === 1) return [maxIntensityStation];

    const remainingStations = sortedStations.slice(1);
    const selectedStations: AlertTooltip[] = [maxIntensityStation];

    const getRandomOffset = (arrayLength: number): number => {
      const range = Math.max(1, Math.floor(arrayLength * 0.1));
      return Math.floor(Math.random() * (range * 2 + 1)) - range;
    };

    const percentiles = [0.75, 0.5, 0.25];
    const usedIndices = new Set<number>();

    for (const percentile of percentiles) {
      if (selectedStations.length >= 4) break;

      const baseIndex = Math.floor(remainingStations.length * percentile);
      const offset = getRandomOffset(remainingStations.length);
      let targetIndex = Math.max(0, Math.min(remainingStations.length - 1, baseIndex + offset));

      let attempts = 0;
      while (usedIndices.has(targetIndex) && attempts < remainingStations.length) {
        targetIndex = (targetIndex + 1) % remainingStations.length;
        attempts++;
      }

      if (!usedIndices.has(targetIndex)) {
        selectedStations.push(remainingStations[targetIndex]);
        usedIndices.add(targetIndex);
      }
    }

    return selectedStations;
  };

  const assignTooltipPositions = (alertStations: AlertTooltip[]): AlertTooltip[] => {
    const selectedStations = selectStationsToShow(alertStations);
    if (selectedStations.length === 0) return [];

    if (selectedStations.length === 1) {
      const corner = CORNER_TOOLTIP_POSITIONS[0];
      return [{
        ...selectedStations[0],
        tooltipPosition: corner.position,
        cornerId: corner.id,
        isActive: true
      }];
    }

    // 限制排列數量以防止記憶體洩漏（最多處理 4 個站點，4! = 24 種排列）
    const MAX_STATIONS = 4;
    const stationsToProcess = selectedStations.slice(0, MAX_STATIONS);
    
    const generatePermutations = (arr: any[]): any[][] => {
      if (arr.length <= 1) return [arr];
      // 如果排列數量過大，使用貪心算法而非生成所有排列
      if (arr.length > 4) {
        // 對於超過 4 個的情況，只返回一個簡單的排列
        return [arr];
      }
      
      // 限制最大排列數量以防止記憶體洩漏
      const MAX_PERMUTATIONS = 24; // 4! = 24
      const result: any[][] = [];
      
      for (let i = 0; i < arr.length && result.length < MAX_PERMUTATIONS; i++) {
        const current = arr[i];
        const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
        const remainingPerms = generatePermutations(remaining);
        for (const perm of remainingPerms) {
          if (result.length >= MAX_PERMUTATIONS) break;
          result.push([current].concat(perm));
        }
        if (result.length >= MAX_PERMUTATIONS) break;
      }
      return result;
    };

    const cornersToUse = CORNER_TOOLTIP_POSITIONS.slice(0, stationsToProcess.length);
    const allCornerPermutations = generatePermutations(cornersToUse);

    interface Assignment {
      combination: Array<{station: AlertTooltip, corner: any}>;
      crossings: number;
      totalDistance: number;
    }

    const assignments: Assignment[] = [];

    for (const cornerPerm of allCornerPermutations) {
      const combination = stationsToProcess.map((station, index) => ({
        station,
        corner: cornerPerm[index]
      }));

      const crossings = calculateCrossings(combination);

      let totalDistance = 0;
      for (const {station, corner} of combination) {
        totalDistance += calculateDistance(station.coordinates, corner.position);
      }

      assignments.push({ combination, crossings, totalDistance });
    }

    assignments.sort((a, b) => {
      if (a.crossings !== b.crossings) {
        return a.crossings - b.crossings;
      }
      return a.totalDistance - b.totalDistance;
    });

    const bestAssignment = assignments[0];

    return bestAssignment.combination.map(({station, corner}) => ({
      ...station,
      tooltipPosition: corner.position,
      cornerId: corner.id,
      isActive: true
    }));
  };

  const updateTooltipData = (positionedTooltips: AlertTooltip[], allStations: AlertTooltip[]): AlertTooltip[] => {
    if (positionedTooltips.length === 0) return [];

    const stationMap: Record<string, AlertTooltip> = {};
    allStations.forEach(station => {
      stationMap[station.stationId] = station;
    });

    return positionedTooltips.map((tooltip) => {
      const latestStationData = stationMap[tooltip.stationId];

      if (!latestStationData) {
        return tooltip;
      }

      return {
        ...tooltip,
        stationCode: latestStationData.stationCode,
        intensity: latestStationData.intensity,
        pga: latestStationData.pga,
        coordinates: latestStationData.coordinates,
      };
    });
  };

  const initializeMapSource = useCallback(() => {
    if (!mapRef.current || !stationData || sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();

    if (!map.getSource('stations')) {
      map.addSource('stations', {
        type: 'geojson',
        data: stationData,
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
  }, [stationData]);

  const updateMapData = useCallback((newData: StationGeoJSON) => {
    if (!mapRef.current || !sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    const source = map.getSource('stations') as any;

    if (source && source.setData) {
      source.setData(newData);
    }
  }, []);

  const updateBoxData = useCallback(() => {
    if (!mapRef.current || !sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    const source = map.getSource('boxes') as any;

    if (source && source.setData) {
      const boxGeoJSON = createBoxGeoJSON();
      if (boxGeoJSON) {
        source.setData(boxGeoJSON);
      }
    }
  }, [createBoxGeoJSON]);

  const updateTooltipLines = useCallback((tooltips: AlertTooltip[]) => {
    if (!mapRef.current || !sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    const source = map.getSource('tooltip-lines') as any;
    
    if (source && source.setData) {
      const lineFeatures = tooltips
        .filter(tooltip => tooltip.isActive)
        .map(tooltip => ({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: [tooltip.coordinates, tooltip.tooltipPosition]
          },
          properties: {
            stationId: tooltip.stationId,
            cornerId: tooltip.cornerId
          }
        }));

      const lineData = {
        type: 'FeatureCollection' as const,
        features: lineFeatures
      };

      source.setData(lineData);
    }
  }, []);

  const handleMapLoad = useCallback(() => {
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    isMapReadyRef.current = isMapReady;
  }, [isMapReady]);

  useEffect(() => {
    updateMapDataRef.current = updateMapData;
  }, [updateMapData]);

  useEffect(() => {
    if (!isMountedRef.current || !rtsData) return;

    const data = rtsData;

    if (isMountedRef.current) {
      setStationData(data.geojson);
      setDataTime(data.time);
    }

    let max = -3;
    data.geojson.features.forEach((feature) => {
      if (feature.properties.intensity > max) {
        max = feature.properties.intensity;
      }
    });
    
    if (isMountedRef.current) {
      setMaxIntensity(max);
    }

    const alertStations: AlertTooltip[] = [];
    data.geojson.features.forEach((feature) => {
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
    });

    if (isMountedRef.current) {
      setAllAlertStations(alertStations);
    }
  }, [rtsData]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (allAlertStations.length === 0) {
      setAlertTooltips([]);
      return;
    }

    const positionedTooltips = assignTooltipPositions(allAlertStations);
    if (isMountedRef.current) {
      setAlertTooltips(positionedTooltips);
    }
  }, [tooltipSwitchIndex]); 

  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (allAlertStations.length === 0) {
      setCurrentTooltipData([]);
      return;
    }

    const currentPositions = alertTooltips.length > 0 ? alertTooltips : assignTooltipPositions(allAlertStations);
    const updatedTooltips = updateTooltipData(currentPositions, allAlertStations);
    if (isMountedRef.current) {
      setCurrentTooltipData(updatedTooltips);
    }
  }, [allAlertStations, alertTooltips]);

  useEffect(() => {
    if (!rtsData || !isMapReadyRef.current || !sourceInitializedRef.current) return;

    const connectedStationIds = new Set(currentTooltipData.map(t => t.stationId));
    const updatedGeoJSON = {
      ...rtsData.geojson,
      features: rtsData.geojson.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          isConnected: connectedStationIds.has(feature.properties.id)
        }
      }))
    };

    updateMapDataRef.current(updatedGeoJSON);
    updateTooltipLines(currentTooltipData);
  }, [rtsData, currentTooltipData, updateTooltipLines]);

  useEffect(() => {
    if (isMapReady && stationData) {
      initializeMapSource();
    }
  }, [isMapReady, stationData, initializeMapSource]);

  useEffect(() => {
    isMountedRef.current = true;
    
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      setTooltipSwitchIndex(prev => {
        const newValue = prev + 1;
        tooltipSwitchIndexRef.current = newValue;
        return newValue;
      });
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      setBoxVisible(prev => !prev);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !sourceInitializedRef.current) return;

    const map = mapRef.current.getMap();
    const layer = map.getLayer('box-outlines');

    if (layer) {
      map.setLayoutProperty('box-outlines', 'visibility', boxVisible ? 'visible' : 'none');
    }
  }, [boxVisible]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (rtsData && isMapReadyRef.current && sourceInitializedRef.current) {
      updateBoxData();
    }
  }, [rtsData, updateBoxData]);

  // 清理 Map 實例和所有資源
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // 清理 Map 實例
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        if (map) {
          // 移除所有事件監聽器
          map.off();
          // 移除所有圖層和資源
          try {
            const sources = ['stations', 'tooltip-lines', 'boxes'];
            const layers = ['station-circles', 'tooltip-lines', 'box-outlines'];
            
            layers.forEach(layerId => {
              if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
              }
            });
            
            sources.forEach(sourceId => {
              if (map.getSource(sourceId)) {
                map.removeSource(sourceId);
              }
            });
          } catch (error) {
            // 忽略清理錯誤
          }
        }
        mapRef.current = null;
      }
      
      // 清理所有 refs
      sourceInitializedRef.current = false;
      isMapReadyRef.current = false;
      updateMapDataRef.current = null;
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