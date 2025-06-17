/**
 * @param {Array} data
 */
const successOutput = ({ data, components, next }) => {
  let output = { state: "success", data, components, next }
  console.log(JSON.stringify(output)) 
  process.exit()
}

/**
 * @param {Error} err
 */
const failureOutput = (err) => {
  console.error(err)
  
  let output = {
    state: "failure",
    data: {
      message: err.message,
      code: err.code,
      data: err.data 
    }
  }
  console.error(JSON.stringify(output))
  process.exit()
}

process.on('unhandledRejection', (reason, p) => {
  console.error(reason, 'Unhandled Rejection at Promise', p)
  failureOutput(reason)
})

process.on('uncaughtException', err => {
  console.error(err, 'Uncaught Exception thrown')
  failureOutput(err)
})

if (process.env.REDIRECT_CONSOLE_OUTPUT) {
  console = (function(){
    const logDump = console.log
    const errorDump = console.error
    const writeToFile = function (logLevel) {
      return function (msg) {
        logDump(msg)
        try {
          let logName = `${unitF}:\\facturas\\logs\\${path.parse(filenameArg).name}.log`
          fs.appendFile(logName, `${logLevel}:${JSON.stringify(msg)}\n`, (e) => {
            if (e) {
              logDump('error: ' + e)
              process.exit(1)
            }
          })
        } catch (e) {
          errorDump('cannot write to file', e)
          process.exit(1)
        }
      }
    }
    console = {}
    console.log = writeToFile('log')
    console.error = writeToFile('error')
    return console
  })()
}

class BotJob {
  constructor (job) {
    // parse parameters.
    // connection, keys, directories, parameters, etc
    this.job = job
  }

  initialize () {
    // nothing yet
  }

  /**
   * @return {Promise}
   */
  async main (parameters) {
    throw new Error('HELP: Extend BotTask Class and implement this method')
  }

  async run () {
    try {
      const parameters = process.argv.slice(2)

      const output = await this.main( parameters )
      return successOutput(output)
    } catch (e) {
      return failureOutput(e)
    }
  }
}

module.exports = BotJob
