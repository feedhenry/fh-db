fh-db(1) -- The FeedHenry Database access library
===============================================

## DESCRIPTION

This contains the fh.db() layer the works above the mongodb library. It has a Ditch-like interface, with the same actions and parameters

## Installation

Add fh-db as a dependency to your module and require it where required, like any other npm module

## Testing

**N.B. This guide assumes you have a functional [docker-machine](https://docs.docker.com/machine/install-machine/).**

### Start Mongo Server
Start the docker machine for the version of mongo you wish to test:
```bash
docker run -d -p 27017:27017 mongo:2.4
```

### Note for docker-machine users
You will need to connect your localhost:27017 to the docker-machine:27017, do this with the following command:
```
VBoxManage controlvm <docker-machine-name> natpf1 "docker-mongo,tcp,127.0.0.1,27017,,27017"
```
In the above `docker-mongo` is the name of the rule, this is important to remember, in order to remove it when not required.

Remove the above rule as follows:
```
VBoxManage controlvm dev natpf1 delete docker-mongo
```


### Setup Mongo Database
connect to Mongo:
```
mongo
```

#### For versions > 3.x
You will need to update the authentication to work with fh-db, which is done as follows:
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
##### 2.4.x
```
use admin
db.addUser('admin', 'admin');
```
##### >= 2.6
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
##### 2.4.x
```
use fh-ditch
db.addUser('ditchuser', 'ditchpassword');
```

##### >= 2.6
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