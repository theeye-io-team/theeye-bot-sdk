// error and output handlers must go first.

/**
 * @param {Object}
 * @prop {Mixed} data
 * @prop {Array} components
 * @prop {Object} next
 */
const successOutput = ({ data, components, next }) => {
  // https://documentation.theeye.io/core-concepts/scripts/#passing-arguments-in-workflow
  const output = {
    state: "success",
    data,
    components, // https://documentation.theeye.io/core-concepts/tasks/script_type/#components
    next
  }
  console.log( JSON.stringify(output) )
  process.exit(0)
}

/**
 * @param {Error} err
 */
const failureOutput = (err) => {
  console.error(err)
  const output = {
    state: "failure",
    data: {
      message: err.message,
      code: err.code,
      data: err.data 
    }
  }
  console.error( JSON.stringify(output) )
  process.exit(1)
}

process.on('unhandledRejection', (reason, p) => {
  console.error(reason, 'Unhandled Rejection at Promise', p)
  failureOutput(reason)
})

process.on('uncaughtException', err => {
  console.error(err, 'Uncaught Exception thrown')
  failureOutput(err)
})

/**
 *
 * Sample usage:
 *
 *   const TheEyeBoilerplate = require('boilerplate')
 *   TheEyeBoilerplate.run('./script.js')
 *
 */
class TheEyeBoilerplate {
  constructor (handlerPath) {
    try {
      const handler = require(handlerPath)
      this.handler = handler
    } catch (err) {
      throw new Error(`Handler ${handlerPath} not found`)
    }
  }

  async run (args = undefined) {
    args || (args = process.argv.slice(2))

    // collect handler result
    await this.execute(args)

    // generate the lastline
    this.report()

    return this
  }

  /*
   * @param {Array} args
   * @return {TheEyeBoilerplate}
   */
  async execute (args) {
    try {
      const value = this.handler(args)
      let output
      if (value instanceof Promise) {
        // await promise resolve
        output = await value
      } else {
        output = value
      }

      if (
        output !== undefined &&
        output !== null &&
        output.hasOwnProperty('data')
      ) {
        this.output = output
      } else {
        this.output = { data: output }
      }
    } catch (err) {
      this.err = err
    }

    return this
  }

  report () {
    if (this.err) {
      failureOutput(this.err)
    } else {
      successOutput(this.output)
    }
  }
}

/**
 * @return {Promise}
 */
TheEyeBoilerplate.run = (handlerPath, args) => {
  const theeye = new TheEyeBoilerplate(handlerPath)
  return theeye.run(args)
}

const main = () => {
  const handler = process.argv[2]
  const args = process.argv.slice(3)

  if (process.argv.length === 2) {
    console.log(`Help.
      Invalid arguments length.
      Usage
      node lib/boilerplate "script_path" [...arguments]
      `)

    process.exit(1)
  }

  return TheEyeBoilerplate.run(handler, args)
}

module.exports = TheEyeBoilerplate

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
