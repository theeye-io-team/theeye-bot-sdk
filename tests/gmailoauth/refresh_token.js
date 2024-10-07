
const { google } = require('googleapis');
const readline = require('readline');

// Cargar las credenciales desde el archivo
const { installed } = require('./credentials');

const clientId = installed.client_id;
const clientSecret = installed.client_secret;
const redirectUri = installed.redirect_uris[0]; // Normalmente 'urn:ietf:wg:oauth:2.0:oob'

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Generar la URL de autorización
const scopes = ['https://mail.google.com/']; // Cambia los scopes según lo que necesites
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Esto es necesario para obtener el refresh_token
  scope: scopes,
});

console.log('Por favor, visita este enlace para autorizar la aplicación:');
console.log(authUrl);

// Abrir el navegador automáticamente (opcional)
// Usar readline para leer el código de autorización
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Introduce el código de autorización: ', async (code) => {
  rl.close();
  // Intercambiar el código de autorización por tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  console.log('Access Token:', tokens.access_token);
  console.log('Refresh Token:', tokens.refresh_token); // Aquí obtienes el refresh token
});

