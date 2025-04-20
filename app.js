async function fetchData() {
    try {
        // Get the repository name from the current URL for GitHub Pages
        const repoPath = window.location.pathname.split('/')[1];
        const response = await fetch(`/${repoPath}/price.json`);
        const data = await response.json();
        updateUI(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('flights').innerHTML = `
            <div class="text-red-500 text-center">
                Error loading flight data. Please try again later.
                <br>
                <small class="text-gray-500">${error.message}</small>
            </div>
        `;
    }
}

function formatPriceHistory(history) {
    if (!history || history.length === 0) return '';

    // Get unique flights based on departure and return dates
    const uniqueFlights = new Map();
    history.forEach(entry => {
        entry.flights.forEach(flight => {
            const key = `${flight.departureDate}-${flight.returnDate}`;
            if (!uniqueFlights.has(key)) {
                uniqueFlights.set(key, {
                    departureDate: flight.departureDate,
                    returnDate: flight.returnDate,
                    prices: []
                });
            }
            uniqueFlights.get(key).prices.push({
                timestamp: entry.timestamp,
                price: flight.price
            });
        });
    });

    return Array.from(uniqueFlights.values()).map(flight => `
        <div class="border rounded-lg p-4 mb-4">
            <div class="text-lg font-semibold mb-2">
                ${new Date(flight.departureDate).toLocaleDateString()} → 
                ${new Date(flight.returnDate).toLocaleDateString()}
            </div>
            <div class="h-32">
                <canvas class="price-chart" 
                    data-prices='${JSON.stringify(flight.prices.map(p => p.price))}'
                    data-labels='${JSON.stringify(flight.prices.map(p => new Date(p.timestamp).toLocaleDateString()))}'>
                </canvas>
            </div>
        </div>
    `).join('');
}

function updateUI(data) {
    // Update last checked time
    const lastChecked = new Date(data.lastChecked);
    document.getElementById('lastChecked').textContent = 
        `Last checked: ${lastChecked.toLocaleString()}`;

    // Update configuration display
    const configHtml = data.config.searches.map((search, index) => `
        <div class="border p-4 rounded-lg">
            <h3 class="font-medium mb-2">Route ${index + 1}</h3>
            <div class="config-item">
                <span class="font-medium">Route:</span>
                ${search.origin} → ${search.destination}
            </div>
            <div class="config-item">
                <span class="font-medium">Departure:</span>
                ${search.departureDateRange.start} to ${search.departureDateRange.end}
            </div>
            <div class="config-item">
                <span class="font-medium">Return:</span>
                ${search.returnDateRange.start} to ${search.returnDateRange.end}
            </div>
        </div>
    `).join('') + `
        <div class="border p-4 rounded-lg">
            <h3 class="font-medium mb-2">General Settings</h3>
            <div class="config-item">
                <span class="font-medium">Max Price:</span>
                ${data.currency} ${data.config.maxPrice}
            </div>
            <div class="config-item">
                <span class="font-medium">Passengers:</span>
                ${data.config.passengers}
            </div>
            <div class="config-item">
                <span class="font-medium">Currency:</span>
                ${data.currency}
            </div>
        </div>
    `;
    document.getElementById('config').innerHTML = configHtml;

    // Update flights display
    if (data.flights.length === 0) {
        document.getElementById('flights').innerHTML = `
            <div class="text-center text-gray-500">
                No flights found matching your criteria.
            </div>
        `;
        return;
    }

    const flightsHtml = data.flights.map(flight => `
        <div class="border rounded-lg p-4 hover:shadow-lg transition-shadow">
            <div class="flex justify-between items-center mb-2">
                <span class="text-2xl font-bold text-blue-600">${data.currency} ${flight.price}</span>
                <span class="text-sm text-gray-600">${flight.airline}</span>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div class="text-sm text-gray-500">Departure</div>
                    <div>${new Date(flight.departureDate).toLocaleDateString()}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">Return</div>
                    <div>${new Date(flight.returnDate).toLocaleDateString()}</div>
                </div>
            </div>
            <a href="${flight.deepLink}" 
               target="_blank" 
               rel="noopener noreferrer"
               class="block w-full text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
                Book Now
            </a>
        </div>
    `).join('');

    document.getElementById('flights').innerHTML = flightsHtml;

    // Add price history section
    const historyHtml = `
        <div class="mt-8">
            <h2 class="text-xl font-semibold mb-4">Price History</h2>
            ${formatPriceHistory(data.history)}
        </div>
    `;
    document.getElementById('flights').insertAdjacentHTML('beforeend', historyHtml);

    // Initialize charts
    document.querySelectorAll('.price-chart').forEach(canvas => {
        const ctx = canvas.getContext('2d');
        const prices = JSON.parse(canvas.dataset.prices);
        const labels = JSON.parse(canvas.dataset.labels);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Price (${data.currency})`,
                    data: prices,
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    });
}

// Initial load
fetchData();

// Refresh every 5 minutes
setInterval(fetchData, 5 * 60 * 1000); 