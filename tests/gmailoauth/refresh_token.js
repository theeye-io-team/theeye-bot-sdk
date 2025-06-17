const { google } = require('googleapis');
const http = require('http');
const url = require('url');

// Cargar las credenciales desde el archivo
const { installed } = require(process.env.GOOGLE_APP_CREDENTIALS);

const clientId = installed.client_id;
const clientSecret = installed.client_secret;
const redirectUri = 'http://localhost:4000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Generar la URL de autorización
const scopes = ['https://mail.google.com/', 'https://www.googleapis.com/auth/drive']; // Cambia los scopes según lo que necesites
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Esto es necesario para obtener el refresh_token
  scope: scopes,
});

console.log('Por favor, visita este enlace para autorizar la aplicación:');
console.log(authUrl);

// Create local server to handle the OAuth callback
async function getAuthorizationCode() {
  return new Promise(async (resolve, reject) => {
    // Dynamically import the 'open' package
    const open = (await import('open')).default;
    
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code;
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('Authentication successful! You can close this window.');
          server.close();
          resolve(code);
        }
      } catch (error) {
        reject(error);
      }
    });

    server.listen(4000, () => {
      // Open the authorization URL in the default browser
      open(authUrl);
    });
  });
}

// Replace the readline section with this
async function main() {
  try {
    const code = await getAuthorizationCode();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

