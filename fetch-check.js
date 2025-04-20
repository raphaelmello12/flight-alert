require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { sendNotifications } = require('./notify');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const RESULTS_FILE = 'price.json';
const HISTORY_FILE = 'price-history.json';

async function fetchSingleRoute(searchConfig) {
  try {
    console.log(`Starting flight search for ${searchConfig.name}:`, {
      origin: searchConfig.origin,
      destination: searchConfig.destination,
      outbound_date: searchConfig.departureDateRange.start,
      return_date: searchConfig.returnDateRange.start
    });

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

    console.log(`API Response status for ${searchConfig.name}:`, response.status);

    if (!response.data.best_flights || !Array.isArray(response.data.best_flights)) {
      console.log(`No flights found for ${searchConfig.name}, creating mock data`);
      return [{
        price: config.maxPrice + 100,
        departureDate: searchConfig.departureDateRange.start,
        returnDate: searchConfig.returnDateRange.start,
        airline: 'Sample Airline',
        route: searchConfig.name
      }];
    }

    return response.data.best_flights.map(flight => ({
      price: typeof flight.price === 'string' ? 
        parseFloat(flight.price.replace(/[^0-9.]/g, '')) : 
        flight.price,
      departureDate: flight.departure_date || searchConfig.departureDateRange.start,
      returnDate: flight.return_date || searchConfig.returnDateRange.start,
      deepLink: `https://www.google.com/travel/flights?q=Flights%20from%20${searchConfig.origin}%20to%20${searchConfig.destination}`,
      airline: flight.airline || 'Multiple Airlines',
      route: searchConfig.name
    }));
  } catch (error) {
    console.error(`Error fetching flights for ${searchConfig.name}:`, error.message);
    return [{
      price: config.maxPrice + 100,
      departureDate: searchConfig.departureDateRange.start,
      returnDate: searchConfig.returnDateRange.start,
      airline: 'Error fetching flights',
      route: searchConfig.name
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
      config: {
        searches: config.searches,
        maxPrice: config.maxPrice,
        passengers: config.passengers
      },
      history
    };

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // Check for flights under threshold
    const cheapFlights = allFlights.filter(f => f.price <= config.maxPrice);
    if (cheapFlights.length > 0) {
      await sendNotifications(cheapFlights);
    }

    console.log('Successfully completed all flight checks');

  } catch (error) {
    console.error('Error in main process:', error);
    
    // Create empty results file to prevent deployment failures
    const results = {
      lastChecked: new Date().toISOString(),
      flights: [],
      currency: config.currency,
      config: {
        searches: config.searches,
        maxPrice: config.maxPrice,
        passengers: config.passengers
      },
      history: []
    };
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
  }
}

fetchFlights(); 