
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
    return this.toObject()
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
  constructor (message, details) {
    super(message)
    this.details = details
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
}
ErrorHandler.ExtendedError = ExtendedError

/**********************************************************
 *
 * Sample extended error usage
 *
 **********************************************************/
class ValidationError extends ExtendedError {
  constructor (message) {
    super('Validation Error', message)
    this.code = 'ERRVAL'
    this.statusCode = this.status = 403
  }
}
ErrorHandler.ValidationError = ValidationError

