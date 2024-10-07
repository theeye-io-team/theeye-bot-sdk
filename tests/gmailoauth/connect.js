const { google } = require('googleapis')

const userEmail = process.env.EMAIL

const MailBot = require('../../core/mail/client')

// Cargar las credenciales desde un archivo llamado 'credentials.json' u otro archivo
const { installed } = require('./credentials'); // Asegúrate de que el archivo tenga la estructura correcta

// Configura tus credenciales OAuth2
const clientId = installed.client_id;
const clientSecret = installed.client_secret;
const refreshToken = installed.refresh_token;
const redirectUri = 'urn:ietf:wg:oauth:2.0:oob'; // Esto es para aplicaciones locales

// Crear un cliente OAuth2
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Aquí se debería obtener el refresh_token y guardarlo si no lo tienes aún
async function getAccessToken() {
  oauth2Client.setCredentials({ refresh_token: refreshToken }); // Puedes usar el refresh_token aquí si ya lo tienes
  const { token } = await oauth2Client.getAccessToken();
  return token;
}

// Conectar a Gmail via IMAP usando imap-flow
async function connectToGmail(accessToken) {

  console.log(accessToken)
  
  const client = new MailBot({
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: userEmail,
        accessToken
      }
    },
    folders: {
      INBOX: 'INBOX'
    }
  })

  await client.connect();
  console.log('connected')

  const messages = await client.searchMessages({ from: 'automation@theeye.io' })
  console.log(messages)

  // Cerrar la conexión
  await client.disconnect();
}

getAccessToken().then(connectToGmail).catch(console.error);

