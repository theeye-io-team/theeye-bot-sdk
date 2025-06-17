const { google } = require('googleapis');

// Cargar las credenciales desde un archivo llamado 'credentials.json' u otro archivo
const { installed } = require(process.env.GOOGLE_APP_CREDENTIALS); // Estas credenciales se obtienen en google cloud console
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

// Configura tus credenciales OAuth2
const clientId = installed.client_id;
const clientSecret = installed.client_secret;
const redirectUri = 'urn:ietf:wg:oauth:2.0:oob'; // Esto es para aplicaciones locales

// Crear un cliente OAuth2
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Aquí se debería obtener el refresh_token y guardarlo si no lo tienes aún
async function getAccessToken() {
  oauth2Client.setCredentials({ refresh_token: refreshToken }); // Puedes usar el refresh_token aquí si ya lo tienes
  const { token } = await oauth2Client.getAccessToken();
  return token;
}

getAccessToken().then(console.log).catch(console.error);

