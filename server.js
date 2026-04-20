const express = require('express');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// These will be pulled from Render's secret settings later
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://gmail-analyzer-1-mqcc.onrender.com/auth/google/callback";
const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center; border: 1px solid #eee; padding: 30px; border-radius: 10px;">
            <h1 style="color: #4285F4;">Gmail Keyword Search</h1>
            <form action="/auth/google" method="GET">
                <input type="text" name="q" placeholder="Enter keyword" required style="padding: 12px; width: 70%;">
                <button type="submit" style="padding: 12px 20px; background: #4285F4; color: white; border: none; cursor: pointer;">Search Gmail</button>
            </form>
        </div>
    `);
});

app.get('/auth/google', (req, res) => {
    const searchQuery = req.query.q;
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
        state: searchQuery
    });
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        res.redirect('/analyze?q=' + state);
    } catch (error) {
        res.send("Authentication failed.");
    }
});

app.get('/analyze', async (req, res) => {
    const searchQuery = req.query.q || 'Important';
    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const response = await gmail.users.messages.list({ userId: 'me', q: searchQuery, maxResults: 5 });
        const messages = response.data.messages;
        let htmlOutput = `<div style="font-family: Arial; max-width: 800px; margin: 20px auto;"><h2>Results: "${searchQuery}"</h2><a href="/">← Back</a><hr>`;
        if (!messages) {
            htmlOutput += "<p>No emails found.</p>";
        } else {
            for (let message of messages) {
                const msgData = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
                const headers = msgData.data.payload.headers;
                let subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                let from = headers.find(h => h.name === 'From')?.value || 'Unknown';
                let date = headers.find(h => h.name === 'Date')?.value || 'Unknown';
                htmlOutput += `<div style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${subject}</strong><br><small>${from} | ${date}</small></div>`;
            }
        }
        res.send(htmlOutput + "</div>");
    } catch (error) {
        res.send("Error fetching data.");
    }
});

app.listen(PORT, () => { console.log("Server live..."); });
