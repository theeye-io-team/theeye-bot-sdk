
Error.prototype.toJSON = function () {
  var alt = {};
  var storeKey = function(key) {
    alt[key] = this[key];
  };
  Object.getOwnPropertyNames(this)
    .forEach(storeKey, this);
  return alt;
};

class ErrorHandler {
  constructor () {
    this.errors = []
  }

  required (name, value, message) {
    var e = new ExtendedError(name + ' is required')
    e.statusCode = 400
    e.field = name
    e.value = value
    e.code = 'EREQ'
    e.message = message
    this.errors.push( e )
    return this
  }

  invalid (name, value, message) {
    var e = new ExtendedError(name + ' is invalid')
    e.statusCode = 400
    e.field = name
    e.value = value
    e.code = 'EVALID'
    e.message = message
    this.errors.push( e )
    return this
  }

  /**
   *
   * turn object into Array.
   * Array knows how turn it self into string
   *
   */
  toObject () {
    var e = []
    for (var i=0; i<this.errors.length; i++) {
      var err = this.errors[i]
      delete err.stack
      e.push(err)
    }
    return e
  }

  toString () {
    return JSON.stringify(this.toJSON())
  }

  toJSON () {
    return this.toString()
  }

  toHtml () {
    var e = []
    for (var i=0; i<this.errors.length; i++) {
      e.push( htmlErrorLine( this.errors[i] ) )
    }
    return e.join('<br/>')
  }

  hasErrors () {
    return this.errors.length > 0
  }
}

ErrorHandler.Factory = function (definition) {
  const { message , code, name, stack } = definition
  let err
  if (ErrorHandler[name]) {
    err = new ErrorHandler[name](message)
  } else {
    err = new Error(message)
  }
  err.code = code
  err.name = name
  err.stack = stack
  return err
}

module.exports = ErrorHandler

const htmlErrorLine = (error) => {
  let dump = error.toJSON()
  let html = `<h2>Exception</h2><pre>${dump.stack}</pre>`

  delete dump.stack
  delete dump.message

  for (let prop in dump) {
    html += `<p><h3>${prop}</h3> ${JSON.stringify(dump[prop])}</p>`
  }

  return html
}

class ExtendedError extends Error {
  constructor (message, options) {
    super(message)
    Object.assign(this, options)
    this.name = this.constructor.name
  }

  toObject () {
    let alt = {}
    let storeKey = function (key) {
      if (key === 'stack') {
        if (process.env.NODE_ENV !== 'production') {
          alt[key] = this[key]
        }
      } else {
        alt[key] = this[key]
      }
    }
    Object.getOwnPropertyNames(this).forEach(storeKey, this)
    return alt
  }

  toJSON () {
    return this.toObject()
  }

  toString () {
    return JSON.stringify(this.toJSON())
  }
}

/**********************************************************/

class ClientError extends ExtendedError {
  constructor (message, options) {
    options||(options={})
    super(message || 'Invalid Request', options)
    this.name = this.constructor.name
    this.code = options.code || ''
    this.status = options.statusCode || 400
    this.statusCode = this.status
  }
}

class ServerError extends ExtendedError {
  constructor (message, options) {
    options||(options={})
    super(message || 'Internal Server Error', options)
    this.name = this.constructor.name
    this.code = options.code || ''
    this.status = options.statusCode || 500
    this.statusCode = this.status
  }
}

class ValidationError extends ExtendedError {
  constructor (message, options) {
    options||(options={})
    super(message || 'Validation Error', options)
    this.name = this.constructor.name
    this.code = options.code || ''
    this.status = options.statusCode || 400
    this.statusCode = this.status
  }
}

ErrorHandler.ExtendedError = ExtendedError

ErrorHandler.ClientError = ClientError

ErrorHandler.ServerError = ServerError

ErrorHandler.ValidationError = ValidationError

/**********************************************************/
