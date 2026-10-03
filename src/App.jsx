import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const venueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function RecenterMap({ center }) {
  const map = useMap();
  map.setView(center);
  return null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://ayyappa-bhiksha-api.onrender.com';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [venues, setVenues] = useState([]);
  const [userLocation, setUserLocation] = useState({ lat: 17.4399, lng: 78.4982 });
  const [locationText, setLocationText] = useState('Detecting GPS...');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Location Search State
  const [searchAddressQuery, setSearchAddressQuery] = useState('');
  const [addressSearchResults, setAddressSearchResults] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // New Venue State
  const [newVenue, setNewVenue] = useState({
    name: '',
    address: '',
    city: 'Secunderabad',
    timings: '12:00 PM - 3:30 PM',
    phone: '',
    lat: 17.4399,
    lng: 78.4982
  });

  // 1. Auth Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    // Prefixed with /api to match server.js routes
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      if (authMode === 'login') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setCurrentUser(data.user);
        setAuthForm({ username: '', password: '' });
      } else {
        alert('Account created! Please log in.');
        setAuthMode('login');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setCurrentUser(null);
  };

  // 2. Fetch Venues
  const fetchVenues = async () => {
    try {
      // Prefixed with /api
      const response = await fetch(`${API_BASE_URL}/api/venues`);
      if (response.ok) {
        const data = await response.json();
        setVenues(data);
      }
    } catch (error) {
      console.error('API connection error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(coords);
          setLocationText(`GPS: ${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`);
          setNewVenue((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }));
        },
        () => setLocationText('Secunderabad (Default GPS)')
      );
    }
  }, []);

  // 3. Search Address in Modal
  const handleSearchLocation = async (query) => {
    setSearchAddressQuery(query);
    if (query.trim().length < 3) {
      setAddressSearchResults([]);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ', Hyderabad, Telangana'
        )}&limit=5`
      );
      if (response.ok) {
        const data = await response.json();
        setAddressSearchResults(data);
      }
    } catch (error) {
      console.error('Error searching location:', error);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSelectLocationResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    setNewVenue((prev) => ({
      ...prev,
      name: prev.name || result.display_name.split(',')[0],
      address: result.display_name,
      lat: lat,
      lng: lng,
    }));

    setSearchAddressQuery('');
    setAddressSearchResults([]);
  };

  // 4. Admin Save Venue
  const handleSaveVenue = async (e) => {
    e.preventDefault();
    if (!newVenue.name || !newVenue.address) return;

    try {
      // Prefixed with /api
      const response = await fetch(`${API_BASE_URL}/api/venues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newVenue,
          lat: parseFloat(newVenue.lat),
          lng: parseFloat(newVenue.lng),
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setNewVenue({ name: '', address: '', city: 'Secunderabad', timings: '12:00 PM - 3:30 PM', phone: '', lat: userLocation.lat, lng: userLocation.lng });
        fetchVenues();
        alert('Venue added successfully!');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to publish venue');
      }
    } catch (error) {
      alert('Failed to publish venue: ' + error.message);
    }
  };

  // 5. Admin Update Venue Status
  const handleUpdateStatus = async (venueId, newStatus) => {
    try {
      // Prefixed with /api
      const response = await fetch(`${API_BASE_URL}/api/venues/${venueId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchVenues();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredVenues = useMemo(() => {
    return venues.filter((v) =>
      (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.city || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [venues, searchQuery]);

  // LOGIN SCREEN FOR UNAUTHENTICATED USERS
  if (!token || !currentUser) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl w-full space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-orange-500">🛕 Ayyappa Bhiksha</h1>
            <p className="text-xs text-slate-400 mt-1">Please log in to continue</p>
          </div>

          {authError && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-2 rounded text-xs text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Username</label>
              <input
                type="text"
                required
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full p-2.5 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Password</label>
              <input
                type="password"
                required
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full p-2.5 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-600 font-bold text-white rounded-lg hover:bg-orange-500"
            >
              {authMode === 'login' ? 'Log In' : 'Register'}
            </button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-700">
            {authMode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button onClick={() => setAuthMode('register')} className="text-orange-400 font-semibold underline">
                  Register as User
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button onClick={() => setAuthMode('login')} className="text-orange-400 font-semibold underline">
                  Log In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MAIN AUTHENTICATED APP SCREEN
  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-100 flex flex-col shadow-2xl relative pb-16 font-sans">
      {/* Header */}
      <header className="bg-orange-600 text-white p-4 shadow-md sticky top-0 z-20 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">🛕 Ayyappa Bhiksha</h1>
          <p className="text-[11px] text-orange-200">
            Welcome, <b>{currentUser.username}</b> ({currentUser.role})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* List/Map View Switcher */}
          <div className="bg-orange-800 p-0.5 rounded-lg flex text-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1 rounded-md font-semibold ${viewMode === 'list' ? 'bg-white text-orange-800' : 'text-orange-100'}`}
            >
              📋
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-2 py-1 rounded-md font-semibold ${viewMode === 'map' ? 'bg-white text-orange-800' : 'text-orange-100'}`}
            >
              🗺️
            </button>
          </div>

          {/* Add Venue (ADMIN ONLY) */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-orange-800 hover:bg-orange-900 text-xs px-2.5 py-1 rounded-lg font-bold text-white"
            >
              + Add
            </button>
          )}

          <button
            onClick={handleLogout}
            className="bg-red-800 hover:bg-red-900 text-[10px] px-2 py-1 rounded font-bold text-white"
          >
            Logout
          </button>
        </div>
      </header>

      {/* GPS Location Bar */}
      <div className="bg-orange-700 text-white px-4 py-1.5 text-xs flex justify-between">
        <span>📍 {locationText}</span>
        <span className="font-semibold">{filteredVenues.length} Venues</span>
      </div>

      {/* Main Content */}
      <main className="p-4 flex-1">
        {activeTab === 'search' && (
          <input
            type="text"
            placeholder="Search city, landmark, or venue name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2.5 mb-4 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-500 text-sm">Loading PostGIS venues...</div>
        ) : viewMode === 'map' ? (
          /* Interactive Map */
          <div className="space-y-3">
            <div className="w-full h-80 rounded-2xl overflow-hidden shadow-md border border-slate-200 z-0 relative">
              <MapContainer
                center={[userLocation.lat, userLocation.lng]}
                zoom={12}
                scrollWheelZoom={false}
                className="w-full h-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap center={[userLocation.lat, userLocation.lng]} />

                <Marker position={[userLocation.lat, userLocation.lng]}>
                  <Popup>📍 Your Location</Popup>
                </Marker>

                {filteredVenues.map((v) => {
                  const lat = parseFloat(v.lat);
                  const lng = parseFloat(v.lng);
                  if (isNaN(lat) || isNaN(lng)) return null;

                  return (
                    <Marker key={v.id} position={[lat, lng]} icon={venueIcon}>
                      <Popup>
                        <div className="text-xs font-sans space-y-1">
                          <strong className="text-orange-700 block text-sm">{v.name}</strong>
                          <p className="text-slate-600 m-0">{v.address}</p>
                          <p className="text-slate-500 m-0">⏰ {v.timings}</p>
                          <p className="text-emerald-700 font-bold capitalize m-0">Status: {v.status || 'serving'}</p>
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
          </div>
        ) : (
          /* List View */
          <div className="space-y-3">
            {filteredVenues.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No venues found nearby.</div>
            ) : (
              filteredVenues.map((v) => (
                <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <h2 className="font-bold text-sm text-slate-900">{v.name}</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        v.status === 'serving' || !v.status
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : v.status === 'paused'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-300'
                      }`}
                    >
                      ● {v.status || 'serving'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">📍 {v.address}</p>

                  {/* ADMIN-ONLY STATUS CONTROLS */}
                  {currentUser.role === 'admin' && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">👑 Admin Control:</span>
                      <select
                        value={v.status || 'serving'}
                        onChange={(e) => handleUpdateStatus(v.id, e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="serving">🟢 Serving</option>
                        <option value="paused">🟡 Paused</option>
                        <option value="completed">🔴 Completed</option>
                      </select>
                    </div>
                  )}

                  <div className="pt-2 border-t flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-600">⏰ {v.timings}</span>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 font-semibold"
                    >
                      🧭 Navigation
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Add Venue Modal (ADMIN ONLY) */}
      {isModalOpen && currentUser.role === 'admin' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3 text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 text-base border-b pb-2">Add Bhiksha Venue</h3>
            
            <div className="relative">
              <label className="block text-orange-700 font-bold mb-1">🔍 Search Location / Landmark in Hyderabad</label>
              <input
                type="text"
                placeholder="e.g. Clock Tower, Secunderabad"
                value={searchAddressQuery}
                onChange={(e) => handleSearchLocation(e.target.value)}
                className="w-full p-2 border-2 border-orange-200 rounded-lg bg-orange-50 focus:outline-none focus:border-orange-500 text-xs"
              />
              {isSearchingAddress && (
                <p className="text-[10px] text-slate-400 mt-1">Searching Hyderabad vicinity...</p>
              )}

              {addressSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-300 rounded-lg shadow-xl z-30 max-h-40 overflow-y-auto mt-1">
                  {addressSearchResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectLocationResult(item)}
                      className="p-2 border-b text-[11px] text-slate-700 hover:bg-orange-100 cursor-pointer"
                    >
                      📍 <strong>{item.display_name.split(',')[0]}</strong>
                      <p className="text-[10px] text-slate-500 truncate">{item.display_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveVenue} className="space-y-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Venue Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sri Ayyappa Seva Mandali"
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Address *</label>
                <textarea
                  required
                  rows="2"
                  placeholder="Full address"
                  value={newVenue.address}
                  onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2 bg-slate-100 font-semibold rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700"
                >
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white border-t border-slate-200 flex justify-around py-2 z-20">
        <button
          onClick={() => setActiveTab('home')}
          className={`text-xs font-semibold ${activeTab === 'home' ? 'text-orange-600' : 'text-slate-400'}`}
        >
          🏠 Home
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`text-xs font-semibold ${activeTab === 'search' ? 'text-orange-600' : 'text-slate-400'}`}
        >
          🔍 Search
        </button>
      </nav>
    </div>
  );
}