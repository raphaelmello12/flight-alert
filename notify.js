const twilio = require('twilio');
const config = require('./config.json');

const twilioClient = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function formatFlightMessage(flights) {
  const currencySymbol = config.currency === 'USD' ? '$' : 
                        config.currency === 'EUR' ? '€' : 
                        config.currency === 'GBP' ? '£' : 
                        config.currency === 'BRL' ? 'R$' : 
                        config.currency;
  
  return flights.map(flight => `
    Price: ${currencySymbol}${flight.price}
    Departure: ${new Date(flight.departureDate).toLocaleDateString()}
    Return: ${new Date(flight.returnDate).toLocaleDateString()}
    Airline: ${flight.airline}
    Book here: ${flight.deepLink}
  `).join('\n\n');
}

async function sendNotifications(flights) {
  const message = `Found ${flights.length} flight(s) under your target price!\n\n${formatFlightMessage(flights)}`;
  
  try {
    await twilioClient.messages.create({
      body: message,
      to: config.notifications.phone,
      from: process.env.TWILIO_PHONE_NUMBER
    });
  } catch (error) {
    console.error('Error sending SMS:', error.message);
  }
}

module.exports = { sendNotifications }; 