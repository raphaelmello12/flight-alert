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

async function fetchFlights() {
  try {
    console.log('Starting flight search with parameters:', {
      origin: config.search.origin,
      destination: config.search.destination,
      outbound_date: config.search.departureDateRange.start,
      return_date: config.search.returnDateRange.end
    });

    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_flights',
        api_key: SERPAPI_KEY,
        departure_id: config.search.origin,
        arrival_id: config.search.destination,
        outbound_date: config.search.departureDateRange.start,
        return_date: config.search.returnDateRange.start,
        currency: 'USD',
        hl: 'en',
        type: 'round',
        adults: config.search.passengers
      }
    });

    console.log('API Response status:', response.status);
    console.log('API Response data structure:', Object.keys(response.data));

    if (!response.data.best_flights || !Array.isArray(response.data.best_flights)) {
      console.log('Full API Response:', JSON.stringify(response.data, null, 2));
      throw new Error('Invalid response format from SerpApi');
    }

    const flights = response.data.best_flights.map(flight => ({
      price: parseFloat(flight.price.replace(/[^0-9.]/g, '')),
      departureDate: flight.departure_date || config.search.departureDateRange.start,
      returnDate: flight.return_date || config.search.returnDateRange.start,
      deepLink: `https://www.google.com/travel/flights?q=Flights%20from%20${config.search.origin}%20to%20${config.search.destination}`,
      airline: flight.airline || 'Multiple Airlines'
    }));

    console.log('Processed flights:', flights);

    // Load existing history
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }

    // Add current prices to history
    const timestamp = new Date().toISOString();
    history.push({
      timestamp,
      flights
    });

    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    history = history.filter(entry => new Date(entry.timestamp) > thirtyDaysAgo);

    const results = {
      lastChecked: timestamp,
      flights,
      config: config.search,
      history
    };

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // Check for flights under threshold
    const cheapFlights = flights.filter(f => f.price <= config.search.maxPrice);
    if (cheapFlights.length > 0) {
      await sendNotifications(cheapFlights);
    }

    console.log('Successfully completed flight check');

  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response data',
      config: error.config ? {
        url: error.config.url,
        params: error.config.params
      } : 'No config data'
    });
    throw error;
  }
}

fetchFlights(); 