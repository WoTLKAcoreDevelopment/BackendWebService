const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');
const mysql = require('mysql2/promise'); // Use mysql2 for async/await support
const jwt = require('jsonwebtoken'); // For JWT token generation
const app = express();
require('dotenv').config();

const port = process.env.PORT || 3001; // Ensure PORT is set in .env file or fallback to 3000
const discordWebHookUrl = process.env.DISCORD_WEBHOOK_URL; // Make sure to use the correct environment variable name
const dbConfig = {
    host: 'localhost',
    user: 'root', // Your MySQL username
    password: 'root', // Your MySQL password
    database: 'acore_auth', // Database name
};

// Middleware setup
app.use(bodyParser.json());
app.use(cors());

// Function to store email in the database
async function storeEmail(username, email) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        await connection.execute(
            `UPDATE account SET reg_mail = ? WHERE username = ?`,
            [email, username]
        );
        console.log(`Email updated for username: ${username}`);
    } catch (error) {
        console.error('Error updating email in the database:', error.message);
    } finally {
        await connection.end();
    }
}

// Function to verify the username and email (for sign-in)
async function verifyCredentials(username, email) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await connection.execute(
            'SELECT * FROM account WHERE username = ? AND reg_mail = ?',
            [username, email]
        );
        console.log('Database query result:', rows); // Log database query result for debugging

        if (rows.length === 0) {
            return { success: false, message: 'Invalid username or email' };
        }

        return { success: true, user: rows[0] };
    } catch (error) {
        console.error('Error verifying credentials:', error.message);
        return { success: false, message: 'Internal server error' };
    } finally {
        await connection.end();
    }
}

// Sign-in endpoint
app.post('/api/signin', async (req, res) => {
    console.log('Sign-in endpoint hit');  // Log when the sign-in endpoint is hit
    const { username, email } = req.body;

    if (!username || !email) {
        return res.status(400).json({ success: false, message: 'Username and email are required' });
    }

    // Verify the credentials
    const result = await verifyCredentials(username, email);

    if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
    }

    // If credentials are valid, generate a JWT token

    res.status(200).json({
        success: true,
        message: 'Sign-in successful',
    });
});

// Register endpoint (with SOAP call)
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ success: false, message: 'Username, password, and email are required' });
    }

    // Construct the GM command
    const command = `account create ${username} ${password}`;

    // SOAP Request XML
    const xmlRequest = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:AC">
       <soapenv:Header/>
       <soapenv:Body>
          <urn:executeCommand>
             <command>${command}</command>
             <username>master</username>
             <password>master</password>
          </urn:executeCommand>
       </soapenv:Body>
    </soapenv:Envelope>
    `;

    // SOAP API request options
    const options = {
        hostname: '127.0.0.1',
        port: 7878,
        path: '/',
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml',
            'Content-Length': Buffer.byteLength(xmlRequest),
            'Authorization': 'Basic ' + Buffer.from('test:test').toString('base64'),
        },
    };

    // Send SOAP request to AzerothCore
    const soapReq = http.request(options, (soapRes) => {
        let data = '';

        soapRes.on('data', (chunk) => {
            data += chunk;
        });

        soapRes.on('end', async () => {
            xml2js.parseString(data, { explicitArray: false }, async (err, result) => {
                if (err) {
                    console.error('Error parsing SOAP response:', err.message);
                    res.status(500).json({ success: false, message: 'Internal server error' });

                    // Send error to Discord WebHook
                    await axios.post(discordWebHookUrl, {
                        content: `Error parsing SOAP response: ${err.message}\nEmail: ${email}`,
                    });

                    return;
                }

                const resultMessage = result?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body']?.['ns1:executeCommandResponse']?.result;
                if (resultMessage && resultMessage.includes('Account created:')) {
                    await storeEmail(username, email); // Store the email
                    res.status(200).json({ success: true, message: `Account created: ${resultMessage.trim()}` });
                } else {
                    const fault = result?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body']?.['SOAP-ENV:Fault'];
                    let message = 'Unknown error occurred';
                    if (fault) {
                        message = fault.detail || fault.faultstring || 'An error occurred';
                    }
                    res.status(400).json({ success: false, message });
                }

                // Send the entire parsed response to Discord WebHook
                const formattedResponse = `**SOAP Response**\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n**Email:** ${email}`;
                await axios.post(discordWebHookUrl, { content: formattedResponse });
            });
        });
    });

    soapReq.on('error', async (e) => {
        console.error('Error executing SOAP command:', e.message);
        res.status(500).json({ success: false, message: 'Internal server error' });

        const formattedError = `**Error executing SOAP command**\n\`\`\`\n${e.message}\n\`\`\`\n**Email:** ${email}`;
        await axios.post(discordWebHookUrl, { content: formattedError });
    });

    soapReq.write(xmlRequest);
    soapReq.end();
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
