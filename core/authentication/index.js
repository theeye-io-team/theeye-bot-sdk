const msxoauth2token = require('./msxoauth2token')
const googlexoauth2token = require('./googlexoauth2token')

module.exports = async (auth) => {

  const { user, pass, accessToken } = auth

  if (!user) {
    throw new Error('auth.user email is required')
  }

  if (pass) { return { user, pass } }
  if (accessToken) { return { user, accessToken } }

  if (auth.msxoauth) {
    const token = await msxoauth2token(auth.msxoauth)
      .catch(err => err)

    if (token instanceof Error) {
      throw new Error('msxoauth oauth failed')
    }

    return { user, accessToken: token }
  }

  if (auth.googlexoauth) {
    const token = await googlexoauth2token(auth.googlexoauth)
      .catch(err => err)

    if (token instanceof Error) {
      if (token.response) {
        console.error(token.response)
      }
      throw new Error('googlexoauth oauth failed')
    }

    // the token expires in 1 hour
    return { user, accessToken: token }
  }

  throw new Error('incorrect authentication credentials configuration')
}

