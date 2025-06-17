
const { createHandler, executeHandler } = require('./')

const main = async () => {

  return { message: 'hola mundo!' }

}

// crea un handler con captura de error y parser de output
module.exports = createHandler(main, module)

// si se ejecuta directamente desde CLI se invoca el main directamente
if (require.main === module) {
  executeHandler(main)
}


