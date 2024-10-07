
const { google } = require('googleapis');

const redirectUri = 'urn:ietf:wg:oauth:2.0:oob'; // Esto es para aplicaciones locales

module.exports = async function getAccessToken (config) {
  const {
    clientId,
    clientSecret,
    refreshToken,
    //redirectUri,
  } = config

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  oauth2Client.setCredentials({ refresh_token: refreshToken }) // Puedes usar el refresh_token aquí si ya lo tienes
  const { token } = await oauth2Client.getAccessToken()
  return token
}

