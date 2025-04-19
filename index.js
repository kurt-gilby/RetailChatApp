const express = require('express');
const axios = require('axios');
const { BotFrameworkAdapter } = require('botbuilder');

if (!process.env.QNA_KEY) {
  require('dotenv').config();
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ENV Vars
const endpoint = process.env.QNA_ENDPOINT?.trim();
const projectName = process.env.QNA_PROJECT_NAME?.trim();
const deploymentName = process.env.QNA_DEPLOYMENT_NAME?.trim();
const apiKey = process.env.QNA_KEY?.trim();
const predictionUrl = `${endpoint}language/:query-knowledgebases?projectName=${projectName}&api-version=2021-10-01&deploymentName=${deploymentName}`;


// Check for required environment variables
// Bot adapter
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID?.trim(),
  appPassword: process.env.MICROSOFT_APP_PASSWORD?.trim(),
});

adapter.onTurnError = async (context, error) => {
  console.error(`[onTurnError] unhandled error: ${error}`);
  await context.sendActivity("Oops! Something went wrong.");
};

// Activity handler
const handleActivity = async (context) => {
  console.log("handleActivity triggered");
  if (context.activity.type === 'message') {
    const userMessage = context.activity.text;
    console.log("User said:", userMessage); // 🔍 LOG THIS

    try {
      const response = await axios.post(
        predictionUrl,
        {
          top: 3,
          question: userMessage,
          includeUnstructuredSources: false
        },
        {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("QnA API responded with:", response.data.answers); // 🔍 LOG THIS

      const answer = response.data.answers?.[0]?.answer || "No good answer found.";
      await context.sendActivity(answer);

    } catch (error) {
      console.error("QnA Error:", error.response?.data || error.message);
      await context.sendActivity("Sorry, something went wrong.");
    }
  }
};

// 🔁 Connect Direct Line & Web Chat
app.post('/api/messages', (req, res) => {
  console.log("Incoming POST /api/messages");  
  adapter.processActivity(req, res, async (context) => {
    await handleActivity(context);
  });
});

// 🔐 Token generation for Web Chat
app.get('/directline/token', async (req, res) => {
  try {
    const response = await axios.post(
      'https://directline.botframework.com/v3/directline/tokens/generate',
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.DIRECTLINE_SECRET}`
        }
      }
    );
    res.send(response.data);
  } catch (err) {
    console.error('Token generation failed', err);
    res.status(500).send('Failed to generate token');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`QnA bot is running on http://localhost:${port}`));
