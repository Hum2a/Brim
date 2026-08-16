import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { boundsFromPoints, polylinePoints, ukBounds } from "./map-geometry.js";
import { MAP_STYLE_URL } from "./map-style.js";

export type MapPin = { lat: number; lng: number; label?: string };

export type RouteMapOverlays = {
  stations?: Array<{ id: string; lat: number; lng: number; label?: string }>;
  zones?: Array<{ id: string; name: string; geojson: unknown }>;
};

export type RouteMapProps = {
  origin?: MapPin;
  destination?: MapPin;
  encodedPolyline?: string;
  overlays?: RouteMapOverlays;
  reduceMotion?: boolean;
  onMapClick: (pin: { lat: number; lng: number }) => void;
  onOriginDrag: (pin: { lat: number; lng: number }) => void;
  onDestinationDrag: (pin: { lat: number; lng: number }) => void;
};

type LineFeature = {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: Array<[number, number]> };
};

const emptyLine: LineFeature = {
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: [] },
};

function markerEl(kind: "origin" | "destination"): HTMLDivElement {
  const el = document.createElement("div");
  el.className =
    kind === "origin"
      ? "h-3 w-3 rounded-[2px] border border-forecourt bg-pump"
      : "h-3 w-3 rounded-[2px] border border-forecourt bg-diesel";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", kind === "origin" ? "Origin" : "Destination");
  return el;
}

function whenStyleReady(map: maplibregl.Map, fn: () => void): void {
  if (map.isStyleLoaded()) fn();
  else map.once("load", fn);
}

export default function RouteMap(props: RouteMapProps) {
  const {
    origin,
    destination,
    encodedPolyline,
    reduceMotion = false,
    onMapClick,
    onOriginDrag,
    onDestinationDrag,
  } = props;
  void props.overlays;

  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);
  const dragging = useRef(false);
  const clickRef = useRef(onMapClick);
  const originDragRef = useRef(onOriginDrag);
  const destDragRef = useRef(onDestinationDrag);
  clickRef.current = onMapClick;
  originDragRef.current = onOriginDrag;
  destDragRef.current = onDestinationDrag;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const map = new maplibregl.Map({
      container: node,
      style: MAP_STYLE_URL,
      bounds: ukBounds(),
      fitBoundsOptions: { padding: 24, duration: 0 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      if (!map.getSource("route")) {
        map.addSource("route", { type: "geojson", data: emptyLine });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#1F6F63",
            "line-width": 4,
          },
        });
      }
    });
    map.on("click", (ev) => {
      if (dragging.current) return;
      clickRef.current({ lat: ev.lngLat.lat, lng: ev.lngLat.lng });
    });
    return () => {
      originMarker.current?.remove();
      destMarker.current?.remove();
      originMarker.current = null;
      destMarker.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncMarker = (
      slot: "origin" | "destination",
      pin: MapPin | undefined,
      current: maplibregl.Marker | null,
      onDrag: (pin: { lat: number; lng: number }) => void,
    ): maplibregl.Marker | null => {
      if (!pin) {
        current?.remove();
        return null;
      }
      if (current) {
        current.setLngLat([pin.lng, pin.lat]);
        return current;
      }
      const marker = new maplibregl.Marker({ element: markerEl(slot), draggable: true })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      marker.on("dragstart", () => {
        dragging.current = true;
      });
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        onDrag({ lat: ll.lat, lng: ll.lng });
        window.setTimeout(() => {
          dragging.current = false;
        }, 0);
      });
      return marker;
    };

    const apply = () => {
      originMarker.current = syncMarker("origin", origin, originMarker.current, (p) =>
        originDragRef.current(p),
      );
      destMarker.current = syncMarker("destination", destination, destMarker.current, (p) =>
        destDragRef.current(p),
      );
    };
    whenStyleReady(map, apply);
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (!encodedPolyline) {
        source?.setData(emptyLine);
        return;
      }
      const points = polylinePoints(encodedPolyline);
      const data: LineFeature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: points.map((p) => [p.lng, p.lat]),
        },
      };
      source?.setData(data);
      const bounds = boundsFromPoints(points);
      if (bounds) {
        map.fitBounds(bounds, {
          padding: 48,
          duration: reduceMotion ? 0 : 400,
          maxZoom: 12,
        });
      }
    };
    whenStyleReady(map, apply);
  }, [encodedPolyline, reduceMotion]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-label="Trip map. Tap to set origin, then destination."
    />
  );
}
