const express = require('express');
const { google } = require('googleapis');

const app = express();
const PORT = 3000;

// Replace these with your actual keys from Google Cloud
const CLIENT_ID = "213358032982-0upp3v5q13bjgg705s848tmnrdmmn6fu.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "http://localhost:3000/auth/google/callback";

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Route 1: Home page with Search Bar
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: Arial; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1>Email Keyword Search</h1>
            <p>Search your Gmail inbox for specific keywords.</p>
            
            <form action="/auth/google" method="GET">
                <input type="text" name="q" placeholder="Enter keyword (e.g. Placement)" required 
                       style="padding: 10px; width: 70%; border-radius: 5px; border: 1px solid #ccc;">
                <button type="submit" style="padding: 10px 20px; background: #4285F4; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Search Gmail
                </button>
            </form>
        </div>
    `);
});

// Route 2: Redirects to Google with the search query saved in the state
app.get('/auth/google', (req, res) => {
    const searchQuery = req.query.q;
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
        state: searchQuery
    });
    res.redirect(url);
});

// Route 3: Callback handler
app.get('/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        // Clean redirect to the analyze page
        res.redirect('/analyze?q=' + state);
    } catch (error) {
        console.error("Auth Error", error);
        res.send("Authentication failed.");
    }
});

// Route 4: Final Results Page
app.get('/analyze', async (req, res) => {
    const searchQuery = req.query.q || 'Important';
    
    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: searchQuery,
            maxResults: 5 
        });

        const messages = response.data.messages;
        
        let htmlOutput = `
            <div style="font-family: Arial; max-width: 800px; margin: 20px auto;">
                <h2>Search Results for: "${searchQuery}"</h2>
                <a href="/">← Search again</a><hr>`;

        if (!messages || messages.length === 0) {
            htmlOutput += `<p>No emails found for this keyword.</p>`;
        } else {
            htmlOutput += `<ul>`;
            for (let message of messages) {
                const msgData = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'Date']
                });

                const headers = msgData.data.payload.headers;
                let subject = 'No Subject';
                let from = 'Unknown';
                let date = 'Unknown';

                headers.forEach(h => {
                    if (h.name === 'Subject') subject = h.value;
                    if (h.name === 'From') from = h.value;
                    if (h.name === 'Date') date = h.value;
                });

                htmlOutput += `
                    <li style="margin-bottom: 15px; padding: 15px; border-radius: 8px; background: #f9f9f9; border: 1px solid #ddd; list-style: none;">
                        <strong>Subject:</strong> ${subject} <br>
                        <strong>From:</strong> ${from} <br>
                        <small style="color: #666;">${date}</small>
                    </li>`;
            }
            htmlOutput += `</ul>`;
        }

        htmlOutput += `</div>`;
        res.send(htmlOutput);

    } catch (error) {
        console.error("API Error", error);
        res.send("Failed to fetch emails. Please try searching again.");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});