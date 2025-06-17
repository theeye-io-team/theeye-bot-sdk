const { createHandler, executeHandler } = require('./index')
const assert = require('assert')

// Mock console methods to capture output
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalProcessExit = process.exit

describe('Boilerplate Tests', () => {
  let consoleOutput = []
  let consoleErrors = []
  let exitCode = null

  beforeEach(() => {
    consoleOutput = []
    consoleErrors = []
    exitCode = null
    
    // Mock console methods
    console.log = (...args) => consoleOutput.push(args)
    console.error = (...args) => consoleErrors.push(args)
    process.exit = (code) => { exitCode = code }
  })

  afterEach(() => {
    // Restore original methods
    console.log = originalConsoleLog
    console.error = originalConsoleError
    process.exit = originalProcessExit
  })

  describe('Success Scenarios', () => {
    it('should handle successful execution with no return value', async () => {
      const main = async () => {}
      await createHandler(main)()
      
      assert.strictEqual(exitCode, 0)
      assert.strictEqual(consoleOutput.length, 2) // Initial log + success output
      assert.strictEqual(JSON.parse(consoleOutput[1][0]).state, 'success')
    })

    it('should handle successful execution with return value', async () => {
      const main = async () => ({ data: 'test' })
      await createHandler(main)()
      
      assert.strictEqual(exitCode, 0)
      assert.strictEqual(consoleOutput.length, 2)
      const output = JSON.parse(consoleOutput[1][0])
      assert.strictEqual(output.state, 'success')
      assert.strictEqual(output.data, 'test')
    })
  })

  describe('Error Scenarios', () => {
    it('should handle standard error', async () => {
      const main = async () => { throw new Error('test error') }
      await createHandler(main)()
      
      assert.strictEqual(exitCode, 1)
      assert.strictEqual(consoleErrors.length, 2) // Error + failure output
      const output = JSON.parse(consoleErrors[1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'test error')
    })

    it('should handle error with custom properties', async () => {
      const error = new Error('custom error')
      error.code = 'CUSTOM_CODE'
      error.data = { custom: 'data' }
      
      const main = async () => { throw error }
      await createHandler(main)()
      
      assert.strictEqual(exitCode, 1)
      const output = JSON.parse(consoleErrors[1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'custom error')
      assert.strictEqual(output.data.code, 'CUSTOM_CODE')
      assert.deepStrictEqual(output.data.data, { custom: 'data' })
    })
  })

  describe('Shutdown Scenarios', () => {
    it('should handle SIGINT gracefully', async () => {
      const main = async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const handler = createHandler(main)
      
      // Start the handler
      const promise = handler()
      
      // Wait a bit to ensure the handler has started
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Simulate SIGINT
      process.emit('SIGINT')
      await promise.catch(() => {}) // Ignore the rejection
      
      // Verify the output
      const output = JSON.parse(consoleErrors[consoleErrors.length - 1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'SIGINT received')
    })

    it('should handle uncaught exception', async () => {
      const main = async () => {
        throw new Error('uncaught error')
      }
      await createHandler(main)()
      
      const output = JSON.parse(consoleErrors[consoleErrors.length - 1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'uncaught error')
    })

    it('should handle unhandled rejection', async () => {
      const main = async () => {
        return Promise.reject(new Error('unhandled rejection'))
      }
      await createHandler(main)()
      
      const output = JSON.parse(consoleErrors[consoleErrors.length - 1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'unhandled rejection')
    })
  })

  describe('Cleanup Scenarios', () => {
    it('should execute cleanup function before exit', async () => {
      let cleanupExecuted = false
      const main = async () => ({ data: 'test' })
      
      await createHandler(main, {
        onCleanup: async () => {
          cleanupExecuted = true
        }
      })()
      
      assert.strictEqual(cleanupExecuted, true)
      const output = JSON.parse(consoleOutput[consoleOutput.length - 1][0])
      assert.strictEqual(output.state, 'success')
    })

    it('should handle cleanup errors', async () => {
      const main = async () => ({ data: 'test' })
      
      await createHandler(main, {
        onCleanup: async () => {
          throw new Error('cleanup error')
        }
      })()
      
      const output = JSON.parse(consoleErrors[consoleErrors.length - 1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'cleanup error')
    })
  })

  describe('Example Script Scenarios', () => {
    it('should handle successful script execution with arguments', async () => {
      const main = async (args) => {
        const result = {
          message: "Work completed successfully!",
          args: args,
          timestamp: new Date().toISOString()
        }
        return { data: result }
      }

      const args = ['test1', 'test2']
      await createHandler(main)(args)

      const output = JSON.parse(consoleOutput[consoleOutput.length - 1][0])
      assert.strictEqual(output.state, 'success')
      assert.strictEqual(output.data.message, 'Work completed successfully!')
      assert.deepStrictEqual(output.data.args, args)
      assert.ok(output.data.timestamp)
    })

    it('should handle validation error with custom properties', async () => {
      const main = async (args) => {
        if (!args || args.length === 0) {
          const error = new Error('No arguments provided')
          error.code = 'MISSING_ARGS'
          error.data = { required: true }
          throw error
        }
        return { data: {} }
      }

      await createHandler(main)([])

      const output = JSON.parse(consoleErrors[consoleErrors.length - 1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'No arguments provided')
      assert.strictEqual(output.data.code, 'MISSING_ARGS')
      assert.deepStrictEqual(output.data.data, { required: true })
    })

    it('should handle work error with custom properties', async () => {
      const main = async (args) => {
        if (args[0] === 'error') {
          const error = new Error('Simulated error during work')
          error.code = 'WORK_ERROR'
          error.data = { 
            step: 'processing',
            args: args
          }
          throw error
        }
        return { data: {} }
      }

      const args = ['error', 'test']
      await createHandler(main)(args)

      const output = JSON.parse(consoleErrors[consoleErrors.length - 1][0])
      assert.strictEqual(output.state, 'failure')
      assert.strictEqual(output.data.message, 'Simulated error during work')
      assert.strictEqual(output.data.code, 'WORK_ERROR')
      assert.deepStrictEqual(output.data.data, {
        step: 'processing',
        args: args
      })
    })
  })
}) 