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

async function updateSearchSettings(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('github_token');
    if (!token) {
        showError('No token found. Please enter your GitHub token.');
        return;
    }

    const formData = new FormData(event.target);
    
    const route1 = {
        origin: formData.get('route1_origin'),
        destination: formData.get('route1_dest')
    };
    
    const route2 = {
        origin: formData.get('route2_origin'),
        destination: formData.get('route2_dest')
    };

    try {
        console.log('Updating settings with token:', token.substring(0, 4) + '...');
        console.log('Repository:', `${owner}/${repo}`);

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy.yml/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    route1: JSON.stringify(route1),
                    route2: JSON.stringify(route2),
                    departure_date_start: formData.get('departure_date_start'),
                    departure_date_end: formData.get('departure_date_end'),
                    return_date_start: formData.get('return_date_start'),
                    return_date_end: formData.get('return_date_end'),
                    max_price: formData.get('max_price')
                }
            })
        });

        if (response.ok) {
            alert('Search settings updated! The new results will be available in a few minutes.');
        } else {
            const errorData = await response.text();
            console.error('GitHub API Error:', errorData);
            throw new Error(`Failed to update settings: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        
        // Remove any existing error message
        const existingError = document.querySelector('.settings-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Show a more helpful error message with instructions
        const errorMessage = document.createElement('div');
        errorMessage.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded settings-error';
        errorMessage.innerHTML = `
            <p class="font-bold">Failed to update settings</p>
            <p class="text-sm">To update settings, please:</p>
            <ol class="text-sm list-decimal list-inside">
                <li>Go to <a href="https://github.com/settings/tokens" target="_blank" class="underline">GitHub Personal Access Tokens</a></li>
                <li>Generate a new token with 'workflow' permissions</li>
                <li>Copy the token and paste it below:</li>
            </ol>
            <input type="text" id="github_token" class="mt-2 w-full p-2 border rounded" placeholder="ghp_...">
            <button onclick="saveToken()" class="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Save Token</button>
            <p class="text-xs mt-2">Current token: ${localStorage.getItem('github_token') ? '(token exists)' : '(no token)'}</p>
        `;
        document.body.appendChild(errorMessage);
    }
}

// Add the saveToken function to the window object
window.saveToken = function() {
    const tokenInput = document.getElementById('github_token');
    const token = tokenInput.value.trim();
    
    if (token) {
        // Save token to localStorage
        localStorage.setItem('github_token', token);
        console.log('Token saved:', token.substring(0, 4) + '...');
        
        // Remove any existing messages
        document.querySelectorAll('.settings-error, .settings-success').forEach(el => el.remove());
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded settings-success';
        successMessage.innerHTML = `
            <p>Token saved successfully!</p>
            <p class="text-sm">Updating settings...</p>
        `;
        document.body.appendChild(successMessage);
        
        // Wait for localStorage to be updated
        setTimeout(() => {
            // Verify token was saved
            const savedToken = localStorage.getItem('github_token');
            if (savedToken === token) {
                // Token was saved successfully, try to update settings
                const searchForm = document.getElementById('searchForm');
                if (searchForm) {
                    try {
                        const submitEvent = new Event('submit', {
                            bubbles: true,
                            cancelable: true
                        });
                        searchForm.dispatchEvent(submitEvent);
                    } catch (error) {
                        console.error('Error submitting form:', error);
                        showError('Failed to update settings. Please try again.');
                    }
                }
            } else {
                showError('Failed to save token. Please try again.');
            }
            
            // Remove success message after 3 seconds
            setTimeout(() => {
                const msg = document.querySelector('.settings-success');
                if (msg) msg.remove();
            }, 3000);
        }, 1000);
    }
};

function showError(message) {
    // Remove any existing error messages
    document.querySelectorAll('.settings-error').forEach(el => el.remove());
    
    // Show new error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded settings-error';
    errorMessage.innerHTML = `
        <p class="font-bold">Error</p>
        <p class="text-sm">${message}</p>
    `;
    document.body.appendChild(errorMessage);
    
    // Remove error message after 5 seconds
    setTimeout(() => {
        errorMessage.remove();
    }, 5000);
}

// Add token verification on page load
window.addEventListener('load', function() {
    const token = localStorage.getItem('github_token');
    if (token) {
        console.log('Token found on load:', token.substring(0, 4) + '...');
    }
});

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
    if (!data.flights || data.flights.length === 0) {
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
                <span class="text-2xl font-bold ${flight.price <= data.config.maxPrice ? 'text-green-600' : 'text-blue-600'}">
                    ${data.currency} ${flight.price}
                    ${flight.price <= data.config.maxPrice ? 
                        '<span class="text-sm font-normal text-green-600">✓ Below alert price!</span>' : 
                        ''}
                </span>
                <span class="text-sm text-gray-600">${flight.airline}</span>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div class="text-sm text-gray-500">Route</div>
                    <div class="font-medium">${flight.origin} → ${flight.destination}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">Airline</div>
                    <div>${flight.airline || 'Multiple Airlines'}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">Departure</div>
                    <div>${new Date(flight.departureDate).toLocaleDateString()}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">Return</div>
                    <div>${new Date(flight.returnDate).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="text-sm text-gray-600 mb-4">
                Found on: ${flight.source || 'Google Flights'}
            </div>
            <a href="${flight.deepLink}" 
               target="_blank" 
               rel="noopener noreferrer"
               class="block w-full text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
                Book on ${flight.source || 'Google Flights'}
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

// Set up form submission handler
document.getElementById('searchForm').addEventListener('submit', updateSearchSettings);

// Initial load
fetchData();

// Refresh every 5 minutes
setInterval(fetchData, 5 * 60 * 1000); 