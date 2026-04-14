// Test script to verify the profile insights API
const axios = require('axios');

async function testProfileInsights() {
  try {
    // You'll need to get a valid Clerk token from your browser
    const token = 'YOUR_CLERK_TOKEN_HERE';
    
    const response = await axios.get('http://localhost:5000/api/analytics/profile-insights', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testProfileInsights();
