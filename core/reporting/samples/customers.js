const customers = require('./customers')

console.log(`"id";"name";"creation_date"`)
customers.forEach(c => {

	console.log(`"${c._id.$oid}","${c.name}";"${c.creation_date.$date}"`)
	//console.log()
})

