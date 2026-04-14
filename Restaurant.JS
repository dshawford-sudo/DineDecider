export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    mode,
    zip,
    lat,
    lng,
    radius = "4800",
    cuisine = "Any",
    priceLevel = "Any"
  } = req.query;

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const geocodeApiKey = process.env.GOOGLE_GEOCODING_API_KEY || googleApiKey;

  try {
    if (mode === "geocode") {
      if (!zip) {
        return res.status(400).json({ error: "ZIP code is required." });
      }

      if (!geocodeApiKey) {
        return res.status(500).json({
          error: "Missing GOOGLE_GEOCODING_API_KEY or GOOGLE_PLACES_API_KEY environment variable."
        });
      }

      const geocodeUrl =
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zip)}&key=${geocodeApiKey}`;

      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();

      if (!geocodeResponse.ok || geocodeData.status !== "OK" || !geocodeData.results?.length) {
        return res.status(400).json({ error: "Could not find that ZIP code." });
      }

      const result = geocodeData.results[0];

      return res.status(200).json({
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        label: result.formatted_address
      });
    }

    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    if (!googleApiKey) {
      return res.status(500).json({
        error: "Missing GOOGLE_PLACES_API_KEY environment variable."
      });
    }

    const includedTypes = buildIncludedTypes(cuisine);
    const fields = [
      "places.displayName",
      "places.formattedAddress",
      "places.rating",
      "places.priceLevel",
      "places.primaryTypeDisplayName",
      "places.location",
      "places.googleMapsUri",
      "places.photos"
    ];

    const body = {
      maxResultCount: 12,
      locationRestriction: {
        circle: {
          center: {
            latitude: Number(lat),
            longitude: Number(lng)
          },
          radius: Number(radius)
        }
      },
      rankPreference: "POPULARITY",
      includedTypes
    };

    const placesResponse = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": fields.join(",")
      },
      body: JSON.stringify(body)
    });

    const placesData = await placesResponse.json();

    if (!placesResponse.ok) {
      return res.status(500).json({
        error: placesData?.error?.message || "Failed to fetch restaurants."
      });
    }

    const mapped = (placesData.places || [])
      .map(place => mapPlace(place, Number(lat), Number(lng)))
      .filter(place => passesPriceFilter(place, priceLevel));

    return res.status(200).json(mapped);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unexpected server error."
    });
  }
}

function buildIncludedTypes(cuisine) {
  const normalized = String(cuisine || "Any").toLowerCase();

  const cuisineMap = {
    any: ["restaurant"],
    american: ["american_restaurant"],
    italian: ["italian_restaurant"],
    mexican: ["mexican_restaurant"],
    asian: ["asian_restaurant"],
    pizza: ["pizza_restaurant"],
    burgers: ["hamburger_restaurant"],
    seafood: ["seafood_restaurant"],
    desserts: ["dessert_restaurant", "bakery"]
  };

  return cuisineMap[normalized] || ["restaurant"];
}

function mapPlace(place, originLat, originLng) {
  const photoName = place.photos?.[0]?.name;
  const image = photoName
    ? `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=900&maxWidthPx=1200&key=${process.env.GOOGLE_PLACES_API_KEY}`
    : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80";

  const cuisine =
    place.primaryTypeDisplayName?.text ||
    humanizeType(place.primaryType) ||
    "Restaurant";

  return {
    name: place.displayName?.text || "Restaurant",
    rating: place.rating ?? "N/A",
    image,
    address: place.formattedAddress || "Address unavailable",
    priceLevel: normalizePriceLevel(place.priceLevel),
    cuisine,
    distanceMeters: haversineDistanceMeters(
      originLat,
      originLng,
      place.location?.latitude,
      place.location?.longitude
    ),
    mapsUrl: place.googleMapsUri || ""
  };
}

function normalizePriceLevel(priceLevel) {
  const map = {
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$"
  };
  return map[priceLevel] || "Unknown";
}

function passesPriceFilter(place, requested) {
  if (!requested || requested === "Any") return true;
  return place.priceLevel === requested;
}

function humanizeType(type) {
  if (!type) return "";
  return String(type)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    [lat1, lon1, lat2, lon2].some(value => typeof value !== "number" || Number.isNaN(value))
  ) {
    return 0;
  }

  const toRadians = degrees => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}
