fh-db(1) -- The FeedHenry Database access library
===============================================

[![npm package](https://nodei.co/npm/fh-db.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/fh-db/)

[![Dependency Status](https://img.shields.io/david/feedhenry/fh-db.svg?style=flat-square)](https://david-dm.org/feedhenry/fh-db)
[![Known Vulnerabilities](https://snyk.io/test/npm/fh-db/badge.svg?style=flat-square)](https://snyk.io/test/npm/fh-db)

|                 | Project Info  |
| --------------- | ------------- |
| License:        | Apache License, Version 2.0  |
| Build:          | npm  |
| Documentation:  | http://docs.feedhenry.com/v3/api/cloud_api.html  |
| Issue tracker:  | https://issues.jboss.org/projects/FH/summary  |
| Mailing list:   | [feedhenry-dev](https://www.redhat.com/archives/feedhenry-dev/) ([subscribe](https://www.redhat.com/mailman/listinfo/feedhenry-dev))  |
| IRC:            | [#feedhenry](https://webchat.freenode.net/?channels=feedhenry) channel in the [freenode](http://freenode.net/) network.  |

## DESCRIPTION

This contains the fh.db() layer the works above the mongodb library. It has a Ditch-like interface, with the same actions and parameters

## Installation

Add fh-db as a dependency to your module and require it where required, like any other npm module

## Testing

**N.B. This guide assumes you have a functional [docker-machine](https://docs.docker.com/machine/install-machine/).**

### Start Mongo Server
Start the docker machine for the version of mongo you wish to test:
```bash
docker run -d -p 27017:27017 mongo:2.6
```

### Note for docker-machine users
You will need to connect your localhost:27017 to the docker-machine:27017, do this with the following command:
```
VBoxManage controlvm `docker-machine active` natpf1 "docker-mongo,tcp,127.0.0.1,27017,,27017"
```
In the above `docker-mongo` is the name of the rule, this is important to remember, in order to remove it when not required.

Remove the above rule as follows:
```
VBoxManage controlvm `docker-machine active` natpf1 delete docker-mongo
```


### Setup Mongo Database
connect to Mongo:
```
mongo
```

#### For MongoDB versions > 3.x
Well, instead of MongoDB 2.6 stated above if you used MongoDB 3.x, you will need to update the authentication
to work with fh-db, which is done as follows:
```
use admin
db.system.users.remove({})
db.system.version.remove({})
db.system.version.insert({ "_id" : "authSchema", "currentVersion" : 3 })
```

Then exit mongo and restart the docker container:
```
docker stop <container-name>
docker start <container-name>
```

And reconnect to mongo:
```
mongo
```

#### Add the admin user:

```
use admin
db.createUser({user: 'admin', pwd: 'admin', roles: ['root']})
```

##### Test the login:
exit mongo and run:
```
mongo admin -u admin -p admin
```

#### Add the ditchuser

Log in as the admin user, if you are not yet, then run:

```
use fh-ditch
db.createUser({user: 'ditchuser', pwd: 'ditchpassword', roles: ['dbAdmin']})
```

##### Test the login:
Exit Mongo and run:
```
mongo fh-ditch -u ditchuser -p ditchpassword
```

### Execute the test
```
grunt fh:unit
```
