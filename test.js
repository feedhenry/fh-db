var local = 'mongodb://localhost:27017/FH_LOCAL'
var fh2 = 'mongodb://username:pass@db1.prv.mbaas2.cluster.feedhenry.net,db2.prv.mbaas2.cluster.feedhenry.net:27017/domain-vvuq7douloe2zkyktub7fcmt-demos-dev?replicaSet=cluster-mbaas2_rs1'
var fh1 = 'mongodb://username:pass@db1.prv.mbaas2.cluster.feedhenry.net:27017/domain-vvuq7douloe2zkyktub7fcmt-demos-dev?replicaSet=cluster-mbaas2_rs1'

console.log(require('./lib/utils').parseMongoConnectionURL(local))
console.log(require('./lib/utils').parseMongoConnectionURL(fh2))
console.log(require('./lib/utils').parseMongoConnectionURL(fh1))