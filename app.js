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

// Populate day selectors on page load
function populateDaySelectors() {
    // Populate departure days (1-21 January)
    const departureSelect = document.querySelector('select[name="departure_day"]');
    if (departureSelect) {
        for (let day = 1; day <= 21; day++) {
            const option = document.createElement('option');
            option.value = day.toString().padStart(2, '0');
            option.textContent = `January ${day}`;
            departureSelect.appendChild(option);
        }
    }

    // Populate return days (15 January - 4 February)
    const returnSelect = document.querySelector('select[name="return_day"]');
    if (returnSelect) {
        for (let day = 15; day <= 31; day++) {
            const option = document.createElement('option');
            option.value = day.toString().padStart(2, '0');
            option.textContent = `January ${day}`;
            returnSelect.appendChild(option);
        }
        // Add February days
        for (let day = 1; day <= 4; day++) {
            const option = document.createElement('option');
            option.value = (day + 31).toString().padStart(2, '0'); // 32-35 for Feb 1-4
            option.textContent = `February ${day}`;
            returnSelect.appendChild(option);
        }
    }
}

// Check for token on page load
window.addEventListener('load', function() {
    populateDaySelectors();
    const token = localStorage.getItem('github_token');
    if (!token) {
        showTokenInput();
    }
});

function showTokenInput() {
    // Remove any existing token input
    const existingToken = document.querySelector('.token-input');
    if (existingToken) {
        existingToken.remove();
    }

    const tokenDiv = document.createElement('div');
    tokenDiv.className = 'fixed top-4 right-4 bg-white border border-gray-300 p-4 rounded shadow-lg token-input';
    tokenDiv.innerHTML = `
        <p class="font-bold mb-2">GitHub Token Required</p>
        <p class="text-sm mb-4">To update settings, please:</p>
        <ol class="text-sm list-decimal list-inside mb-4">
            <li>Go to <a href="https://github.com/settings/tokens" target="_blank" class="text-blue-600 underline">GitHub Personal Access Tokens</a></li>
            <li>Generate a new token with 'workflow' permissions</li>
            <li>Copy the token and paste it below:</li>
        </ol>
        <input type="text" id="github_token" class="w-full p-2 border rounded mb-2" placeholder="ghp_...">
        <button onclick="saveToken()" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Token</button>
    `;
    document.body.appendChild(tokenDiv);
}

window.saveToken = function() {
    const tokenInput = document.getElementById('github_token');
    const token = tokenInput.value.trim();
    
    if (!token) {
        showError('Please enter a valid token');
        return;
    }

    if (!token.startsWith('ghp_')) {
        showError('Invalid token format. Token should start with "ghp_"');
        return;
    }

    localStorage.setItem('github_token', token);
    console.log('Token saved:', token.substring(0, 4) + '...');
    
    // Remove token input
    const tokenDiv = document.querySelector('.token-input');
    if (tokenDiv) {
        tokenDiv.remove();
    }

    // Show success message
    const successMessage = document.createElement('div');
    successMessage.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded settings-success';
    successMessage.innerHTML = `
        <p>Token saved successfully!</p>
        <p class="text-sm">You can now update your search settings.</p>
    `;
    document.body.appendChild(successMessage);
    
    setTimeout(() => {
        successMessage.remove();
    }, 3000);
};

async function updateSearchSettings(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('github_token');
    if (!token) {
        showTokenInput();
        return;
    }

    const formData = new FormData(event.target);
    const departureDay = formData.get('departure_day');
    const returnDay = formData.get('return_day');
    
    if (!departureDay || !returnDay) {
        showError('Please select both departure and return days');
        return;
    }

    // Convert return day value for February dates
    let returnDate;
    if (parseInt(returnDay) > 31) {
        // It's a February date
        const febDay = parseInt(returnDay) - 31;
        returnDate = `2026-02-${febDay.toString().padStart(2, '0')}`;
    } else {
        returnDate = `2026-01-${returnDay}`;
    }

    // Fixed routes
    const route1 = {
        origin: "GRU",
        destination: "OPO"
    };
    
    const route2 = {
        origin: "GRU",
        destination: "LIS"
    };

    try {
        const owner = 'raphaelmello12';
        const repo = 'flight-alert';

        console.log('Updating settings with token:', token.substring(0, 4) + '...');
        console.log('Repository:', `${owner}/${repo}`);

        const departureDate = `2026-01-${departureDay}`;

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
                    departure_date_start: departureDate,
                    departure_date_end: departureDate,
                    return_date_start: returnDate,
                    return_date_end: returnDate,
                    max_price: formData.get('max_price')
                }
            })
        });

        if (response.ok) {
            const successMessage = document.createElement('div');
            successMessage.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded';
            successMessage.innerHTML = `
                <p>Settings updated successfully!</p>
                <p class="text-sm">The new results will be available in a few minutes.</p>
            `;
            document.body.appendChild(successMessage);
            
            setTimeout(() => {
                successMessage.remove();
            }, 3000);
        } else {
            if (response.status === 403) {
                localStorage.removeItem('github_token');
                showTokenInput();
                throw new Error('Token invalid or expired. Please enter a new token.');
            } else {
                const errorData = await response.text();
                console.error('GitHub API Error:', errorData);
                throw new Error(`Failed to update settings: ${response.status} ${response.statusText}`);
            }
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        showError(error.message || 'Failed to update settings. Please try again.');
        
        if (error.message.includes('Token invalid') || error.status === 403) {
            localStorage.removeItem('github_token');
            showTokenInput();
        }
    }
}

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
                <span class="text-sm text-gray-600">${flight.airline || 'Multiple Airlines'}</span>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div class="text-sm text-gray-500">Route</div>
                    <div class="font-medium">
                        ${flight.destination === 'OPO' ? 'GRU → Porto (OPO)' : 
                          flight.destination === 'LIS' ? 'GRU → Lisboa (LIS)' : 
                          `${flight.origin || 'GRU'} → ${flight.destination}`}
                    </div>
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

// Add form submission handler
document.getElementById('searchForm').addEventListener('submit', updateSearchSettings);

// Initial data load
fetchData(); 