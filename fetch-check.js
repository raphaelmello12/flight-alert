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
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_flights',
        api_key: SERPAPI_KEY,
        departure_id: config.search.origin,
        arrival_id: config.search.destination,
        outbound_date: config.search.departureDateRange.start,
        return_date: config.search.returnDateRange.end,
        currency: 'USD',
        hl: 'en',
        gl: 'us'
      }
    });

    const flights = response.data.best_flights.map(flight => ({
      price: flight.price,
      departureDate: flight.flights[0].departure_airport.time,
      returnDate: flight.flights[flight.flights.length - 1].arrival_airport.time,
      deepLink: `https://www.google.com/travel/flights?q=${encodeURIComponent(`${config.search.origin} to ${config.search.destination}`)}`,
      airline: flight.flights[0].airline || 'Multiple Airlines'
    }));

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
      history: history
    };

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // Check for flights under threshold
    const cheapFlights = flights.filter(f => f.price <= config.search.maxPrice);
    if (cheapFlights.length > 0) {
      await sendNotifications(cheapFlights);
    }

    // Commit and push to gh-pages branch
    const git = simpleGit();
    await git.add([RESULTS_FILE, HISTORY_FILE]);
    await git.commit('Update flight prices and history');
    await git.push('origin', 'gh-pages');

  } catch (error) {
    console.error('Error fetching flights:', error.message);
    process.exit(1);
  }
}

fetchFlights(); 