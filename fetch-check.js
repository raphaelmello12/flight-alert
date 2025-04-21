require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendNotifications } = require('./notify');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const RESULTS_FILE = 'price.json';
const HISTORY_FILE = 'price-history.json';

async function fetchSingleRoute(searchConfig) {
  try {
    console.log(`Starting flight search for ${searchConfig.origin} → ${searchConfig.destination}`);

    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_flights',
        api_key: SERPAPI_KEY,
        departure_id: searchConfig.origin,
        arrival_id: searchConfig.destination,
        outbound_date: searchConfig.departureDateRange.start,
        return_date: searchConfig.returnDateRange.start,
        currency: config.currency,
        hl: 'en',
        adults: config.passengers
      }
    });

    console.log(`API Response status: ${response.status}`);

    if (!response.data.best_flights || !Array.isArray(response.data.best_flights)) {
      console.log('No flights found, creating mock data');
      return [{
        price: config.maxPrice + 100,
        departureDate: searchConfig.departureDateRange.start,
        returnDate: searchConfig.returnDateRange.start,
        airline: 'No flights found',
        source: 'Google Flights',
        route: `${searchConfig.origin} → ${searchConfig.destination}`
      }];
    }

    // Sort flights by price to get the cheapest ones
    const sortedFlights = response.data.best_flights.sort((a, b) => {
      const priceA = typeof a.price === 'string' ? parseFloat(a.price.replace(/[^0-9.]/g, '')) : a.price;
      const priceB = typeof b.price === 'string' ? parseFloat(b.price.replace(/[^0-9.]/g, '')) : b.price;
      return priceA - priceB;
    });

    return sortedFlights.map(flight => ({
      price: typeof flight.price === 'string' ? 
        parseFloat(flight.price.replace(/[^0-9.]/g, '')) : 
        flight.price,
      departureDate: flight.departure_date || searchConfig.departureDateRange.start,
      returnDate: flight.return_date || searchConfig.returnDateRange.start,
      deepLink: flight.booking_link || `https://www.google.com/travel/flights?q=Flights%20from%20${searchConfig.origin}%20to%20${searchConfig.destination}`,
      airline: flight.airline || 'Multiple Airlines',
      source: flight.source || 'Google Flights',
      route: `${searchConfig.origin} → ${searchConfig.destination}`
    }));
  } catch (error) {
    console.error(`Error fetching flights: ${error.message}`);
    return [{
      price: config.maxPrice + 100,
      departureDate: searchConfig.departureDateRange.start,
      returnDate: searchConfig.returnDateRange.start,
      airline: 'Error fetching flights',
      source: 'Error',
      route: `${searchConfig.origin} → ${searchConfig.destination}`
    }];
  }
}

async function fetchFlights() {
  try {
    // Fetch flights for all routes
    const allFlightsPromises = config.searches.map(searchConfig => 
      fetchSingleRoute(searchConfig)
    );
    
    const allFlightsArrays = await Promise.all(allFlightsPromises);
    const allFlights = allFlightsArrays.flat();

    console.log('All processed flights:', allFlights);

    // Load existing history
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }

    // Add current prices to history
    const timestamp = new Date().toISOString();
    history.push({
      timestamp,
      flights: allFlights
    });

    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    history = history.filter(entry => new Date(entry.timestamp) > thirtyDaysAgo);

    const results = {
      lastChecked: timestamp,
      flights: allFlights,
      currency: config.currency,
      config: config,
      history
    };

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // Check for flights under threshold and send notifications for the cheapest ones
    const cheapFlights = allFlights.filter(f => f.price <= config.maxPrice);
    if (cheapFlights.length > 0) {
      // Sort by price and get the cheapest ones
      const cheapestFlights = cheapFlights.sort((a, b) => a.price - b.price);
      await sendNotifications(cheapestFlights);
    }

    console.log('Successfully completed all flight checks');

  } catch (error) {
    console.error('Error in main process:', error);
    
    // Create empty results file to prevent deployment failures
    const results = {
      lastChecked: new Date().toISOString(),
      flights: [],
      currency: config.currency,
      config: config,
      history: []
    };
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
  }
}

fetchFlights(); 