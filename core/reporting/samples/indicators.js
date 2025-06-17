const ind = require('./indicators.json')

console.log('"id";"title";"creation.date";"acl"')
ind.forEach(m => {

  let line = ''
  line += `"${m._id.$oid}";`
  line += `"${m.title}";`
  line += `"${m.creation_date.$date}";`

  m.acl.forEach(a => {
    let acl = `${line}"${a}"`
    console.log(acl)
  })

})
