const app = document.getElementById("app");

const FILTERS = {
  cuisines: ["Any", "American", "Italian", "Mexican", "Asian", "Pizza", "Burgers", "Seafood", "Desserts"],
  priceLevels: ["Any", "$", "$$", "$$$", "$$$$"],
  distances: [
    { label: "Within 1 mile", value: 1600 },
    { label: "Within 3 miles", value: 4800 },
    { label: "Within 5 miles", value: 8000 },
    { label: "Within 10 miles", value: 16000 }
  ],
  vibes: ["Any", "Casual", "Quick bite", "Date night", "Family-friendly", "Trendy", "Cozy"]
};

const state = {
  name: "",
  zip: "",
  locationLabel: "",
  location: null,
  restaurants: [],
  deck: [],
  matches: [],
  index: 0,
  preferences: {
    cuisine: "Any",
    priceLevel: "Any",
    distance: 4800,
    vibe: "Any"
  }
};

function render(html) {
  app.innerHTML = html;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fallbackImage() {
  return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80";
}

function resetFlow() {
  state.restaurants = [];
  state.deck = [];
  state.matches = [];
  state.index = 0;
}

function normalizeRestaurant(item) {
  return {
    name: item?.name || "Unknown restaurant",
    rating: item?.rating ?? "N/A",
    image: item?.image || fallbackImage(),
    address: item?.address || "Address unavailable",
    priceLevel: item?.priceLevel || "Unknown",
    cuisine: item?.cuisine || "Restaurant",
    distanceMeters: Number(item?.distanceMeters || 0),
    mapsUrl: item?.mapsUrl || ""
  };
}

function formatDistance(distanceMeters) {
  if (!distanceMeters || Number.isNaN(distanceMeters)) return "Distance unavailable";
  const miles = distanceMeters / 1609.34;
  return miles < 0.2 ? "Very close" : `${miles.toFixed(1)} miles away`;
}

function showHome() {
  resetFlow();

  render(`
    <div class="card">
      <div class="card__header">
        <div class="card__eyebrow">Get started</div>
        <h2>Let’s find your next meal</h2>
        <p>Type your name, then either share your location or enter a ZIP code.</p>
      </div>

      <div class="form-grid">
        <div class="input-group">
          <label for="nameInput">Your name</label>
          <input id="nameInput" type="text" placeholder="Example: Alex" value="${escapeHtml(state.name)}" />
        </div>

        <div class="input-group">
          <label for="zipInput">ZIP code (optional)</label>
          <input id="zipInput" type="text" placeholder="Example: 28223" value="${escapeHtml(state.zip)}" />
        </div>
      </div>

      <div class="actions">
        <button class="primary" onclick="useMyLocation()">Use my current location</button>
        <button class="ghost" onclick="continueWithZip()">Continue with ZIP code</button>
      </div>
    </div>
  `);
}

function showLoading(title = "Working on it", message = "Please wait...") {
  render(`
    <div class="card status-card">
      <div class="spinner"></div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `);
}

function showError(message, retryAction = "showHome()") {
  render(`
    <div class="card">
      <div class="card__eyebrow">Something went wrong</div>
      <h2>We hit a snag</h2>
      <p>${escapeHtml(message)}</p>
      <div class="actions">
        <button class="primary" onclick="${retryAction}">Try again</button>
        <button class="secondary" onclick="showHome()">Start over</button>
      </div>
    </div>
  `);
}

function captureFormBasics() {
  const nameInput = document.getElementById("nameInput");
  const zipInput = document.getElementById("zipInput");

  state.name = nameInput ? nameInput.value.trim() : state.name;
  state.zip = zipInput ? zipInput.value.trim() : state.zip;

  if (!state.name) {
    alert("Please enter your name first.");
    return false;
  }

  return true;
}

function continueWithZip() {
  if (!captureFormBasics()) return;

  if (!state.zip) {
    alert("Please enter a ZIP code or use your current location.");
    return;
  }

  showPreferences();
}

function useMyLocation() {
  if (!captureFormBasics()) return;

  if (!navigator.geolocation) {
    showError("This browser does not support location access. Please use the ZIP code option.");
    return;
  }

  showLoading("Getting your location", "Allow location access in the browser if it asks.");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      state.locationLabel = "Current location";
      showPreferences();
    },
    (error) => {
      let message = "Could not get your location.";
      if (error.code === 1) {
        message = "Location permission was denied. You can try again or use a ZIP code.";
      } else if (error.code === 2) {
        message = "Your location could not be determined.";
      } else if (error.code === 3) {
        message = "The location request took too long. Please try again.";
      }
      showError(message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function showPreferences() {
  render(`
    <div class="card">
      <div class="card__header">
        <div class="card__eyebrow">Hello ${escapeHtml(state.name)}</div>
        <h2>Set your food mood</h2>
        <p>These filters help us build a better stack of nearby restaurants.</p>
      </div>

      <div class="form-grid">
        <div class="input-group">
          <label for="cuisineSelect">Cuisine</label>
          <select id="cuisineSelect">
            ${FILTERS.cuisines.map(item => `
              <option value="${escapeHtml(item)}" ${state.preferences.cuisine === item ? "selected" : ""}>
                ${escapeHtml(item)}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="input-group">
          <label for="priceSelect">Price</label>
          <select id="priceSelect">
            ${FILTERS.priceLevels.map(item => `
              <option value="${escapeHtml(item)}" ${state.preferences.priceLevel === item ? "selected" : ""}>
                ${escapeHtml(item)}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="input-group">
          <label for="distanceSelect">Distance</label>
          <select id="distanceSelect">
            ${FILTERS.distances.map(item => `
              <option value="${item.value}" ${Number(state.preferences.distance) === item.value ? "selected" : ""}>
                ${escapeHtml(item.label)}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="input-group">
          <label for="vibeSelect">Vibe</label>
          <select id="vibeSelect">
            ${FILTERS.vibes.map(item => `
              <option value="${escapeHtml(item)}" ${state.preferences.vibe === item ? "selected" : ""}>
                ${escapeHtml(item)}
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      <div class="actions">
        <button class="primary" onclick="findRestaurants()">Show restaurants</button>
        <button class="secondary" onclick="showHome()">Back</button>
      </div>
    </div>
  `);
}

async function geocodeZip(zip) {
  const response = await fetch(`/api/restaurants?zip=${encodeURIComponent(zip)}&mode=geocode`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not convert ZIP code to coordinates.");
  }
  return response.json();
}

async function findRestaurants() {
  const cuisineSelect = document.getElementById("cuisineSelect");
  const priceSelect = document.getElementById("priceSelect");
  const distanceSelect = document.getElementById("distanceSelect");
  const vibeSelect = document.getElementById("vibeSelect");

  state.preferences = {
    cuisine: cuisineSelect ? cuisineSelect.value : "Any",
    priceLevel: priceSelect ? priceSelect.value : "Any",
    distance: distanceSelect ? Number(distanceSelect.value) : 4800,
    vibe: vibeSelect ? vibeSelect.value : "Any"
  };

  try {
    showLoading("Finding nearby restaurants", "This may take a few seconds.");

    let lat;
    let lng;
    let locationLabel = state.locationLabel;

    if (state.location) {
      lat = state.location.lat;
      lng = state.location.lng;
    } else if (state.zip) {
      const geocodeData = await geocodeZip(state.zip);
      lat = geocodeData.lat;
      lng = geocodeData.lng;
      locationLabel = geocodeData.label || `ZIP ${state.zip}`;
      state.location = { lat, lng };
      state.locationLabel = locationLabel;
    } else {
      throw new Error("Please use your location or enter a ZIP code.");
    }

    const query = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(state.preferences.distance),
      cuisine: state.preferences.cuisine,
      priceLevel: state.preferences.priceLevel,
      vibe: state.preferences.vibe
    });

    const response = await fetch(`/api/restaurants?${query.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load restaurants.");
    }

    if (!Array.isArray(data) || !data.length) {
      throw new Error("No restaurants were found for this location and filter combination.");
    }

    state.restaurants = data.map(normalizeRestaurant);
    state.deck = [...state.restaurants];
    state.matches = [];
    state.index = 0;

    showSwipe();
  } catch (error) {
    showError(error.message || "Could not load restaurants.", "findRestaurants()");
  }
}

function showSwipe() {
  if (!state.deck.length) {
    render(`
      <div class="card">
        <div class="card__eyebrow">No results</div>
        <h2>Nothing matched this search</h2>
        <p>Try widening the distance or using a broader cuisine filter.</p>
        <div class="actions">
          <button class="primary" onclick="showPreferences()">Adjust filters</button>
          <button class="secondary" onclick="showHome()">Start over</button>
        </div>
      </div>
    `);
    return;
  }

  if (state.index >= state.deck.length) {
    showResult();
    return;
  }

  const restaurant = state.deck[state.index];
  const progressPercent = Math.round(((state.index + 1) / state.deck.length) * 100);

  render(`
    <div class="card restaurant-card">
      <div class="restaurant-image-wrap">
        <img
          class="restaurant-image"
          src="${restaurant.image}"
          alt="${escapeHtml(restaurant.name)}"
          onerror="this.onerror=null;this.src='${fallbackImage()}';"
        />
        <div class="restaurant-badge">${escapeHtml(state.locationLabel || "Nearby results")}</div>
      </div>

      <div class="restaurant-title-row">
        <div>
          <h2>${escapeHtml(restaurant.name)}</h2>
          <div class="small-note">${escapeHtml(restaurant.cuisine)}</div>
        </div>
        <div class="restaurant-rating">${escapeHtml(String(restaurant.rating))} ⭐</div>
      </div>

      <div class="meta-list">
        <div class="meta-item"><strong>Address:</strong> ${escapeHtml(restaurant.address)}</div>
        <div class="meta-item"><strong>Price:</strong> ${escapeHtml(restaurant.priceLevel)}</div>
        <div class="meta-item"><strong>Distance:</strong> ${escapeHtml(formatDistance(restaurant.distanceMeters))}</div>
      </div>

      <div class="actions">
        <button class="secondary" onclick="nextChoice('skip')">Skip</button>
        <button class="primary" onclick="nextChoice('keep')">Keep</button>
      </div>

      <div class="progress">
        <div class="progress__top">
          <span>${state.index + 1} of ${state.deck.length}</span>
          <span>${progressPercent}% viewed</span>
        </div>
        <div class="progress__bar">
          <span style="width:${progressPercent}%"></span>
        </div>
      </div>
    </div>
  `);
}

function nextChoice(choice) {
  const current = state.deck[state.index];
  if (choice === "keep" && current) {
    state.matches.push(current);
  }
  state.index += 1;
  showSwipe();
}

function showResult() {
  const pool = state.matches.length ? state.matches : state.deck;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  if (!picked) {
    showError("We could not choose a restaurant this time.", "showPreferences()");
    return;
  }

  const mapsButton = picked.mapsUrl
    ? `<a href="${picked.mapsUrl}" target="_blank" rel="noopener noreferrer"><button class="ghost">Open in Maps</button></a>`
    : "";

  render(`
    <div class="card result-card">
      <div class="result-card__pill">You have a winner</div>

      <div class="restaurant-image-wrap">
        <img
          class="restaurant-image"
          src="${picked.image}"
          alt="${escapeHtml(picked.name)}"
          onerror="this.onerror=null;this.src='${fallbackImage()}';"
        />
      </div>

      <h2>${escapeHtml(picked.name)}</h2>
      <p>${escapeHtml(picked.cuisine)} • ${escapeHtml(String(picked.rating))} ⭐ • ${escapeHtml(picked.priceLevel)}</p>
      <p>${escapeHtml(picked.address)}</p>

      <div class="actions">
        <button class="primary" onclick="showSwipe()">Browse again</button>
        <button class="secondary" onclick="showPreferences()">Change filters</button>
        ${mapsButton}
      </div>

      <p class="small-note">
        ${state.matches.length
          ? `Chosen from ${state.matches.length} restaurant${state.matches.length === 1 ? "" : "s"} you kept.`
          : "You skipped everything, so we picked one from the original list for you."}
      </p>
    </div>
  `);
}

window.showHome = showHome;
window.useMyLocation = useMyLocation;
window.continueWithZip = continueWithZip;
window.showPreferences = showPreferences;
window.findRestaurants = findRestaurants;
window.nextChoice = nextChoice;
window.showSwipe = showSwipe;

showHome();
