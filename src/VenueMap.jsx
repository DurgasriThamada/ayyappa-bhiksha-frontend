import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix missing default icon issue with Vite/Webpack build tools
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom Saffron/Orange icon for Bhiksha venues
const venueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper component to smoothly re-center map when location updates
function RecenterMap({ center }) {
  const map = useMap();
  map.setView(center);
  return null;
}

export default function VenueMap({ userLocation, venues }) {
  const position = [userLocation.lat, userLocation.lng];

  return (
    <div className="w-full h-72 rounded-2xl overflow-hidden shadow-md border border-slate-200 z-0 relative">
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        {/* OpenStreetMap Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterMap center={position} />

        {/* User GPS Location Marker */}
        <Marker position={position}>
          <Popup>
            <div className="text-xs font-sans">
              <strong>📍 Your Location</strong>
            </div>
          </Popup>
        </Marker>

        {/* Venue Markers */}
        {venues.map((venue) => {
          const lat = parseFloat(venue.lat);
          const lng = parseFloat(venue.lng);
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker key={venue.id} position={[lat, lng]} icon={venueIcon}>
              <Popup>
                <div className="text-xs font-sans space-y-1">
                  <strong className="text-orange-700 block text-sm">{venue.name}</strong>
                  <p className="text-slate-600 m-0">{venue.address}</p>
                  <p className="text-slate-500 m-0">⏰ {venue.timings}</p>
                  {venue.distance && (
                    <p className="text-orange-600 font-bold m-0">{venue.distance} km away</p>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 bg-orange-600 text-white px-2 py-1 rounded text-[11px] font-semibold text-center no-underline"
                  >
                    🧭 Directions
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}